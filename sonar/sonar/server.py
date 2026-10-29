"""HTTP API in spletni vmesnik."""
import re
import subprocess
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import audio, links
from .deezer import Deezer
from .jobs import PLATFORMS, Jobs
from .library import Library, _norm_name

STATIC = Path(__file__).parent / 'static'


def create_app(lib=None):
    lib = lib or Library()
    jobs = Jobs(lib)
    dz = Deezer()
    app = FastAPI(title='Sonar')
    app.state.lib, app.state.jobs = lib, jobs

    def results(hits):
        """Doda podatke komadov k rezultatom iskanja."""
        tracks = lib.tracks([h['id'] for h in hits])
        return [{**public(tracks[h['id']]), **h} for h in hits if h['id'] in tracks]

    def need(x, what='Ni najdeno'):
        if x is None:
            raise HTTPException(404, what)
        return x

    # ---------- katalog ----------

    @app.get('/api/stats')
    def stats():
        return {**lib.counts(), 'liked': len(lib.find_tracks(liked=True, limit=100000)),
                'owned': lib.counts_owned(), 'sets': len(lib.analyses('set'))}

    @app.get('/api/tracks')
    def find_tracks(q: str = '', liked: bool = False, saved: bool = False, owned: bool = False, limit: int = 50, offset: int = 0):
        return [public(t) for t in lib.find_tracks(q, liked, saved, min(limit, 500), offset, owned)]

    @app.get('/api/tracks/{tid}')
    def get_track(tid: int):
        return public(need(lib.track(tid)))

    @app.get('/api/tracks/{tid}/similar')
    def similar_to_track(tid: int, k: int = 100, bpm_tol: Optional[float] = None):
        t = need(lib.track(tid, with_vec=True))
        hits = lib.search(t['vec'], k=min(k, 500), exclude_ids=[tid], bpm=t['bpm'], bpm_tol=bpm_tol,
                          exclude_names=[_norm_name(t['artist']) + '|' + _norm_name(t['title'])])
        return {'reference': public(t), 'results': results(hits)}

    class Flags(BaseModel):
        liked: Optional[bool] = None
        saved: Optional[bool] = None

    @app.post('/api/tracks/{tid}')
    def set_flags(tid: int, flags: Flags):
        need(lib.track(tid))
        lib.set_flags(tid, liked=flags.liked, saved=flags.saved)
        return public(lib.track(tid))

    @app.get('/api/tracks/{tid}/audio')
    def track_audio(tid: int, start: float = 0):
        t = need(lib.track(tid))
        if t['path']:
            return FileResponse(t['path'])
        if streamed(t):
            # SoundCloud, YouTube, Bandcamp …: zvok pretakamo skozi ffmpeg (deluje tudi za HLS in zaščitene povezave)
            try:
                url, headers = links.stream(t['link'])
            except Exception as e:  # noqa: BLE001
                raise HTTPException(502, f'Platforma ni vrnila zvoka: {e}')
            cmd = ['ffmpeg', '-v', 'quiet', '-nostdin']
            if headers:
                cmd += ['-headers', ''.join(f'{k}: {v}\r\n' for k, v in headers.items())]
            if start > 0:
                cmd += ['-ss', f'{start:.1f}']
            proc = subprocess.Popen(cmd + ['-i', url, '-vn', '-f', 'mp3', '-b:a', '192k', '-'], stdout=subprocess.PIPE)

            def chunks():
                try:
                    while chunk := proc.stdout.read(1 << 16):
                        yield chunk
                finally:
                    proc.kill()

            return StreamingResponse(chunks(), media_type='audio/mpeg')
        if t['source'] == 'deezer':
            # povezave do predposlušanj potečejo, zato vsakič vprašamo za svežo
            url = dz.preview_url(t['source_id'])
            if url:
                return RedirectResponse(url)
        raise HTTPException(404, 'Ni zvoka')

    @app.get('/api/tracks/{tid}/cover')
    def track_cover(tid: int):
        t = need(lib.track(tid))
        if t['cover']:
            return RedirectResponse(t['cover'])
        img = audio.cover(t['path']) if t['path'] else None
        if not img:
            raise HTTPException(404)
        return Response(img, media_type='image/jpeg', headers={'Cache-Control': 'max-age=86400'})

    # ---------- analize: naloži komad ali set ----------

    @app.post('/api/analyses')
    async def upload(file: UploadFile = File(...)):
        ext = Path(file.filename or '').suffix.lower()
        if ext not in audio.AUDIO_EXTS:
            raise HTTPException(400, f'Nepodprta vrsta datoteke: {ext or "?"}')
        dest = lib.home / 'uploads' / f'{uuid.uuid4().hex}{ext}'
        with open(dest, 'wb') as f:
            while chunk := await file.read(1 << 20):
                f.write(chunk)
        aid = lib.create_analysis('pending', Path(file.filename).stem, dest)
        jobs.analyze(aid)
        return analysis_public(lib.analysis(aid))

    class LinkUpload(BaseModel):
        url: str

    @app.post('/api/analyses/link')
    def upload_link(body: LinkUpload):
        url = body.url.strip()
        if not url.startswith('http'):
            raise HTTPException(400, 'Prilepi povezavo, ki se začne s http')
        aid = lib.create_analysis('pending', url, '')
        jobs.analyze_link(aid, url)
        return analysis_public(lib.analysis(aid))

    @app.get('/api/analyses')
    def list_analyses(kind: Optional[str] = None):
        return lib.analyses(kind)

    @app.get('/api/analyses/{aid}')
    def get_analysis(aid: int):
        return analysis_public(need(lib.analysis(aid)))

    @app.delete('/api/analyses/{aid}')
    def delete_analysis(aid: int):
        lib.delete_analysis(aid)
        return {'ok': True}

    @app.get('/api/analyses/{aid}/audio')
    def analysis_audio(aid: int):
        return FileResponse(need(lib.analysis(aid))['path'])

    @app.get('/api/analyses/{aid}/similar')
    def similar_to_analysis(aid: int, k: int = 100, passage: Optional[int] = None, bpm_tol: Optional[float] = None):
        a = need(lib.analysis(aid))
        if a['status'] != 'done':
            raise HTTPException(409, 'Analiza še ni končana')
        data = a['data']
        if passage is not None:
            p = data['passages'][passage]
            vec, bpm = p['vec'], p['bpm']
        else:
            vec, bpm = data['vec'], a['bpm']
        names = []
        if data.get('title'):
            names.append(_norm_name(data.get('artist')) + '|' + _norm_name(data['title']))
        return {'results': results(lib.search(vec, k=min(k, 500), bpm=bpm, bpm_tol=bpm_tol, exclude_names=names))}

    @app.get('/api/analyses/{aid}/tracklist')
    def tracklist(aid: int, k: int = 5):
        """Za vsak odsek seta najbližji komadi. Zelo blizu (>= 97 %) pomeni, da je verjetno prav ta komad."""
        a = need(lib.analysis(aid))
        if a['status'] != 'done' or a['kind'] != 'set':
            raise HTTPException(409, 'Ni končan set')
        out = []
        for i, p in enumerate(a['data']['passages']):
            hits = results(lib.search(p['vec'], k=k))
            for h in hits:
                h['label'] = 'found' if h['match'] >= 97 else 'closest'
            if hits:
                hits[0]['top'] = True
            out.append({'index': i, 'start': p['start'], 'end': p['end'], 'bpm': p['bpm'], 'key': p['key'],
                        'camelot': p['camelot'], 'matches': hits})
        return out

    @app.get('/api/analyses/{aid}/similar-sets')
    def similar_sets(aid: int, k: int = 20):
        a = need(lib.analysis(aid))
        if a['status'] != 'done':
            return []
        others = [lib.analysis(o['id']) for o in lib.analyses('set') if o['id'] != aid and o['status'] == 'done']
        if not others:
            return []
        Z = lib.normalize(np.array([o['data']['vec'] for o in others], np.float32))
        q = lib.normalize(np.array(a['data']['vec'], np.float32))[0]
        from .features import FACETS, FACET_WEIGHTS
        from .library import to_pct
        score = sum(FACET_WEIGHTS[n] * (Z[:, sl] @ q[sl]) for n, sl in FACETS.items())
        order = np.argsort(-score)[:k]
        return [{**{k_: v for k_, v in others[i].items() if k_ not in ('data', 'path')}, 'match': to_pct(score[i])} for i in order]

    # ---------- seznami predvajanja ----------

    class NewPlaylist(BaseModel):
        name: str

    class PlaylistTrack(BaseModel):
        track_id: int

    @app.get('/api/playlists')
    def playlists():
        return lib.playlists()

    @app.post('/api/playlists')
    def create_playlist(body: NewPlaylist):
        return {'id': lib.create_playlist(body.name.strip() or 'Nov seznam')}

    @app.get('/api/playlists/{pid}')
    def get_playlist(pid: int):
        p = need(lib.playlist(pid))
        p['tracks'] = [public(t) for t in p['tracks']]
        return p

    @app.delete('/api/playlists/{pid}')
    def delete_playlist(pid: int):
        lib.delete_playlist(pid)
        return {'ok': True}

    @app.post('/api/playlists/{pid}/tracks')
    def add_playlist_track(pid: int, body: PlaylistTrack):
        need(lib.playlist(pid))
        need(lib.track(body.track_id))
        lib.add_to_playlist(pid, body.track_id)
        return {'ok': True}

    @app.delete('/api/playlists/{pid}/tracks/{tid}')
    def remove_playlist_track(pid: int, tid: int):
        lib.remove_from_playlist(pid, tid)
        return {'ok': True}

    @app.get('/api/playlists/{pid}/export.m3u')
    def export_m3u(pid: int):
        """M3U za Rekordbox / Serato / Traktor: lokalne datoteke s potjo, ostali komadi s povezavo."""
        p = need(lib.playlist(pid))
        lines = ['#EXTM3U']
        for t in p['tracks']:
            lines.append(f'#EXTINF:{int(t["duration"] or -1)},{t["artist"] or ""} - {t["title"] or ""}')
            lines.append(t['path'] or t['link'] or '')
        name = re.sub(r'[^\w\- ]+', '', p['name']) or 'playlist'
        return PlainTextResponse('\n'.join(lines) + '\n', media_type='audio/x-mpegurl',
                                 headers={'Content-Disposition': f'attachment; filename="{name}.m3u"'})

    # ---------- uvoz v katalog ----------

    class FolderImport(BaseModel):
        path: str

    class DeezerImport(BaseModel):
        seeds: list[str]
        max_tracks: int = 1000
        per_artist: int = 10
        related: bool = True

    @app.post('/api/import/folder')
    def import_folder(body: FolderImport):
        if not Path(body.path).expanduser().is_dir():
            raise HTTPException(400, f'Mapa ne obstaja: {body.path}')
        return jobs.import_folder(body.path)

    @app.post('/api/import/deezer')
    def import_deezer(body: DeezerImport):
        return import_sources(SourcesImport(lines=body.seeds, max_tracks=body.max_tracks, per_artist=body.per_artist, related=body.related))

    class SourcesImport(BaseModel):
        lines: list[str]
        search_on: str = 'deezer'
        max_tracks: int = 1000
        per_artist: int = 10
        related: bool = True

    @app.post('/api/import/sources')
    def import_sources(body: SourcesImport):
        lines = [s.strip() for s in body.lines if s.strip()]
        if not lines:
            raise HTTPException(400, 'Vpiši vsaj enega izvajalca, iskanje ali povezavo')
        if body.search_on not in ('deezer', 'youtube', 'soundcloud'):
            raise HTTPException(400, 'Iskanje je možno na Deezerju, YouTubu ali SoundCloudu')
        return jobs.import_sources(lines, body.search_on, max(1, min(body.max_tracks, 100000)), max(1, min(body.per_artist, 100)), body.related)

    # ---------- povezane zbirke ----------

    class Connect(BaseModel):
        handle: str
        max_tracks: int = 2000

    @app.get('/api/connections')
    def connections():
        conns = lib.connections()
        return [{'platform': p, 'name': name, 'handle': conns.get(p, {}).get('handle'), 'synced': conns.get(p, {}).get('synced')}
                for p, name in PLATFORMS.items()]

    @app.post('/api/connections/{platform}')
    def connect(platform: str, body: Connect):
        if platform not in PLATFORMS:
            raise HTTPException(404, 'Neznana platforma')
        if not body.handle.strip():
            raise HTTPException(400, 'Vpiši uporabniško ime ali povezavo')
        return jobs.connect(platform, body.handle.strip(), max(1, min(body.max_tracks, 100000)))

    @app.delete('/api/connections/{platform}')
    def disconnect(platform: str):
        lib.remove_connection(platform)
        return {'ok': True}

    class Settings(BaseModel):
        discogs_token: Optional[str] = None

    @app.get('/api/settings')
    def get_settings():
        return {'discogs_token': bool(lib.setting('discogs_token'))}

    @app.post('/api/settings')
    def save_settings(body: Settings):
        if body.discogs_token is not None:
            lib.set_setting('discogs_token', body.discogs_token.strip() or None)
        return get_settings()

    @app.get('/api/jobs')
    def list_jobs():
        return jobs.list()

    @app.post('/api/jobs/{jid}/cancel')
    def cancel_job(jid: int):
        jobs.cancel(jid)
        return {'ok': True}

    app.mount('/', StaticFiles(directory=STATIC, html=True), name='static')
    return app


def public(t):
    """Komad brez notranjih polj (pot do datoteke ostane na strežniku)."""
    t = {k: v for k, v in t.items() if k not in ('vec', 'path')}
    t['local'] = t.get('source') == 'local'
    t['streamed'] = streamed(t)
    return t


def streamed(t):
    """Komadi s platform, ki jih predvajamo prek yt-dlp (brez shranjene datoteke)."""
    return t.get('source') not in ('local', 'deezer') and bool(t.get('link')) and not t.get('path')


def analysis_public(a):
    a = {k: v for k, v in a.items() if k != 'path'}
    data = a.pop('data', None) or {}
    a['passages'] = [{k: v for k, v in p.items() if k != 'vec'} for p in data.get('passages', [])]
    return a
