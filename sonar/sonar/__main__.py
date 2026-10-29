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
    args = ap.parse_args()

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


if __name__ == '__main__':
    main()
