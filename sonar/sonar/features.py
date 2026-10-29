"""Zvočni prstni odtis komada.

Vsak 30-sekundni izsek opišemo s ~140 števili v štirih skupinah, ki jih UI prikaže kot
"rhythm / bass / texture / atmosphere". Vektor je neodvisen od glasnosti in tonalitete,
tako da se podobni komadi najdejo tudi, če so v drugem ključu ali zmasterirani glasneje.
"""
import numpy as np
import librosa
from scipy.signal import find_peaks

from .audio import SR, clip_offsets, load

HOP = 512
N_FFT = 2048
EPS = 1e-10

FACET_SIZES = {'rhythm': 20, 'bass': 26, 'texture': 59, 'atmosphere': 18}
FACET_WEIGHTS = {'rhythm': 0.3, 'bass': 0.2, 'texture': 0.3, 'atmosphere': 0.2}
FACETS = {}
_start = 0
for _name, _size in FACET_SIZES.items():
    FACETS[_name] = slice(_start, _start + _size)
    _start += _size
DIM = _start

KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
# Krumhansl-Kessler profila za dur in mol
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def fold_bpm(bpm):
    """Plesna glasba je skoraj vedno med 85 in 175 BPM; polovične/dvojne ocene prepognemo."""
    if not bpm or not np.isfinite(bpm):
        return 0.0
    while bpm < 85:
        bpm *= 2
    while bpm > 175:
        bpm /= 2
    return float(bpm)


def _beat_lags(env, period, steps=16):
    """Avtokorelacija ovojnice na šestnajstinkah takta – vzorec groova, neodvisen od tempa."""
    env = env - env.mean()
    ac = librosa.autocorrelate(env, max_size=int(period * 4.5) + 2)
    ac = ac / (ac[0] + EPS)
    lags = period * np.arange(1, steps + 1) / 4
    return np.interp(lags, np.arange(len(ac)), ac)


def clip_features(y, sr=SR):
    """Vrne (vektor dolžine DIM, bpm, povprečna kroma) za en izsek."""
    if len(y) < sr * 4:
        y = np.pad(y, (0, sr * 4 - len(y)))
    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP))
    power = S ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
    nyq = sr / 2
    logmel = librosa.power_to_db(librosa.feature.melspectrogram(S=power, sr=sr, n_mels=64), ref=np.max)
    H, P = librosa.decompose.hpss(S, kernel_size=17)

    # rhythm
    onset = librosa.onset.onset_strength(S=logmel, sr=sr)
    bpm = fold_bpm(librosa.feature.tempo(onset_envelope=onset, sr=sr, hop_length=HOP, start_bpm=125, std_bpm=2)[0])
    period = 60 / (bpm or 120) * sr / HOP
    groove = _beat_lags(onset, period)
    perc_ratio = P.sum() / (H.sum() + P.sum() + EPS)
    # vrhovi ovojnice namesto librosa.onset.onset_detect (ta gre skozi numbo, ki se na nekaterih različicah sesuje)
    onsets, _ = find_peaks(onset, height=onset.mean() + 0.5 * onset.std(), distance=3)
    density = len(onsets) / (len(y) / sr)
    rhythm = np.concatenate([groove, [np.log2((bpm or 120) / 120), perc_ratio, np.log1p(density), onset.std() / (onset.mean() + EPS)]])

    # bass
    tot = power.sum(0) + EPS
    low_bands = [(20, 60), (60, 150), (150, 400)]
    ratios = np.array([power[(freqs >= lo) & (freqs < hi)].sum(0) / tot for lo, hi in low_bands])
    low_env = power[freqs < 150].sum(0)
    bass_groove = _beat_lags(np.log1p(low_env / (low_env.mean() + EPS)), period, steps=8)
    low_mel = logmel[:12].mean(1) - logmel.mean()
    bass = np.concatenate([np.log(ratios.mean(1) + 1e-6), ratios.std(1) / (ratios.mean(1) + EPS), low_mel, bass_groove])

    # texture
    mfcc = librosa.feature.mfcc(S=logmel, n_mfcc=20)[1:]
    contrast = librosa.feature.spectral_contrast(S=S, sr=sr)
    flat = np.log(librosa.feature.spectral_flatness(S=S) + EPS)
    cent = librosa.feature.spectral_centroid(S=S, sr=sr) / nyq
    bw = librosa.feature.spectral_bandwidth(S=S, sr=sr) / nyq
    roll = librosa.feature.spectral_rolloff(S=S, sr=sr) / nyq
    zcr = np.mean(np.signbit(y[1:]) != np.signbit(y[:-1]))
    texture = np.concatenate([
        mfcc.mean(1), mfcc.std(1), contrast.mean(1), contrast.std(1),
        [flat.mean(), flat.std(), cent.mean(), cent.std(), bw.mean(), roll.mean(), zcr.mean()],
    ])

    # atmosphere
    chroma = librosa.feature.chroma_stft(S=H ** 2, sr=sr).mean(1)
    cm = chroma / (chroma.sum() + EPS)
    entropy = -(cm * np.log(cm + EPS)).sum()
    maj = max(np.corrcoef(np.roll(MAJOR, k), cm)[0, 1] for k in range(12))
    minr = max(np.corrcoef(np.roll(MINOR, k), cm)[0, 1] for k in range(12))
    rms_db = 20 * np.log10(librosa.feature.rms(S=S, frame_length=N_FFT) + 1e-6)
    air = logmel[48:].mean() - logmel.mean()
    atmosphere = np.concatenate([np.sort(cm)[::-1], [entropy, maj, minr, rms_db.std(), rms_db.max() - rms_db.mean(), air]])

    vec = np.nan_to_num(np.concatenate([rhythm, bass, texture, atmosphere])).astype(np.float32)
    assert vec.shape == (DIM,), vec.shape
    return vec, bpm, chroma


def estimate_key(chroma):
    """Ključ in Camelot oznaka iz povprečne krome."""
    if chroma is None or not np.any(chroma):
        return None, None
    best = max(
        ((np.corrcoef(np.roll(prof, k), chroma)[0, 1], k, mode) for mode, prof in (('maj', MAJOR), ('min', MINOR)) for k in range(12)),
    )
    _, pc, mode = best
    if mode == 'maj':
        return KEYS[pc], f'{((pc * 7) % 12 + 7) % 12 + 1}B'
    return KEYS[pc] + 'm', f'{((pc * 7) % 12 + 4) % 12 + 1}A'


def combine(parts):
    """Združi rezultate več izsekov istega komada."""
    vecs, bpms, chromas = zip(*parts)
    bpms = [b for b in bpms if b]
    key, camelot = estimate_key(np.mean(chromas, axis=0))
    return {
        'vec': np.mean(vecs, axis=0).astype(np.float32),
        'bpm': round(float(np.median(bpms)), 1) if bpms else None,
        'key': key,
        'camelot': camelot,
    }


def analyze_file(path, duration=None, clips=3, clip_len=30.0):
    """Prstni odtis celega komada: povprečje izsekov iz sredine skladbe."""
    if duration is None:
        from .audio import probe
        duration = probe(path)['duration']
    parts = []
    for off in clip_offsets(duration, clip_len, clips):
        y = load(path, off, clip_len)
        if len(y) > SR:
            parts.append(clip_features(y))
    if not parts:
        raise ValueError(f'Ne morem prebrati zvoka: {path}')
    return combine(parts)
