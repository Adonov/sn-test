#!/usr/bin/env bash
# Prvi zagon namesti vse potrebno, nato odpre Sonar v brskalniku.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null; then
  echo "Manjka ffmpeg. Na Macu: brew install ffmpeg   (Linux: sudo apt install ffmpeg)"
  exit 1
fi
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
fi
exec .venv/bin/python -m sonar "${@:-serve}"
