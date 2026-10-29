"""Glasba s spletnih platform prek yt-dlp: SoundCloud, YouTube, Bandcamp, Mixcloud, Beatport, Audiomack …"""
import re
from pathlib import Path

import yt_dlp

BASE = {'quiet': True, 'no_warnings': True, 'noprogress': True, 'socket_timeout': 30, 'ignoreerrors': False}
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


def download(url, dest_dir, max_seconds=None):
    """Prenese zvok (najboljša zvočna kakovost) in vrne (pot, meta, source, id)."""
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    opts = {**BASE, 'format': 'bestaudio/best', 'noplaylist': True, 'outtmpl': str(Path(dest_dir) / '%(extractor)s-%(id)s.%(ext)s')}
    if max_seconds:
        opts['match_filter'] = yt_dlp.utils.match_filter_func([f'duration < {max_seconds}', '!duration'])
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None or not info.get('requested_downloads'):
            path = ydl.prepare_filename(info) if info else None
            if not path or not Path(path).exists():
                raise ValueError('Predolgo za komad (verjetno miks) ali ni zvoka')
        else:
            path = info['requested_downloads'][0]['filepath']
    return path, meta(info), _source(info), str(info.get('id'))


def is_link(text):
    return bool(re.match(r'(https?://|ytsearch\d*:|scsearch\d*:)', text.strip()))


def stream(url):
    """Sveža povezava do zvoka za predvajanje (povezave potečejo) in HTTP glave, ki jih potrebuje."""
    with yt_dlp.YoutubeDL({**BASE, 'format': 'bestaudio/best', 'noplaylist': True}) as ydl:
        info = ydl.extract_info(url, download=False)
    return info['url'], info.get('http_headers') or {}
