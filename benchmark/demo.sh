#!/bin/sh
# One-step local setup: downloads the photos, installs and builds the three demos,
# then serves benchmark/ at http://localhost:8080/ (override with PORT=...).
# Needs Node.js 20.19+ or 22.13+, npm and curl. Windows: run demo.cmd instead.
set -e
cd "$(dirname "$0")"
sh media/fetch.sh
for tool in remotion hyperframes revideo; do
  echo "== $tool: install + build"
  (cd "$tool" && npm ci --no-audit --no-fund --loglevel=error && npm run build:demo --silent)
done
PORT="${PORT:-8080}"
echo
echo "Open http://localhost:$PORT/  (Ctrl+C to stop)"
echo "  Remotion:    http://localhost:$PORT/remotion/dist-demo/router.html"
echo "  HyperFrames: http://localhost:$PORT/hyperframes/dist-demo/router.html"
echo "  Revideo:     http://localhost:$PORT/revideo/dist-demo/router.html"
PORT="$PORT" exec node harness/serve.mjs
