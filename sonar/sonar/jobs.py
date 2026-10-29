"""Opravila v ozadju: analiza naloženih datotek, uvoz lokalne mape, zajem z Deezerja.

Računanje prstnih odtisov teče v več procesih hkrati (vsa jedra razen enega).
"""
import itertools
import multiprocessing
import os
import tempfile
import threading
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import requests

from .audio import AUDIO_EXTS, SR, load, probe
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
               'added': 0, 'failed': 0, 'message': '', 'started': time.time(), 'cancel': False}
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

    def crawl_deezer(self, seeds, max_tracks=1000, per_artist=10, related=True):
        label = 'Deezer: ' + ', '.join(seeds)[:80]
        return self._start(self._imports, 'deezer', label, self._crawl_deezer, seeds, max_tracks, per_artist, related)

    def analyze(self, aid):
        return self._start(self._analyses, 'analysis', f'Analysis #{aid}', self._analyze, aid)

    # ---------- uvoz mape ----------

    def _import_folder(self, job, folder):
        if not folder.is_dir():
            raise ValueError(f'Mapa ne obstaja: {folder}')
        files = [p for p in folder.rglob('*') if p.suffix.lower() in AUDIO_EXTS and not p.name.startswith('.')]
        todo = [str(p) for p in files if not self.lib.has('local', str(p.resolve()))]
        job['total'] = len(todo)
        job['message'] = f'{len(files) - len(todo)} že v katalogu'
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

    # ---------- zajem z Deezerja ----------

    def _crawl_deezer(self, job, seeds, max_tracks, per_artist, related):
        dz = Deezer()
        artists, seen_artists, pending = [], set(), {}
        tracks = []  # (deezer track json) v vrstnem redu odkritja

        def queue_artist(a):
            if a and a['id'] not in seen_artists:
                seen_artists.add(a['id'])
                artists.append(a)

        for seed in seeds:
            kind, value = parse_seed(seed)
            if kind == 'artist':
                queue_artist(dz.get(f'/artist/{value}') if value.isdigit() else dz.find_artist(value))
            elif kind in ('playlist', 'album'):
                tracks += list(dz.pages(f'/{kind}/{value}/tracks', limit=max_tracks))
            elif kind == 'track':
                tracks.append(dz.get(f'/track/{value}'))
            elif kind == 'label':
                tracks += list(dz.pages('/search', limit=max_tracks, q=f'label:"{value}"'))
            else:
                tracks += list(dz.pages('/search', limit=max_tracks, q=value))
        for t in tracks:
            queue_artist(t.get('artist'))

        job['total'] = max_tracks
        futures = {}

        def submit(t):
            if len(pending) + job['added'] + job['failed'] >= max_tracks or not t.get('preview') or not t.get('readable', True):
                return
            if t['id'] in pending or self.lib.has('deezer', t['id']):
                return
            pending[t['id']] = t
            futures[pool().submit(_preview_worker, (t['id'], t['preview']))] = t['id']

        def drain(block=False):
            for fut in [f for f in futures if block or f.done()]:
                tid, res, err = fut.result()
                del futures[fut]
                t = pending.pop(tid)
                job['done'] += 1
                if err:
                    job['failed'] += 1
                    continue
                self.lib.add_track('deezer', tid, res['vec'], bpm=res['bpm'], key=res['key'], camelot=res['camelot'], **track_meta(t))
                job['added'] += 1

        for t in tracks:
            submit(t)
        i = 0
        while i < len(artists) and job['added'] + len(pending) < max_tracks and not job['cancel']:
            a = artists[i]
            i += 1
            job['message'] = f'Izvajalec: {a.get("name")} ({i}/{len(artists)})'
            try:
                for t in dz.artist_top(a['id'], per_artist):
                    submit(t)
                if related:
                    for r in dz.related(a['id']):
                        queue_artist(r)
            except Exception as e:  # noqa: BLE001
                job['message'] = f'{a.get("name")}: {e}'
            drain()
            while len(futures) > 64:  # ne prehitevaj procesov preveč
                time.sleep(0.2)
                drain()
        if job['cancel']:
            for f in futures:
                f.cancel()
            return
        drain(block=True)
        job['total'] = job['done']
        job['message'] = f'Končano, {len(artists)} izvajalcev'

    # ---------- analiza naložene datoteke ----------

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
