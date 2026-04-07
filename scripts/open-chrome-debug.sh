#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"
PROFILE_DIR="${TMPDIR:-/tmp}/contextor-chrome-profile"

CHROME_BIN=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
do
  if [[ -x "$candidate" ]]; then
    CHROME_BIN="$candidate"
    break
  fi
done

if [[ -z "$CHROME_BIN" ]]; then
  echo "No Chrome or Chromium executable was found in /Applications." >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"

exec "$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check
