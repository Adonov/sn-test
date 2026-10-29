"""Glasba s spletnih platform prek yt-dlp: SoundCloud, YouTube, Bandcamp, Mixcloud, Beatport, Audiomack …"""
import re
from pathlib import Path

import yt_dlp

BASE = {'quiet': True, 'no_warnings': True, 'noprogress': True, 'socket_timeout': 30, 'ignoreerrors': False,
        'color': {'stdout': 'no_color', 'stderr': 'no_color'}}
MAX_TRACK_SECONDS = 15 * 60  # daljše so miksi/seti – v katalog gredo samo komadi
# vsebniki, v katere vstopimo (profil → albumi → komadi)
CONTAINER_HINT = re.compile(r'(tab|playlist|user|album|set|related|search)', re.I)


def _source(info):
    key = (info.get('ie_key') or info.get('extractor_key') or info.get('extractor') or 'web').split(':')[0]
    return key.lower().replace('youtubetab', 'youtube')


def split_artist(title, artist):
    """YouTube naslovi so pogosto "Izvajalec - Komad"."""
    if title and ' - ' in title and (not artist or artist.lower() in ('various artists', '')):
        a, t = title.split(' - ', 1)
        return t.strip(), a.strip()
    return title, artist


def meta(info):
    title = info.get('track') or info.get('title')
    artist = info.get('artist') or info.get('creator') or info.get('uploader') or info.get('channel')
    if not info.get('track'):
        title, artist = split_artist(title, artist)
    thumbs = info.get('thumbnails') or []
    return {
        'title': title,
        'artist': artist,
        'album': info.get('album'),
        'cover': info.get('thumbnail') or (thumbs[-1].get('url') if thumbs else None),
        'link': info.get('webpage_url') or info.get('original_url') or info.get('url'),
        'duration': info.get('duration'),
    }


def list_entries(url, limit=200, depth=0):
    """Vsi komadi za povezavo (profil, všečki, playlist, založba, album, iskanje ali en sam komad)."""
    with yt_dlp.YoutubeDL({**BASE, 'extract_flat': 'in_playlist', 'playlistend': limit}) as ydl:
        info = ydl.extract_info(url, download=False)
    if info.get('_type') not in ('playlist', 'multi_video') and 'entries' not in info:
        return [_entry(info, url)]
    out = []
    for e in info.get('entries') or []:
        if not e or len(out) >= limit:
            continue
        nested = e.get('_type') in ('url', 'url_transparent') and not e.get('duration') and CONTAINER_HINT.search(e.get('ie_key') or '')
        if nested and depth < 2 and e.get('url'):
            try:
                out += list_entries(e['url'], limit - len(out), depth + 1)
            except yt_dlp.utils.DownloadError:
                continue
        elif e.get('url') or e.get('webpage_url'):
            out.append(_entry(e, e.get('url') or e.get('webpage_url'), parent=info))
    return out[:limit]


def _entry(info, url, parent=None):
    m = meta(info)
    if parent and not m['artist']:
        m['artist'] = parent.get('uploader') or parent.get('artist')
    return {'source': _source(info if info.get('ie_key') or info.get('extractor_key') else parent or {}),
            'id': str(info.get('id') or url), 'url': info.get('webpage_url') or url, **m}


# YouTube pogosto zavrne prenos ("The page needs to be reloaded", "Sign in to confirm you're not a bot").
# Takrat poskusimo druge odjemalce in nazadnje piškotke iz brskalnika, v katerem je uporabnik prijavljen.
YOUTUBE_FALLBACKS = [
    {},
    {'extractor_args': {'youtube': {'player_client': ['tv', 'web_safari']}}},
    {'extractor_args': {'youtube': {'player_client': ['mweb', 'android_vr']}}},
    *({'cookiesfrombrowser': (browser,)} for browser in ('chrome', 'safari', 'firefox', 'brave', 'edge')),
]
YOUTUBE_HINT = ('YouTube blocked the download. Open youtube.com in Chrome or Safari while logged in and try again, '
                'or pick the same set on SoundCloud.')


def is_youtube(url):
    return bool(re.search(r'(youtube\.com|youtu\.be|ytsearch)', url or ''))


def _extract(url, opts, download):
    """extract_info z rezervnimi možnostmi za YouTube; vrne (info, pot ali None)."""
    variants = YOUTUBE_FALLBACKS if is_youtube(url) else [{}]
    first_error = None
    for extra in variants:
        try:
            with yt_dlp.YoutubeDL({**opts, **extra}) as ydl:
                info = ydl.extract_info(url, download=download)
                path = None
                if download and info is not None:
                    if info.get('requested_downloads'):
                        path = info['requested_downloads'][0]['filepath']
                    else:
                        path = ydl.prepare_filename(info)
                return info, path
        except Exception as e:  # noqa: BLE001 – brskalnik brez piškotkov ali zavrnjen odjemalec: naslednja možnost
            first_error = first_error or e
            if not is_youtube(url):
                raise
    raise RuntimeError(f'{YOUTUBE_HINT} ({first_error})')


def download(url, dest_dir, max_seconds=None):
    """Prenese zvok (najboljša zvočna kakovost) in vrne (pot, meta, source, id)."""
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    opts = {**BASE, 'format': 'bestaudio/best', 'noplaylist': True, 'outtmpl': str(Path(dest_dir) / '%(extractor)s-%(id)s.%(ext)s')}
    if max_seconds:
        opts['match_filter'] = yt_dlp.utils.match_filter_func([f'duration < {max_seconds}', '!duration'])
    info, path = _extract(url, opts, download=True)
    if info is None or not path or not Path(path).exists():
        raise ValueError('Predolgo za komad (verjetno miks) ali ni zvoka')
    return path, meta(info), _source(info), str(info.get('id'))


def is_link(text):
    return bool(re.match(r'(https?://|ytsearch\d*:|scsearch\d*:)', text.strip()))


def stream(url):
    """Sveža povezava do zvoka za predvajanje (povezave potečejo) in HTTP glave, ki jih potrebuje."""
    info, _ = _extract(url, {**BASE, 'format': 'bestaudio/best', 'noplaylist': True}, download=False)
    return info['url'], info.get('http_headers') or {}


def _thumb(e):
    thumbs = e.get('thumbnails') or []
    return e.get('thumbnail') or (thumbs[-1].get('url') if thumbs else None)


def search_sets(query, limit=12, min_seconds=MAX_TRACK_SECONDS):
    """DJ seti in miksi za iskalni niz z YouTuba in SoundClouda (vzporedno), najdaljši najprej v vsakem viru."""
    from concurrent.futures import ThreadPoolExecutor

    def run(prefix, q, n):
        try:
            with yt_dlp.YoutubeDL({**BASE, 'extract_flat': 'in_playlist'}) as ydl:
                info = ydl.extract_info(f'{prefix}{n}:{q}', download=False)
        except yt_dlp.utils.DownloadError:
            return []
        out = []
        for e in info.get('entries') or []:
            if not e or (e.get('duration') and e['duration'] < min_seconds):
                continue
            out.append({
                'title': e.get('title'),
                'artist': e.get('channel') or e.get('uploader'),
                'duration': e.get('duration'),
                'cover': _thumb(e),
                'url': e.get('webpage_url') or e.get('url'),
                'source': 'youtube' if prefix == 'ytsearch' else 'soundcloud',
            })
        return out

    with ThreadPoolExecutor(2) as ex:
        yt = ex.submit(run, 'ytsearch', f'{query} dj set', limit * 2)
        sc = ex.submit(run, 'scsearch', query, limit)
        results = yt.result()[:limit] + sc.result()[:max(4, limit // 2)]
    return [r for r in results if r['url']]
