"""Katalog komadov (SQLite) in iskanje najbližjih po zvoku (numpy, v pomnilniku)."""
import json
import os
import re
import sqlite3
import threading
import time
from pathlib import Path

import numpy as np

from .features import DIM, FACETS, FACET_WEIGHTS

HOME = Path(os.environ.get('SONAR_HOME', Path.home() / '.sonar'))

SCHEMA = '''
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT, artist TEXT, album TEXT, cover TEXT, link TEXT, path TEXT,
  duration REAL, bpm REAL, key TEXT, camelot TEXT,
  vec BLOB NOT NULL,
  liked INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  added_at REAL NOT NULL,
  UNIQUE (source, source_id)
);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT, path TEXT, duration REAL, bpm REAL, key TEXT, camelot TEXT,
  data TEXT,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  error TEXT,
  created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  pos REAL NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);
'''

TRACK_COLS = 'id, source, source_id, title, artist, album, cover, link, path, duration, bpm, key, camelot, liked, saved, owned, added_at'


def _norm_name(s):
    return re.sub(r'[^a-z0-9]+', '', (s or '').lower())


class Library:
    def __init__(self, home=HOME):
        self.home = Path(home)
        self.home.mkdir(parents=True, exist_ok=True)
        (self.home / 'uploads').mkdir(exist_ok=True)
        self.lock = threading.RLock()
        self._local = threading.local()
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript(SCHEMA)
        cols = {r[1] for r in self.db.execute('PRAGMA table_info(tracks)')}
        if 'owned' not in cols:  # katalogi iz prejšnje različice
            self.db.execute('ALTER TABLE tracks ADD COLUMN owned INTEGER NOT NULL DEFAULT 0')
        # analize, ki so bile prekinjene ob zaustavitvi strežnika
        self.db.execute("UPDATE analyses SET status='error', error='Prekinjeno' WHERE status IN ('queued', 'running')")
        self.db.commit()
        self._load_index()

    @property
    def db(self):
        """Vsaka nit (spletni zahtevki, opravila v ozadju) ima svojo povezavo do baze."""
        conn = getattr(self._local, 'conn', None)
        if conn is None:
            conn = sqlite3.connect(self.home / 'sonar.db', timeout=30)
            conn.row_factory = sqlite3.Row
            conn.execute('PRAGMA foreign_keys=ON')
            self._local.conn = conn
        return conn

    # ---------- indeks ----------

    def _load_index(self):
        rows = self.db.execute('SELECT id, bpm, vec FROM tracks ORDER BY id').fetchall()
        self.ids = np.array([r['id'] for r in rows], dtype=np.int64)
        self.bpms = np.array([r['bpm'] or 0 for r in rows], dtype=np.float32)
        self.raw = np.stack([np.frombuffer(r['vec'], dtype=np.float32) for r in rows]) if rows else np.zeros((0, DIM), np.float32)
        self._Z = None

    def _stats(self):
        if len(self.raw) >= 2:
            mean = self.raw.mean(0)
            std = self.raw.std(0)
            return mean, np.maximum(std, 1e-3 * (np.abs(mean) + 1))
        return np.zeros(DIM, np.float32), np.ones(DIM, np.float32)

    def normalize(self, X, stats=None):
        """z-normalizacija po katalogu, nato vsaka skupina (rhythm, bass …) na enotsko dolžino."""
        mean, std = stats or self._stats()
        Z = (np.atleast_2d(X) - mean) / std
        for sl in FACETS.values():
            Z[:, sl] /= np.linalg.norm(Z[:, sl], axis=1, keepdims=True) + 1e-9
        return Z.astype(np.float32)

    def _matrix(self):
        with self.lock:
            if self._Z is None:
                self._stats_cache = self._stats()
                self._Z = self.normalize(self.raw, self._stats_cache)
            return self._Z, self._stats_cache

    def search(self, vec, k=100, exclude_ids=(), bpm=None, bpm_tol=None, exclude_names=()):
        """Najbližji komadi. Vrne seznam dict(id, score, match, facets)."""
        with self.lock:
            Z, stats = self._matrix()
            ids, bpms = self.ids, self.bpms
        if not len(ids):
            return []
        q = self.normalize(np.asarray(vec, np.float32), stats)[0]
        facet_sims = {name: Z[:, sl] @ q[sl] for name, sl in FACETS.items()}
        score = sum(FACET_WEIGHTS[n] * s for n, s in facet_sims.items())
        mask = ~np.isin(ids, list(exclude_ids))
        if bpm and bpm_tol:
            # dovolimo tudi polovični in dvojni tempo (half-time / double-time)
            ok = np.zeros(len(ids), bool)
            for mult in (0.5, 1, 2):
                ok |= np.abs(bpms * mult - bpm) <= bpm * bpm_tol / 100
            mask &= ok
        score = np.where(mask, score, -np.inf)
        n = min(len(ids), k * 2 + len(exclude_names) + 10)
        top = np.argpartition(-score, n - 1)[:n] if n < len(ids) else np.arange(len(ids))
        top = top[np.argsort(-score[top])]
        out, seen = [], set(exclude_names)
        names = self._names([int(ids[i]) for i in top])
        for i in top:
            if not np.isfinite(score[i]):
                break
            tid = int(ids[i])
            if names.get(tid) in seen:
                continue  # isti komad z drugega vira ali druga izdaja
            seen.add(names.get(tid))
            out.append({
                'id': tid,
                'score': float(score[i]),
                'match': to_pct(score[i]),
                'facets': {n: to_pct(s[i]) for n, s in facet_sims.items()},
            })
            if len(out) >= k:
                break
        return out

    def _names(self, ids):
        if not ids:
            return {}
        rows = self.db.execute(f'SELECT id, artist, title FROM tracks WHERE id IN ({",".join("?" * len(ids))})', ids).fetchall()
        return {r['id']: _norm_name(r['artist']) + '|' + _norm_name(r['title']) for r in rows}

    # ---------- komadi ----------

    def find_id(self, source, source_id):
        row = self.db.execute('SELECT id FROM tracks WHERE source=? AND source_id=?', (source, str(source_id))).fetchone()
        return row[0] if row else None

    def has(self, source, source_id):
        return self.db.execute('SELECT 1 FROM tracks WHERE source=? AND source_id=?', (source, str(source_id))).fetchone() is not None

    def add_track(self, source, source_id, vec, **meta):
        vec = np.asarray(vec, np.float32)
        cols = ['title', 'artist', 'album', 'cover', 'link', 'path', 'duration', 'bpm', 'key', 'camelot']
        vals = [meta.get(c) for c in cols]
        with self.lock:
            cur = self.db.execute(
                f'INSERT INTO tracks (source, source_id, {", ".join(cols)}, vec, owned, added_at) VALUES (?, ?, {", ".join("?" * len(cols))}, ?, ?, ?) '
                f'ON CONFLICT(source, source_id) DO UPDATE SET {", ".join(f"{c}=excluded.{c}" for c in cols)}, vec=excluded.vec, '
                'owned=MAX(owned, excluded.owned) RETURNING id',
                [source, str(source_id), *vals, vec.tobytes(), int(bool(meta.get('owned'))), time.time()],
            )
            tid = cur.fetchone()[0]
            self.db.commit()
            where = np.nonzero(self.ids == tid)[0]
            if len(where):
                self.raw[where[0]] = vec
                self.bpms[where[0]] = meta.get('bpm') or 0
            else:
                self.ids = np.append(self.ids, tid)
                self.bpms = np.append(self.bpms, np.float32(meta.get('bpm') or 0))
                self.raw = np.vstack([self.raw, vec[None]])
            self._Z = None
            return tid

    def track(self, tid, with_vec=False):
        row = self.db.execute(f'SELECT {TRACK_COLS}{", vec" if with_vec else ""} FROM tracks WHERE id=?', (tid,)).fetchone()
        if not row:
            return None
        t = dict(row)
        if with_vec:
            t['vec'] = np.frombuffer(row['vec'], dtype=np.float32)
        return t

    def tracks(self, ids):
        if not ids:
            return {}
        rows = self.db.execute(f'SELECT {TRACK_COLS} FROM tracks WHERE id IN ({",".join("?" * len(ids))})', list(ids)).fetchall()
        return {r['id']: dict(r) for r in rows}

    def find_tracks(self, q='', liked=False, saved=False, limit=50, offset=0, owned=False):
        sql, args = f'SELECT {TRACK_COLS} FROM tracks WHERE 1=1', []
        for word in (q or '').split():
            sql += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)'
            args += [f'%{word}%'] * 3
        if liked:
            sql += ' AND liked=1'
        if saved:
            sql += ' AND saved=1'
        if owned:
            sql += ' AND (owned=1 OR source=\'local\')'
        sql += ' ORDER BY added_at DESC LIMIT ? OFFSET ?'
        return [dict(r) for r in self.db.execute(sql, args + [limit, offset])]

    def set_flags(self, tid, **flags):
        with self.lock:
            for k in ('liked', 'saved'):
                if k in flags and flags[k] is not None:
                    self.db.execute(f'UPDATE tracks SET {k}=? WHERE id=?', (int(bool(flags[k])), tid))
            self.db.commit()

    def counts(self):
        rows = self.db.execute('SELECT source, COUNT(*) n FROM tracks GROUP BY source').fetchall()
        by = {r['source']: r['n'] for r in rows}
        return {'tracks': sum(by.values()), 'by_source': by}

    def counts_owned(self):
        return self.db.execute("SELECT COUNT(*) FROM tracks WHERE owned=1 OR source='local'").fetchone()[0]

    # ---------- nastavitve in povezane zbirke ----------

    def setting(self, key, default=None):
        row = self.db.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def set_setting(self, key, value):
        with self.lock:
            self.db.execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                            (key, json.dumps(value)))
            self.db.commit()

    def connections(self):
        return self.setting('connections', {})

    def set_connection(self, platform, handle):
        conns = self.connections()
        conns[platform] = {'handle': handle, 'synced': time.time()}
        self.set_setting('connections', conns)

    def remove_connection(self, platform):
        conns = self.connections()
        conns.pop(platform, None)
        self.set_setting('connections', conns)

    # ---------- analize (naloženi komadi in seti) ----------

    def create_analysis(self, kind, name, path):
        with self.lock:
            cur = self.db.execute(
                'INSERT INTO analyses (kind, name, path, status, created) VALUES (?, ?, ?, ?, ?)',
                (kind, name, str(path), 'queued', time.time()),
            )
            self.db.commit()
            return cur.lastrowid

    def update_analysis(self, aid, **fields):
        if 'data' in fields and not isinstance(fields['data'], str):
            fields['data'] = json.dumps(fields['data'])
        with self.lock:
            self.db.execute(f'UPDATE analyses SET {", ".join(f"{k}=?" for k in fields)} WHERE id=?', [*fields.values(), aid])
            self.db.commit()

    def analysis(self, aid):
        row = self.db.execute('SELECT * FROM analyses WHERE id=?', (aid,)).fetchone()
        if not row:
            return None
        a = dict(row)
        a['data'] = json.loads(a['data']) if a['data'] else None
        return a

    def analyses(self, kind=None):
        sql = 'SELECT id, kind, name, duration, bpm, key, camelot, status, progress, error, created FROM analyses'
        args = []
        if kind:
            sql += ' WHERE kind=?'
            args.append(kind)
        return [dict(r) for r in self.db.execute(sql + ' ORDER BY created DESC', args)]

    def delete_analysis(self, aid):
        a = self.analysis(aid)
        with self.lock:
            self.db.execute('DELETE FROM analyses WHERE id=?', (aid,))
            self.db.commit()
        if a and a['path'] and Path(a['path']).parent == self.home / 'uploads':
            Path(a['path']).unlink(missing_ok=True)

    # ---------- seznami predvajanja ----------

    def playlists(self):
        return [dict(r) for r in self.db.execute(
            'SELECT p.id, p.name, p.created, COUNT(pt.track_id) AS count FROM playlists p '
            'LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id GROUP BY p.id ORDER BY p.created DESC'
        )]

    def create_playlist(self, name):
        with self.lock:
            cur = self.db.execute('INSERT INTO playlists (name, created) VALUES (?, ?)', (name, time.time()))
            self.db.commit()
            return cur.lastrowid

    def delete_playlist(self, pid):
        with self.lock:
            self.db.execute('DELETE FROM playlists WHERE id=?', (pid,))
            self.db.commit()

    def playlist(self, pid):
        row = self.db.execute('SELECT id, name, created FROM playlists WHERE id=?', (pid,)).fetchone()
        if not row:
            return None
        ids = [r[0] for r in self.db.execute('SELECT track_id FROM playlist_tracks WHERE playlist_id=? ORDER BY pos', (pid,))]
        tracks = self.tracks(ids)
        return {**dict(row), 'tracks': [tracks[i] for i in ids if i in tracks]}

    def add_to_playlist(self, pid, tid):
        with self.lock:
            self.db.execute(
                'INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, pos) '
                'VALUES (?, ?, (SELECT COALESCE(MAX(pos), 0) + 1 FROM playlist_tracks WHERE playlist_id=?))',
                (pid, tid, pid),
            )
            self.db.commit()

    def remove_from_playlist(self, pid, tid):
        with self.lock:
            self.db.execute('DELETE FROM playlist_tracks WHERE playlist_id=? AND track_id=?', (pid, tid))
            self.db.commit()


def to_pct(score):
    """Kosinusna podobnost (-1..1) v odstotke za prikaz."""
    return int(round(max(0.0, min(1.0, (float(score) + 1) / 2)) * 100))
