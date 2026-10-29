"""Celoten tok: uvoz mape → iskanje podobnih → naložen komad → razrez seta."""
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient

from sonar.features import estimate_key
from sonar.library import Library
from sonar.server import create_app
from synth import STYLES, make_track, write


def wait(get, timeout=300):
    end = time.time() + timeout
    while time.time() < end:
        x = get()
        if x['status'] in ('done', 'error', 'cancelled'):
            return x
        time.sleep(0.3)
    raise TimeoutError


@pytest.fixture(scope='module')
def env(tmp_path_factory):
    root = tmp_path_factory.mktemp('dd')
    music = root / 'music'
    music.mkdir()
    for style in STYLES:
        for v in range(5):
            write(music / f'{style}-{v}.wav', make_track(style, seed=hash((style, v)) % 10000))
    lib = Library(root / 'home')
    client = TestClient(create_app(lib))
    job = client.post('/api/import/folder', json={'path': str(music)}).json()
    job = wait(lambda: next(j for j in client.get('/api/jobs').json() if j['id'] == job['id']))
    assert job['status'] == 'done', job
    assert job['added'] == len(STYLES) * 5
    return root, lib, client


def style_of(t):
    return t['title'].split('-')[0]


def test_similar_tracks_share_style(env):
    _, lib, client = env
    hits_same = 0
    tracks = client.get('/api/tracks', params={'limit': 100}).json()
    for t in tracks:
        res = client.get(f'/api/tracks/{t["id"]}/similar', params={'k': 4}).json()['results']
        assert all(r['id'] != t['id'] for r in res)
        hits_same += sum(style_of(r) == style_of(t) for r in res)
        assert set(res[0]['facets']) == {'rhythm', 'bass', 'texture', 'atmosphere'}
    precision = hits_same / (len(tracks) * 4)
    print('precision@4', precision)
    assert precision > 0.8


def test_upload_track(env):
    root, lib, client = env
    path = root / 'query.wav'
    write(path, make_track('dnb', seed=99999))
    with open(path, 'rb') as f:
        a = client.post('/api/analyses', files={'file': ('query.wav', f, 'audio/wav')}).json()
    a = wait(lambda: client.get(f'/api/analyses/{a["id"]}').json())
    assert a['status'] == 'done' and a['kind'] == 'track', a
    assert 160 < a['bpm'] < 180, a['bpm']
    res = client.get(f'/api/analyses/{a["id"]}/similar', params={'k': 5}).json()['results']
    assert sum(style_of(r) == 'dnb' for r in res) >= 4


def test_set_is_cut_into_passages(env):
    root, lib, client = env
    order = ['house', 'techno', 'ambient']
    y = np.concatenate([make_track(s, seed=500 + i, seconds=300) for i, s in enumerate(order)])
    path = root / 'set.wav'
    write(path, y)
    with open(path, 'rb') as f:
        a = client.post('/api/analyses', files={'file': ('my set.wav', f, 'audio/wav')}).json()
    a = wait(lambda: client.get(f'/api/analyses/{a["id"]}').json())
    assert a['status'] == 'done' and a['kind'] == 'set', a
    ps = a['passages']
    assert len(ps) == 3
    for p, boundary in zip(ps[1:], (300, 600)):
        assert abs(p['start'] - boundary) <= 30, ps
    tl = client.get(f'/api/analyses/{a["id"]}/tracklist').json()
    assert [style_of(p['matches'][0]) for p in tl] == order
    assert client.get(f'/api/analyses/{a["id"]}/similar-sets').json() == []


def test_likes_and_playlists(env):
    _, lib, client = env
    t = client.get('/api/tracks').json()[0]
    assert client.post(f'/api/tracks/{t["id"]}', json={'liked': True}).json()['liked'] == 1
    assert [x['id'] for x in client.get('/api/tracks', params={'liked': True}).json()] == [t['id']]
    pid = client.post('/api/playlists', json={'name': 'Peak time'}).json()['id']
    client.post(f'/api/playlists/{pid}/tracks', json={'track_id': t['id']})
    assert client.get(f'/api/playlists/{pid}').json()['tracks'][0]['id'] == t['id']
    m3u = client.get(f'/api/playlists/{pid}/export.m3u').text
    assert m3u.startswith('#EXTM3U') and t['title'] in m3u and '.wav' in m3u


def test_camelot():
    major_c = np.array([1, 0, 0.2, 0, 0.8, 0.6, 0, 0.9, 0, 0.3, 0, 0.2])
    assert estimate_key(major_c) == ('C', '8B')
    assert estimate_key(np.roll(major_c, 9)) == ('A', '11B')
