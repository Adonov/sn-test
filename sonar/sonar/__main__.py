"""Ukazna vrstica: python -m sonar [serve|import|crawl|stats]."""
import argparse
import time
import webbrowser


def _wait(job):
    last = None
    while job['status'] in ('queued', 'running'):
        line = f'{job["done"]}/{job["total"] or "?"} obdelanih, {job["added"]} dodanih, {job["failed"]} napak  {job["message"]}'
        if line != last:
            print('\r' + line[:150].ljust(150), end='', flush=True)
            last = line
        time.sleep(0.5)
    print(f'\n{job["status"]}: {job["added"]} komadov dodanih {job["message"]}')


def main():
    ap = argparse.ArgumentParser(prog='sonar', description='Iskalnik podobnih komadov za DJ-je')
    sub = ap.add_subparsers(dest='cmd')
    s = sub.add_parser('serve', help='zaženi spletni vmesnik (privzeto)')
    s.add_argument('--host', default='127.0.0.1')
    s.add_argument('--port', type=int, default=8765)
    s.add_argument('--no-browser', action='store_true')
    i = sub.add_parser('import', help='dodaj lokalno mapo z glasbo v katalog')
    i.add_argument('folder')
    c = sub.add_parser('crawl', help='dodaj komade z Deezerja (30 s predposlušanja)')
    c.add_argument('seeds', nargs='+', help='izvajalci, "q:minimal house", "label:Innervisions", povezave do Deezer playlist')
    c.add_argument('--max', type=int, default=1000, help='največ novih komadov')
    c.add_argument('--per-artist', type=int, default=10)
    c.add_argument('--no-related', action='store_true', help='ne sledi sorodnim izvajalcem')
    sub.add_parser('stats', help='velikost kataloga')
    sub.add_parser('doctor', help='preveri, ali analiza zvoka deluje na tem računalniku')
    args = ap.parse_args()

    if args.cmd == 'doctor':
        return doctor()

    from .library import Library
    if args.cmd in (None, 'serve'):
        import uvicorn
        from .server import create_app
        host = getattr(args, 'host', '127.0.0.1')
        port = getattr(args, 'port', 8765)
        url = f'http://{"localhost" if host in ("127.0.0.1", "0.0.0.0") else host}:{port}'
        print(f'Sonar teče na {url}')
        if not getattr(args, 'no_browser', False):
            webbrowser.open(url)
        uvicorn.run(create_app(), host=host, port=port, log_level='warning')
        return

    lib = Library()
    if args.cmd == 'stats':
        print(lib.counts())
        return
    from .jobs import Jobs
    jobs = Jobs(lib)
    if args.cmd == 'import':
        _wait(jobs.import_folder(args.folder))
    elif args.cmd == 'crawl':
        _wait(jobs.crawl_deezer(args.seeds, args.max, args.per_artist, not args.no_related))


def doctor():
    """Analizira testni ton v tem procesu; ob sesutju faulthandler izpiše, kje se je zgodilo."""
    import faulthandler
    import platform
    import subprocess
    import tempfile
    faulthandler.enable()
    import librosa
    import numba
    import numpy
    import yt_dlp
    print(f'Python {platform.python_version()} · {platform.machine()} · numpy {numpy.__version__} · '
          f'numba {numba.__version__} · librosa {librosa.__version__} · yt-dlp {yt_dlp.version.__version__}')
    try:
        import yt_dlp_ejs  # noqa: F401 – rešuje YouTubove JavaScript izzive
        runtimes = getattr(yt_dlp.YoutubeDL({'quiet': True}), '_js_runtimes', {})
        ok = any(bool(v) for v in runtimes.values()) if runtimes else True
        print('YouTube: OK (yt-dlp-ejs' + (' + deno)' if ok else ', ampak manjka deno – poženi bash start.sh)'))
    except ImportError:
        print('YouTube: manjka yt-dlp-ejs – poženi bash start.sh, da se namesti')
    with tempfile.TemporaryDirectory() as tmp:
        wav = f'{tmp}/test.wav'
        subprocess.run(['ffmpeg', '-v', 'quiet', '-f', 'lavfi', '-i', 'sine=frequency=110:duration=40',
                        '-f', 'lavfi', '-i', 'anoisesrc=d=40:a=0.1', '-filter_complex', 'amix=inputs=2', wav], check=True)
        from .features import analyze_file
        print('Analiza v tem procesu …', flush=True)
        res = analyze_file(wav)
        print(f'  OK (BPM {res["bpm"]})', flush=True)
        from .jobs import _track_worker, pool
        print('Analiza v delovnem procesu …', flush=True)
        _, _, res, err = pool().submit(_track_worker, wav).result()
        print(f'  {"NAPAKA: " + err if err else "OK"}', flush=True)
    print('Vse deluje.')


if __name__ == '__main__':
    main()
