"""Zajem z Deezerja s ponarejenim API-jem; predposlušanja streže lokalni HTTP strežnik."""
import functools
import http.server
import threading
import time

import pytest

from digdeeper import deezer
from digdeeper.deezer import parse_seed
from digdeeper.jobs import Jobs
from digdeeper.library import Library
from synth import make_track, write


def test_parse_seed():
    assert parse_seed('https://www.deezer.com/si/playlist/908622995') == ('playlist', '908622995')
    assert parse_seed('https://www.deezer.com/artist/27') == ('artist', '27')
    assert parse_seed('label: Innervisions') == ('label', 'Innervisions')
    assert parse_seed('q:minimal house') == ('q', 'minimal house')
    assert parse_seed('Octave') == ('artist', 'Octave')


@pytest.fixture
def preview_server(tmp_path):
    for i, style in enumerate(['house', 'techno', 'dnb', 'house', 'techno', 'dnb']):
        write(tmp_path / f'{i}.wav', make_track(style, seed=i, seconds=30))
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(tmp_path))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{httpd.server_address[1]}'
    httpd.shutdown()


def test_crawl_follows_related_artists(tmp_path, preview_server, monkeypatch):
    def track(i, artist):
        return {'id': 100 + i, 'title': f'T{i}', 'preview': f'{preview_server}/{i}.wav', 'duration': 300,
                'artist': artist, 'album': {'title': 'LP', 'cover_medium': 'http://img/x.jpg'}, 'readable': True}

    a1, a2 = {'id': 1, 'name': 'Octave'}, {'id': 2, 'name': 'Related One'}
    responses = {
        '/search/artist': {'data': [a1]},
        '/artist/1/top': {'data': [track(0, a1), track(1, a1), track(2, a1)]},
        '/artist/1/related': {'data': [a2]},
        '/artist/2/top': {'data': [track(3, a2), track(4, a2), track(5, a2), {**track(9, a2), 'preview': ''}]},
        '/artist/2/related': {'data': [a1]},
    }
    calls = []

    def fake_get(self, path, **params):
        calls.append(path)
        return responses[path]

    monkeypatch.setattr(deezer.Deezer, 'get', fake_get)
    lib = Library(tmp_path / 'home')
    job = Jobs(lib).crawl_deezer(['Octave'], max_tracks=5, per_artist=10)
    end = time.time() + 120
    while job['status'] in ('queued', 'running') and time.time() < end:
        time.sleep(0.2)
    assert job['status'] == 'done', job
    assert job['added'] == 5 and job['failed'] == 0
    assert lib.counts()['by_source'] == {'deezer': 5}
    t = lib.find_tracks('T0')[0]
    assert (t['artist'], t['album'], t['cover'], t['source_id']) == ('Octave', 'LP', 'http://img/x.jpg', '100')
    assert '/artist/2/top' in calls

    # drugi zagon ne doda že znanih komadov
    job = Jobs(lib).crawl_deezer(['Octave'], max_tracks=50, per_artist=10)
    while job['status'] in ('queued', 'running'):
        time.sleep(0.2)
    assert job['status'] == 'done' and job['added'] == 1
