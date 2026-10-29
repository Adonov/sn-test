"""Opravila v ozadju: analiza datotek in povezav, uvoz lokalne mape, zajem s spletnih platform.

Računanje prstnih odtisov teče v več procesih hkrati (vsa jedra razen enega).
"""
import itertools
import multiprocessing
import os
import shutil
import tempfile
import threading
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import requests

from .audio import AUDIO_EXTS, SR, load, probe
from . import collections, links
from .deezer import Deezer, parse_seed, track_meta
from .features import analyze_file, clip_features, combine
from .sets import passages, window_starts

SET_MIN_SECONDS = 12 * 60  # daljše datoteke obravnavamo kot DJ set

_pool = None
_pool_lock = threading.Lock()


def pool():
    global _pool
    with _pool_lock:
        if _pool is None:
            workers = int(os.environ.get('SONAR_WORKERS') or max(1, (os.cpu_count() or 2) - 1))
            _pool = ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context('spawn'))
        return _pool


# ---------- delavci (tečejo v ločenih procesih) ----------

def _track_worker(path):
    try:
        info = probe(path)
        return path, info, analyze_file(path, info['duration']), None
    except Exception as e:  # noqa: BLE001 – ena pokvarjena datoteka ne sme ustaviti uvoza
        return path, None, None, str(e)


def _window_worker(args):
    path, start, length = args
    y = load(path, start, length)
    return clip_features(y if len(y) > SR else np.zeros(SR * 4, np.float32))


def _preview_worker(args):
    track_id, url = args
    try:
        res = requests.get(url, timeout=30)
        res.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
            f.write(res.content)
        try:
            return track_id, analyze_file(f.name, duration=30, clips=1), None
        finally:
            os.unlink(f.name)
    except Exception as e:  # noqa: BLE001
        return track_id, None, str(e)


def _link_worker(url):
    tmp = tempfile.mkdtemp(prefix='sonar-')
    try:
        path, m, _, _ = links.download(url, tmp, max_seconds=links.MAX_TRACK_SECONDS)
        return analyze_file(path), m, None
    except Exception as e:  # noqa: BLE001
        return None, None, str(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


PLATFORMS = {'bandcamp': 'Bandcamp', 'soundcloud': 'SoundCloud', 'youtube': 'YouTube', 'discogs': 'Discogs', 'mixcloud': 'Mixcloud'}
META_KEYS = ('title', 'artist', 'album', 'cover', 'link', 'duration')


def connection_url(platform, handle):
    """Uporabniško ime ali povezava → stran z zbirko."""
    handle = handle.strip()
    if handle.startswith('http'):
        return handle
    handle = handle.lstrip('@')
    return {
        'soundcloud': f'https://soundcloud.com/{handle}/likes',
        'mixcloud': f'https://www.mixcloud.com/{handle}/favorites/',
        'youtube': f'https://www.youtube.com/@{handle}/videos',
    }[platform]


def classify(line, search_on='deezer', n=10):
    """Vrstica iz polja "Discover" → (platforma, vrsta, vrednost)."""
    line = line.strip()
    if 'deezer.com' in line:
        return ('deezer', *parse_seed(line))
    if links.is_link(line):
        return ('link', 'url', line)
    kind, value = parse_seed(line)
    if kind in ('label', 'playlist', 'album', 'track') or search_on == 'deezer':
        return ('deezer', kind, value)
    prefix = {'youtube': 'ytsearch', 'soundcloud': 'scsearch'}[search_on]
    return ('link', 'url', f'{prefix}{n}:{value}')


class Harvest:
    """Pošilja komade v analizo (več procesov hkrati) in jih sproti shranjuje v katalog."""

    def __init__(self, lib, job, max_tracks, owned=False):
        self.lib, self.job, self.max, self.owned = lib, job, max_tracks, owned
        self.futures, self.keys = {}, set()
        job['total'] = max_tracks

    def full(self):
        return self.job['cancel'] or self.job['added'] + len(self.futures) >= self.max

    def _submit(self, key, fn, arg, meta):
        if self.full() or key in self.keys or self.lib.has(*key):
            return
        self.keys.add(key)
        self.futures[pool().submit(fn, arg)] = (key, meta, fn is _link_worker)
        while len(self.futures) > 48:  # ne prehitevaj procesov preveč
            time.sleep(0.2)
            self.drain()

    def preview(self, source, sid, url, meta):
        if url:
            self._submit((source, str(sid)), _preview_worker, (sid, url), meta)

    def link(self, entry, extra=None):
        if (entry.get('duration') or 0) > links.MAX_TRACK_SECONDS:
            return
        meta = {**{k: entry.get(k) for k in META_KEYS}, **{k: v for k, v in (extra or {}).items() if v}}
        self._submit((entry['source'], str(entry['id'])), _link_worker, entry['url'], meta)

    def drain(self, block=False):
        for fut in [f for f in self.futures if block or f.done()]:
            key, meta, is_link = self.futures.pop(fut)
            self.job['done'] += 1
            try:
                if is_link:  # (rezultat, meta s platforme, napaka)
                    res, found, err = fut.result()
                    meta = {**meta, **{k: v for k, v in (found or {}).items() if v and not meta.get(k)}}
                else:  # (id, rezultat, napaka)
                    _, res, err = fut.result()
            except Exception as e:  # noqa: BLE001
                res, err = None, str(e)
            if err or res is None:
                self.job['failed'] += 1
                if len(self.job['errors']) < 200:
                    self.job['errors'].append(f'{meta.get("title") or key[1]}: {err}')
                continue
            self.lib.add_track(*key, res['vec'], bpm=res['bpm'], key=res['key'], camelot=res['camelot'], owned=self.owned,
                               **{k: meta.get(k) for k in META_KEYS})
            self.job['added'] += 1

    def finish(self):
        if self.job['cancel']:
            for f in self.futures:
                f.cancel()
            return
        self.drain(block=True)
        self.job['total'] = self.job['done']


# ---------- register opravil ----------

class Jobs:
    def __init__(self, lib):
        self.lib = lib
        self.jobs = {}
        self._ids = itertools.count(1)
        self._imports = ThreadPoolExecutor(1)
        self._analyses = ThreadPoolExecutor(1)

    def list(self):
        return sorted(self.jobs.values(), key=lambda j: -j['id'])[:20]

    def _start(self, executor, kind, label, fn, *args):
        job = {'id': next(self._ids), 'kind': kind, 'label': label, 'status': 'queued', 'done': 0, 'total': 0,
               'added': 0, 'failed': 0, 'message': '', 'errors': [], 'started': time.time(), 'cancel': False}
        self.jobs[job['id']] = job

        def run():
            if job['cancel']:
                job['status'] = 'cancelled'
                return
            job['status'] = 'running'
            try:
                fn(job, *args)
                job['status'] = 'cancelled' if job['cancel'] else 'done'
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                job['status'], job['message'] = 'error', str(e)
            job['finished'] = time.time()

        executor.submit(run)
        return job

    def cancel(self, jid):
        if jid in self.jobs:
            self.jobs[jid]['cancel'] = True

    def import_folder(self, folder):
        return self._start(self._imports, 'folder', f'Folder {folder}', self._import_folder, Path(folder).expanduser())

    def import_sources(self, lines, search_on='deezer', max_tracks=1000, per_artist=10, related=True):
        label = ', '.join(lines)[:90]
        return self._start(self._imports, 'import', label, self._import_sources, lines, search_on, max_tracks, per_artist, related)

    def crawl_deezer(self, seeds, max_tracks=1000, per_artist=10, related=True):
        return self.import_sources(seeds, 'deezer', max_tracks, per_artist, related)

    def connect(self, platform, handle, max_tracks=2000):
        label = f'{PLATFORMS[platform]}: {handle}'
        return self._start(self._imports, 'connect', label, self._connect, platform, handle, max_tracks)

    def analyze(self, aid):
        return self._start(self._analyses, 'analysis', f'Analysis #{aid}', self._analyze, aid)

    def analyze_link(self, aid, url):
        return self._start(self._analyses, 'analysis', f'Link {url}', self._analyze_link, aid, url)

    # ---------- uvoz mape ----------

    def _import_folder(self, job, folder):
        if not folder.is_dir():
            raise ValueError(f'Mapa ne obstaja: {folder}')
        files = [p for p in folder.rglob('*') if p.suffix.lower() in AUDIO_EXTS and not p.name.startswith('.')]
        todo = [str(p) for p in files if not self.lib.has('local', str(p.resolve()))]
        job['total'] = len(todo)
        job['message'] = f'{len(files) - len(todo)} already in catalog'
        futures = [pool().submit(_track_worker, p) for p in todo]
        for fut in as_completed(futures):
            if job['cancel']:
                for f in futures:
                    f.cancel()
                return
            path, info, res, err = fut.result()
            job['done'] += 1
            if err:
                job['failed'] += 1
                continue
            p = Path(path)
            self.lib.add_track(
                'local', str(p.resolve()), res['vec'],
                title=info['title'] or p.stem, artist=info['artist'], album=info['album'],
                path=str(p.resolve()), duration=info['duration'], bpm=res['bpm'], key=res['key'], camelot=res['camelot'],
            )
            job['added'] += 1

    # ---------- spletni viri: Deezer, SoundCloud, YouTube, Bandcamp, Mixcloud … ----------

    def _import_sources(self, job, lines, search_on, max_tracks, per_artist, related):
        h = Harvest(self.lib, job, max_tracks)
        dz = Deezer()
        artists, seen_artists = [], set()

        def queue_artist(a):
            if a and a.get('id') and a['id'] not in seen_artists:
                seen_artists.add(a['id'])
                artists.append(a)

        def deezer_tracks(tracks):
            for t in tracks:
                h.preview('deezer', t['id'], t.get('preview') if t.get('readable', True) else None, track_meta(t))
                if related:
                    queue_artist(t.get('artist'))

        for line in lines:
            if h.full():
                break
            platform, kind, value = classify(line, search_on, per_artist)
            job['message'] = line[:80]
            try:
                if platform == 'link':
                    for e in links.list_entries(value, limit=max_tracks):
                        h.link(e)
                elif kind == 'artist':
                    queue_artist(dz.get(f'/artist/{value}') if value.isdigit() else dz.find_artist(value))
                elif kind in ('playlist', 'album'):
                    deezer_tracks(dz.pages(f'/{kind}/{value}/tracks', limit=max_tracks))
                elif kind == 'track':
                    deezer_tracks([dz.get(f'/track/{value}')])
                elif kind == 'label':
                    deezer_tracks(dz.pages('/search', limit=max_tracks, q=f'label:"{value}"'))
                else:
                    deezer_tracks(dz.pages('/search', limit=max_tracks, q=value))
            except Exception as e:  # noqa: BLE001 – ena slaba vrstica ne ustavi ostalih
                job['errors'].append(f'{line}: {e}')
            h.drain()

        # Deezer izvajalci: najbolj poslušani komadi, nato sorodni izvajalci
        i = 0
        while i < len(artists) and not h.full():
            a = artists[i]
            i += 1
            job['message'] = f'{a.get("name")} ({i}/{len(artists)})'
            try:
                for t in dz.artist_top(a['id'], per_artist):
                    h.preview('deezer', t['id'], t.get('preview'), track_meta(t))
                if related:
                    for r in dz.related(a['id']):
                        queue_artist(r)
            except Exception as e:  # noqa: BLE001
                job['errors'].append(f'{a.get("name")}: {e}')
            h.drain()
        h.finish()
        job['message'] = f'finished · {len(artists)} artists' if artists else 'finished'

    # ---------- povezane zbirke ----------

    def _connect(self, job, platform, handle, max_tracks):
        h = Harvest(self.lib, job, max_tracks, owned=True)
        self.lib.set_connection(platform, handle)
        if platform == 'bandcamp':
            job['message'] = 'Reading your Bandcamp collection…'
            for item in collections.bandcamp_collection(handle, limit=max_tracks):
                if h.full():
                    break
                job['message'] = f'{item["artist"]} – {item["title"]}'
                try:
                    for e in links.list_entries(item['url'], limit=100):
                        h.link(e, {'cover': item['cover'], 'artist': item['artist']})
                except Exception as e:  # noqa: BLE001
                    job['errors'].append(f'{item["url"]}: {e}')
                h.drain()
        elif platform in ('soundcloud', 'youtube', 'mixcloud'):
            for e in links.list_entries(connection_url(platform, handle), limit=max_tracks):
                h.link(e)
        elif platform == 'discogs':
            dc = collections.Discogs(token=self.lib.setting('discogs_token'))
            dz = Deezer()
            releases = dc.releases(handle, limit=max_tracks)
            for n, r in enumerate(releases, 1):
                if h.full():
                    break
                job['message'] = f'{r["artist"]} – {r["title"]} ({n}/{len(releases)})'
                try:
                    videos = dc.videos(r['id'])
                    for url in videos:
                        h.link({'source': 'youtube', 'id': url.rsplit('=', 1)[-1], 'url': url}, {'album': r['title'], 'cover': r['cover']})
                    if not videos:  # ni posnetkov → poskusi isti album na Deezerju
                        hits = dz.get('/search/album', q=f'{r["artist"]} {r["title"]}', limit=1).get('data', [])
                        if hits:
                            for t in dz.pages(f'/album/{hits[0]["id"]}/tracks', limit=30):
                                t.setdefault('album', {'title': r['title'], 'cover_medium': r['cover']})
                                h.preview('deezer', t['id'], t.get('preview'), track_meta(t))
                except Exception as e:  # noqa: BLE001
                    job['errors'].append(f'{r["title"]}: {e}')
                h.drain()
        else:
            raise ValueError(f'Neznana platforma: {platform}')
        h.finish()
        job['message'] = 'finished'

    # ---------- analiza naložene datoteke ali povezave ----------

    def _analyze_link(self, job, aid, url):
        job['message'] = 'Downloading…'
        self.lib.update_analysis(aid, status='running')
        try:
            path, m, _, _ = links.download(url, self.lib.home / 'uploads')
        except Exception as e:
            self.lib.update_analysis(aid, status='error', error=f'Prenos ni uspel: {e}')
            raise
        name = f'{m["title"]} – {m["artist"]}' if m['artist'] and m['title'] else (m['title'] or url)
        self.lib.update_analysis(aid, path=str(path), name=name)
        self._analyze(job, aid)


    def _analyze(self, job, aid):
        lib = self.lib
        a = lib.analysis(aid)
        try:
            info = probe(a['path'])
            dur = info['duration']
            if dur < 5:
                raise ValueError('Datoteka je prekratka ali ni zvok')
            name = a['name']
            if info['title']:
                name = f'{info["title"]} – {info["artist"]}' if info['artist'] else info['title']
            lib.update_analysis(aid, status='running', duration=dur, name=name)
            if dur < SET_MIN_SECONDS:
                res = pool().submit(analyze_file, a['path'], dur).result()
                lib.update_analysis(aid, kind='track', bpm=res['bpm'], key=res['key'], camelot=res['camelot'],
                                    data={'vec': res['vec'].tolist(), 'artist': info['artist'], 'title': info['title']},
                                    status='done', progress=1)
                return
            starts = window_starts(dur)
            job['total'] = len(starts)
            futures = [pool().submit(_window_worker, (a['path'], s, 30.0)) for s in starts]
            results = []
            for fut in futures:
                results.append(fut.result())
                job['done'] = len(results)
                if len(results) % 4 == 0:
                    lib.update_analysis(aid, progress=len(results) / len(starts))

            def own_norm(X):
                std = X.std(0)
                return lib.normalize(X, (X.mean(0), np.maximum(std, 1e-3 * (np.abs(X.mean(0)) + 1))))

            ps = passages(starts, results, dur, own_norm)
            overall = combine(results)
            lib.update_analysis(aid, kind='set', bpm=overall['bpm'], key=overall['key'], camelot=overall['camelot'],
                                data={'vec': overall['vec'].tolist(), 'passages': ps}, status='done', progress=1)
        except Exception as e:
            lib.update_analysis(aid, status='error', error=str(e))
            raise
