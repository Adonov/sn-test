"""Branje zvoka prek ffmpeg (mp3, wav, flac, aiff, m4a, ogg … in tudi video datoteke)."""
import json
import subprocess

import numpy as np

SR = 22050
AUDIO_EXTS = {'.mp3', '.wav', '.flac', '.aiff', '.aif', '.m4a', '.aac', '.ogg', '.opus', '.wma', '.alac', '.mp4', '.webm'}


def probe(path):
    """Vrne trajanje (s) in oznake (title, artist, album) datoteke."""
    out = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', str(path)],
        capture_output=True, check=True,
    ).stdout
    fmt = json.loads(out or b'{}').get('format', {})
    tags = {k.lower(): v for k, v in (fmt.get('tags') or {}).items()}
    return {
        'duration': float(fmt.get('duration') or 0),
        'title': tags.get('title'),
        'artist': tags.get('artist') or tags.get('album_artist'),
        'album': tags.get('album'),
    }


def load(path, offset=0.0, duration=None, sr=SR):
    """Prebere del datoteke kot mono float32 pri danem vzorčenju."""
    cmd = ['ffmpeg', '-v', 'quiet', '-nostdin']
    if offset:
        cmd += ['-ss', f'{offset:.3f}']
    cmd += ['-i', str(path)]
    if duration:
        cmd += ['-t', f'{duration:.3f}']
    cmd += ['-vn', '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def clip_offsets(total, clip=30.0, count=3):
    """Odmiki izsekov za analizo komada: sredina skladbe, ne intro in outro."""
    if total <= clip * 1.5:
        return [0.0]
    return [max(0.0, total * f - clip / 2) for f in np.linspace(0.3, 0.7, count)]


def cover(path):
    """Vgrajena naslovnica (jpg/png) iz oznak datoteke ali None."""
    res = subprocess.run(
        ['ffmpeg', '-v', 'quiet', '-nostdin', '-i', str(path), '-an', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', '-'],
        capture_output=True,
    )
    return res.stdout or None
