"""Zaščita pred sesutji, ki so se zgodila na pravih računalnikih."""
import importlib
import os

import pytest

from sonar import jobs
from sonar.features import clip_features
from synth import STYLES, make_track

NUMBA_MODULES = ['librosa.util.utils', 'librosa.util.matching', 'librosa.filters', 'librosa.feature.utils',
                 'librosa.sequence', 'librosa.beat', 'librosa.core.notation', 'librosa.core.audio',
                 'librosa.core.pitch', 'librosa.core.spectrum', 'librosa.core.constantq']


def test_analysis_never_calls_numba(monkeypatch):
    """Numba funkcije v librosi se na nekaterih različicah (numba 0.68, Apple M) sesujejo."""
    called = set()
    for name in NUMBA_MODULES:
        mod = importlib.import_module(name)
        for attr, obj in list(vars(mod).items()):
            if type(obj).__module__.startswith('numba'):
                def spy(*a, _o=obj, _n=f'{name}.{attr}', **k):
                    called.add(_n)
                    return _o(*a, **k)
                monkeypatch.setattr(mod, attr, spy)
    clip_features(make_track('house', 1, 30))
    assert called == set()


@pytest.mark.parametrize('style', ['techno', 'house'])
def test_bpm_estimate(style):
    bpm = clip_features(make_track(style, 2, 30))[1]
    assert abs(bpm - STYLES[style]['bpm']) < 3


def test_pool_recovers_after_a_crash():
    with pytest.raises(Exception):
        jobs.pool().submit(os._exit, 1).result()
    assert jobs.pool().submit(abs, -3).result() == 3
