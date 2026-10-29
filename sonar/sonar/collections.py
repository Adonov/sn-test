"""Javne zbirke na platformah: kupljena glasba na Bandcampu, plošče na Discogsu.

SoundCloud všečki in YouTube playliste gredo neposredno prek yt-dlp (links.py).
"""
import html
import json
import re
import time

import requests

UA = {'User-Agent': 'Sonar/0.1 +https://github.com/Adonov/sn-test'}


class CollectionError(Exception):
    pass


# ---------- Bandcamp ----------

def bandcamp_fan_id(username, http=requests):
    res = http.get(f'https://bandcamp.com/{username}', headers=UA, timeout=30)
    if res.status_code == 404:
        raise CollectionError(f'Bandcamp uporabnik "{username}" ne obstaja')
    res.raise_for_status()
    m = re.search(r'id="pagedata"\s+data-blob="([^"]+)"', res.text)
    if not m:
        raise CollectionError('Bandcamp stran nima podatkov o zbirki (je zbirka zasebna?)')
    blob = json.loads(html.unescape(m.group(1)))
    return blob['fan_data']['fan_id']


def bandcamp_collection(username, limit=500, wishlist=False, http=requests):
    """Albumi in komadi, ki jih je uporabnik kupil (ali ima na seznamu želja)."""
    fan_id = bandcamp_fan_id(username, http)
    kind = 'wishlist_items' if wishlist else 'collection_items'
    token, items = f'{int(time.time()) + 86400}:0:a::', []
    while len(items) < limit:
        res = http.post(f'https://bandcamp.com/api/fancollection/1/{kind}', headers=UA, timeout=30,
                        json={'fan_id': fan_id, 'older_than_token': token, 'count': 100})
        res.raise_for_status()
        data = res.json()
        for it in data.get('items', []):
            if it.get('item_url'):
                items.append({
                    'url': it['item_url'],
                    'artist': it.get('band_name'),
                    'title': it.get('item_title'),
                    'cover': f'https://f4.bcbits.com/img/a{it["item_art_id"]}_10.jpg' if it.get('item_art_id') else None,
                })
        if not data.get('more_available') or not data.get('last_token'):
            break
        token = data['last_token']
    return items[:limit]


# ---------- Discogs ----------

class Discogs:
    API = 'https://api.discogs.com'

    def __init__(self, token=None, http=None):
        self.http = http or requests.Session()
        self.headers = {**UA, **({'Authorization': f'Discogs token={token}'} if token else {})}
        self.gap = 1.1 if token else 2.5  # 60 oz. 25 zahtevkov na minuto
        self.last = 0.0

    def get(self, path, **params):
        for attempt in range(4):
            wait = self.last + self.gap - time.time()
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            res = self.http.get(self.API + path, params=params, headers=self.headers, timeout=30)
            if res.status_code == 429:
                time.sleep(10 * (attempt + 1))
                continue
            if res.status_code == 404:
                raise CollectionError('Discogs: ni najdeno (napačno uporabniško ime ali zasebna zbirka?)')
            if res.status_code in (401, 403):
                raise CollectionError('Discogs: zbirka je zasebna – v nastavitvah dodaj svoj Discogs token')
            res.raise_for_status()
            return res.json()
        raise CollectionError('Discogs: preveč zahtevkov, poskusi kasneje')

    def releases(self, username, limit=500, wantlist=False):
        path = f'/users/{username}/wants' if wantlist else f'/users/{username}/collection/folders/0/releases'
        key = 'wants' if wantlist else 'releases'
        out, page = [], 1
        while len(out) < limit:
            data = self.get(path, per_page=100, page=page)
            for r in data.get(key, []):
                b = r.get('basic_information') or {}
                out.append({
                    'id': b.get('id') or r.get('id'),
                    'title': b.get('title'),
                    'artist': ', '.join(re.sub(r' \(\d+\)$', '', a['name']) for a in b.get('artists', [])),
                    'cover': b.get('cover_image') or b.get('thumb'),
                })
            if page >= (data.get('pagination') or {}).get('pages', 1):
                break
            page += 1
        return out[:limit]

    def videos(self, release_id):
        """YouTube posnetki, ki so jih uporabniki Discogsa pripeli k izdaji."""
        data = self.get(f'/releases/{release_id}')
        return [v['uri'] for v in data.get('videos', []) if v.get('uri')]
