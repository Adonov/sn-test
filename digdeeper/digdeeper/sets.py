"""Razrez DJ seta na odseke (passages) – približno po en komad na odsek."""
import numpy as np

from .features import FACETS, FACET_WEIGHTS, combine


def window_starts(duration, window=30.0):
    """Začetki 30-sekundnih oken čez cel set (zadnje okno mora imeti vsaj 10 s)."""
    return [float(s) for s in np.arange(0, max(duration - 10, 1), window)]


def segment(Z, n_segments):
    """Sosednja okna združujemo (Ward), dokler ne ostane n_segments odsekov.

    Z so normalizirani vektorji oken po vrsti. Vrne seznam (začetni_indeks, končni_indeks_izključno).
    """
    w = np.concatenate([np.sqrt(FACET_WEIGHTS[n]) * Z[:, sl] for n, sl in FACETS.items()], axis=1)
    segs = [[i, i + 1, w[i].copy()] for i in range(len(w))]
    while len(segs) > max(1, n_segments):
        costs = [
            (a[1] - a[0]) * (b[1] - b[0]) / (b[1] - a[0]) * np.sum((a[2] - b[2]) ** 2)
            for a, b in zip(segs, segs[1:])
        ]
        j = int(np.argmin(costs))
        a, b = segs[j], segs[j + 1]
        na, nb = a[1] - a[0], b[1] - b[0]
        segs[j] = [a[0], b[1], (a[2] * na + b[2] * nb) / (na + nb)]
        del segs[j + 1]
    return [(s[0], s[1]) for s in segs]


def passages(starts, window_results, duration, normalize, track_len=300.0):
    """Iz rezultatov oken (vec, bpm, chroma) sestavi odseke s časi in prstnim odtisom."""
    raw = np.stack([r[0] for r in window_results])
    n = max(1, int(round(duration / track_len)))
    out = []
    for a, b in segment(normalize(raw), n):
        c = combine(window_results[a:b])
        out.append({
            'start': starts[a],
            'end': min(duration, starts[b - 1] + (starts[1] - starts[0] if len(starts) > 1 else duration)),
            'vec': c['vec'].tolist(),
            'bpm': c['bpm'],
            'key': c['key'],
            'camelot': c['camelot'],
        })
    return out
