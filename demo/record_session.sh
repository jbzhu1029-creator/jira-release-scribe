#!/usr/bin/env bash
# Terminal session recorded by VHS. demo/render_video.sh writes demo/work/session.env.
set -euo pipefail
cd "$(dirname "$0")/.."

env_file="demo/work/session.env"
if [[ ! -f "$env_file" ]]; then
  echo "Missing ${env_file}. Run demo/render_video.sh." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$env_file"

# Magenta slate. The renderer trims the typed command up to the last pink frame.
printf '\033[H\033[2J\033[45m'
for _ in $(seq 1 50); do
  printf '\033[2KSLATE\n'
done
sleep 0.45
printf '\033[0m\033[H\033[2J'

mkdir -p "$(dirname "$DEMO_TIMING_FILE")"
python3 -c 'import time; print("layout", int(time.time() * 1000))' > "$DEMO_TIMING_FILE"
python3 demo/show_layout.py
sleep "$LAYOUT_SEC"

printf '$ npm run demo\n'
npm run -s demo
# Keep the last scene on screen while the edit trims to the end of its pause.
sleep 0.8
