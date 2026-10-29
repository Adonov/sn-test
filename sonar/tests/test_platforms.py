"""Povezane zbirke in povezave. Pravih platform ni na voljo, zato zvok streže lokalni strežnik
(yt-dlp ga prebere kot navadno povezavo), API-je Bandcampa in Discogsa pa ponaredimo."""
import functools
import http.server
import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

from sonar import collections, jobs
from sonar.jobs import classify, connection_url
from sonar.library import Library
from sonar.server import create_app
from synth import make_track, write


def wait_job(client, jid, timeout=180):
    end = time.time() + timeout
    while time.time() < end:
        job = next(j for j in client.get('/api/jobs').json() if j['id'] == jid)
        if job['status'] not in ('queued', 'running'):
            return job
        time.sleep(0.3)
    raise TimeoutError


@pytest.fixture
def site(tmp_path):
    styles = ['house', 'techno', 'dnb', 'house']
    for i, style in enumerate(styles):
        write(tmp_path / f'{i}.wav', make_track(style, seed=40 + i, seconds=40))
    write(tmp_path / 'set.wav', make_track('techno', seed=7, seconds=60))
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(tmp_path))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{httpd.server_address[1]}'
    httpd.shutdown()


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(Library(tmp_path / 'home')))


def test_classify_lines():
    assert classify('https://soundcloud.com/rinsefm/likes') == ('link', 'url', 'https://soundcloud.com/rinsefm/likes')
    assert classify('https://perlon.bandcamp.com')[0] == 'link'
    assert classify('https://www.deezer.com/playlist/123') == ('deezer', 'playlist', '123')
    assert classify('Octave') == ('deezer', 'artist', 'Octave')
    assert classify('Octave', 'soundcloud', 15) == ('link', 'url', 'scsearch15:Octave')
    assert classify('q:minimal house', 'youtube') == ('link', 'url', 'ytsearch10:minimal house')
    assert classify('label:Perlon', 'youtube') == ('deezer', 'label', 'Perlon')


def test_connection_urls():
    assert connection_url('soundcloud', '@adnan') == 'https://soundcloud.com/adnan/likes'
    assert connection_url('mixcloud', 'adnan') == 'https://www.mixcloud.com/adnan/favorites/'
    assert connection_url('youtube', 'https://youtube.com/playlist?list=X') == 'https://youtube.com/playlist?list=X'


def test_links_go_into_catalog_and_play(site, client):
    job = client.post('/api/import/sources', json={'lines': [f'{site}/{i}.wav' for i in range(4)]}).json()
    job = wait_job(client, job['id'])
    assert job['status'] == 'done' and job['added'] == 4, (job['failed'], job['errors'], job['done'], job['message'])
    tracks = client.get('/api/tracks').json()
    assert {t['source'] for t in tracks} == {'generic'} and all(t['streamed'] for t in tracks)
    # podobnost deluje tudi za komade s povezav
    house = next(t for t in tracks if t['link'].endswith('/0.wav'))
    res = client.get(f'/api/tracks/{house["id"]}/similar').json()['results']
    assert res[0]['link'].endswith('/3.wav')
    # predvajanje gre skozi ffmpeg pretok
    audio = client.get(f'/api/tracks/{house["id"]}/audio', params={'start': 5})
    assert audio.status_code == 200 and audio.headers['content-type'] == 'audio/mpeg' and len(audio.content) > 10000


def test_bandcamp_collection_is_owned(site, client, monkeypatch):
    items = [{'url': f'{site}/{i}.wav', 'artist': 'Octave', 'title': f'LP {i}', 'cover': 'http://img/a.jpg'} for i in range(2)]
    monkeypatch.setattr(collections, 'bandcamp_collection', lambda handle, limit: items)
    job = client.post('/api/connections/bandcamp', json={'handle': 'adnan'}).json()
    job = wait_job(client, job['id'])
    assert job['status'] == 'done' and job['added'] == 2, job
    owned = client.get('/api/tracks', params={'owned': True}).json()
    assert len(owned) == 2 and all(t['owned'] for t in owned)
    assert {t['artist'] for t in owned} == {'Octave'} and owned[0]['cover'] == 'http://img/a.jpg'
    conns = {c['platform']: c for c in client.get('/api/connections').json()}
    assert conns['bandcamp']['handle'] == 'adnan' and conns['soundcloud']['handle'] is None
    client.delete('/api/connections/bandcamp')
    assert {c['platform']: c for c in client.get('/api/connections').json()}['bandcamp']['handle'] is None


def test_discogs_collection_uses_release_videos(site, client, monkeypatch):
    class FakeDiscogs:
        def __init__(self, token=None):
            self.token = token

        def releases(self, username, limit):
            return [{'id': 1, 'title': 'Untitled', 'artist': 'Octave', 'cover': 'http://img/d.jpg'}]

        def videos(self, release_id):
            return [f'{site}/1.wav', f'{site}/2.wav']

    monkeypatch.setattr(collections, 'Discogs', FakeDiscogs)
    client.post('/api/settings', json={'discogs_token': 'secret'})
    assert client.get('/api/settings').json() == {'discogs_token': True}
    job = wait_job(client, client.post('/api/connections/discogs', json={'handle': 'adnan'}).json()['id'])
    assert job['status'] == 'done' and job['added'] == 2, job
    owned = client.get('/api/tracks', params={'owned': True}).json()
    assert {t['album'] for t in owned} == {'Untitled'}


def test_analyze_link(site, client):
    a = client.post('/api/analyses/link', json={'url': f'{site}/set.wav'}).json()
    end = time.time() + 120
    while (a := client.get(f'/api/analyses/{a["id"]}').json())['status'] in ('queued', 'running', 'pending') and time.time() < end:
        time.sleep(0.3)
    assert a['status'] == 'done' and a['kind'] == 'track' and a['name'] == 'set', a


def test_bandcamp_fan_api():
    page = '<div id="pagedata" data-blob="' + json.dumps({'fan_data': {'fan_id': 42}}).replace('"', '&quot;') + '"></div>'
    pages = [
        {'items': [{'item_url': 'https://x.bandcamp.com/album/a', 'band_name': 'X', 'item_title': 'A', 'item_art_id': 5}],
         'more_available': True, 'last_token': 't2'},
        {'items': [{'item_url': 'https://y.bandcamp.com/track/b', 'band_name': 'Y', 'item_title': 'B'}], 'more_available': False},
    ]
    posts = []

    class Res:
        def __init__(self, text='', data=None, status=200):
            self.text, self.data, self.status_code = text, data, status

        def raise_for_status(self):
            pass

        def json(self):
            return self.data

    class Http:
        def get(self, url, **kw):
            return Res(page)

        def post(self, url, json=None, **kw):
            posts.append(json)
            return Res(data=pages[len(posts) - 1])

    items = collections.bandcamp_collection('adnan', http=Http())
    assert [i['url'] for i in items] == ['https://x.bandcamp.com/album/a', 'https://y.bandcamp.com/track/b']
    assert items[0]['cover'] == 'https://f4.bcbits.com/img/a5_10.jpg'
    assert posts[0]['fan_id'] == 42 and posts[1]['older_than_token'] == 't2'
