"""Sintetični "komadi" v različnih slogih za teste (pravih posnetkov v repozitoriju ni)."""
import numpy as np
import soundfile as sf

SR = 22050

STYLES = {
    # bpm, kick (16 korakov), hi-hat, bas (valovna oblika, vzorec), pad, šum
    'techno': dict(bpm=130, kick='x...x...x...x...', hat='..x...x...x...x.', bass=('saw', 'x.x.x.x.x.x.x.x.'), pad=0.0, noise=0.02),
    'house': dict(bpm=123, kick='x...x...x...x...', hat='..x...x...x...xx', bass=('sine', '...x..x....x..x.'), pad=0.25, noise=0.01),
    'dnb': dict(bpm=172, kick='x.........x.....', hat='x.x.x.x.x.x.x.x.', bass=('sine', 'x.......x.......'), pad=0.1, noise=0.03),
    'ambient': dict(bpm=90, kick='................', hat='................', bass=('sine', 'x...............'), pad=0.6, noise=0.005),
    'breaks': dict(bpm=135, kick='x.....x...x.....', hat='x.xxx.x.x.xxx.x.', bass=('saw', 'x..x..x...x..x..'), pad=0.0, noise=0.04),
}


def _env(n, decay):
    return np.exp(-np.arange(n) / (decay * SR))


def make_track(style, seed, seconds=40):
    st = STYLES[style]
    rng = np.random.default_rng(seed)
    bpm = st['bpm'] * rng.uniform(0.98, 1.02)
    root = 55 * 2 ** (rng.integers(0, 12) / 12)
    step = int(SR * 60 / bpm / 4)
    n = int(seconds * SR)
    y = np.zeros(n + SR)
    kick = np.sin(2 * np.pi * np.cumsum(np.linspace(150, 45, step * 2)) / SR) * _env(step * 2, 0.08)
    hat = rng.standard_normal(step) * _env(step, 0.015) * 0.3
    hat = np.diff(hat, prepend=0)
    wave, bpat = st['bass']
    t = np.arange(step * 2) / SR
    bnote = (np.sin(2 * np.pi * root * t) if wave == 'sine' else 2 * ((root * t) % 1) - 1) * _env(step * 2, 0.12) * 0.5
    for i, pos in enumerate(range(0, n, step)):
        s = i % 16
        if st['kick'][s] == 'x':
            y[pos:pos + len(kick)] += kick
        if st['hat'][s] == 'x':
            y[pos:pos + len(hat)] += hat * rng.uniform(0.7, 1)
        if bpat[s] == 'x':
            y[pos:pos + len(bnote)] += bnote
    if st['pad']:
        tt = np.arange(len(y)) / SR
        chord = sum(np.sin(2 * np.pi * root * 4 * r * tt + rng.uniform(0, 6)) for r in (1, 1.26, 1.5, 1.89))
        y += st['pad'] * chord / 4 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.1 * tt))
    y += st['noise'] * rng.standard_normal(len(y))
    y = y[:n]
    return (y / (np.abs(y).max() + 1e-9) * rng.uniform(0.5, 0.9)).astype(np.float32)


def write(path, y):
    sf.write(str(path), y, SR)
