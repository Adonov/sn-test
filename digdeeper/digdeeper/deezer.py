"""Javni Deezer API (brez ključa): iskanje, sorodni izvajalci in 30-sekundni predposlušanji."""
import re
import threading
import time

import requests

API = 'https://api.deezer.com'


class DeezerError(Exception):
    pass


class Deezer:
    """Odjemalec z omejitvijo hitrosti (Deezer dovoli 50 zahtevkov na 5 sekund)."""

    def __init__(self, per_second=8):
        self.http = requests.Session()
        self.http.headers['User-Agent'] = 'DigDeeper/0.1 (personal use)'
        self.min_gap = 1 / per_second
        self.last = 0.0
        self.lock = threading.Lock()

    def get(self, path, **params):
        url = path if path.startswith('http') else API + path
        for attempt in range(5):
            with self.lock:
                wait = self.last + self.min_gap - time.time()
                if wait > 0:
                    time.sleep(wait)
                self.last = time.time()
            res = self.http.get(url, params=params, timeout=20)
            res.raise_for_status()
            data = res.json()
            err = data.get('error') if isinstance(data, dict) else None
            if not err:
                return data
            if err.get('code') == 4:  # quota exceeded
                time.sleep(5 * (attempt + 1))
                continue
            raise DeezerError(err.get('message') or str(err))
        raise DeezerError('Deezer: preveč zahtevkov, poskusi kasneje')

    def pages(self, path, limit=None, **params):
        """Vse strani rezultatov (polje next)."""
        data = self.get(path, limit=min(limit or 100, 100), **params)
        n = 0
        while True:
            for item in data.get('data', []):
                yield item
                n += 1
                if limit and n >= limit:
                    return
            if not data.get('next'):
                return
            data = self.get(data['next'])

    def find_artist(self, name):
        hits = self.get('/search/artist', q=name, limit=1).get('data', [])
        return hits[0] if hits else None

    def artist_top(self, artist_id, limit=20):
        return list(self.pages(f'/artist/{artist_id}/top', limit=limit))

    def related(self, artist_id, limit=20):
        return list(self.pages(f'/artist/{artist_id}/related', limit=limit))

    def preview_url(self, track_id):
        return self.get(f'/track/{track_id}').get('preview')


def track_meta(t):
    """Podatki komada iz Deezer JSON za shranjevanje v katalog."""
    album = t.get('album') or {}
    return {
        'title': t.get('title'),
        'artist': (t.get('artist') or {}).get('name'),
        'album': album.get('title'),
        'cover': album.get('cover_medium') or album.get('cover'),
        'link': t.get('link') or f'https://www.deezer.com/track/{t["id"]}',
        'duration': t.get('duration'),
    }


def parse_seed(seed):
    """'https://www.deezer.com/si/playlist/123', 'playlist:123', 'artist:Octave', 'q:minimal house' ali samo ime izvajalca."""
    seed = seed.strip()
    m = re.search(r'deezer\.com/(?:[a-z]{2}/)?(artist|playlist|album|track)/(\d+)', seed)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r'(artist|playlist|album|track|q|label):\s*(.+)', seed, re.I)
    if m:
        return m.group(1).lower(), m.group(2).strip()
    return 'artist', seed
