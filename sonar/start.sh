#!/usr/bin/env bash
# Prvi zagon namesti vse potrebno, nato odpre Sonar v brskalniku.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null; then
  echo "Manjka ffmpeg. Na Macu: brew install ffmpeg   (Linux: sudo apt install ffmpeg)"
  exit 1
fi
if ! command -v deno >/dev/null; then
  echo "Namig: za YouTube namesti še deno:  brew install deno"
fi
[ -d .venv ] || python3 -m venv .venv
# ob novi različici (spremenjen requirements.txt) znova namesti knjižnice
if [ ! -f .venv/.installed ] || [ requirements.txt -nt .venv/.installed ]; then
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
  touch .venv/.installed
else
  # platforme pogosto spreminjajo strani, zato yt-dlp vedno posodobimo (brez povezave preskočimo)
  .venv/bin/pip install -q --upgrade yt-dlp >/dev/null 2>&1 || true
fi
exec .venv/bin/python -m sonar "${@:-serve}"
