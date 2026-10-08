#!/bin/zsh
set -u
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR" || exit 1
case "$(uname -m)" in
  arm64) NODE_BIN="$APP_DIR/runtime/node-darwin-arm64/node" ;;
  x86_64) NODE_BIN="$APP_DIR/runtime/node-darwin-x64/node" ;;
  *) echo "This bundle supports Apple Silicon and Intel Macs."; exit 1 ;;
esac
# A portable bundle never falls back to a machine-wide Node installation.
if [[ ! -f "$APP_DIR/.portable" && ! -x "$NODE_BIN" ]]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  NODE_BIN="$(command -v node || true)"
fi
if [[ ! -x "$NODE_BIN" || ! -f "$APP_DIR/server.js" ]]; then
  echo "The app or Node runtime is missing. Extract the whole ZIP into a writable folder."
  echo "Source checkouts require Node 22.21+ (22.x) or 24.5+."
  [[ -t 0 ]] && read -r "?Press Return to close."
  exit 1
fi
"$NODE_BIN" "$APP_DIR/scripts/check-runtime.cjs" || exit 1
# Replace the shell so stop signals reach the supervising Node process.
exec "$NODE_BIN" --no-use-env-proxy "$APP_DIR/scripts/launcher.cjs"
