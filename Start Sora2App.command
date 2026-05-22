#!/bin/zsh

set -u

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="$(basename "$APP_DIR")"
PORT="${PORT:-5177}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"

cd "$APP_DIR" || exit 1

echo "Sora2App launcher"
echo "App folder: $APP_NAME"
echo

if [[ ! -f "$APP_DIR/server.js" ]]; then
  echo "server.js was not found next to this launcher."
  echo "Copy the whole sora2app folder, not only this .command file."
  echo
  read -r "?Press Return to close this window."
  exit 1
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$APP_DIR" >/dev/null 2>&1 || true
fi

ARCH="$(uname -m)"
NODE_BIN=""
typeset -a NODE_CANDIDATES

case "$ARCH" in
  arm64)
    NODE_CANDIDATES=(
      "$APP_DIR/runtime/node-darwin-arm64/node"
      "$APP_DIR/runtime/node-darwin-x64/node"
    )
    ;;
  x86_64|amd64)
    NODE_CANDIDATES=(
      "$APP_DIR/runtime/node-darwin-x64/node"
    )
    ;;
  *)
    NODE_CANDIDATES=()
    ;;
esac

NODE_CANDIDATES+=(
  "$(command -v node || true)"
  "/opt/homebrew/bin/node"
  "/usr/local/bin/node"
)

prepare_node_candidate() {
  local candidate="$1"

  if [[ ! -f "$candidate" ]]; then
    return 0
  fi

  chmod +x "$candidate" 2>/dev/null || true

  if command -v xattr >/dev/null 2>&1; then
    xattr -d com.apple.quarantine "$candidate" >/dev/null 2>&1 || true
  fi

  if [[ "$candidate" == "$APP_DIR"/runtime/* && -x /usr/bin/codesign ]]; then
    /usr/bin/codesign --verify "$candidate" >/dev/null 2>&1 ||
      /usr/bin/codesign --force --sign - "$candidate" >/dev/null 2>&1 ||
      true
  fi
}

for candidate in "${NODE_CANDIDATES[@]}"; do
  if [[ -z "$candidate" ]]; then
    continue
  fi

  prepare_node_candidate "$candidate"

  if [[ ! -x "$candidate" ]]; then
    continue
  fi

  NODE_MAJOR="$("$candidate" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
  case "$NODE_MAJOR" in
    ''|*[!0-9]*)
      continue
      ;;
    *)
      if (( NODE_MAJOR >= 18 )); then
        NODE_BIN="$candidate"
        break
      fi
      ;;
  esac
done

if [[ -z "$NODE_BIN" ]]; then
  echo "A compatible Node.js runtime was not found."
  echo "Make sure the whole sora2app folder was copied, including the runtime folder."
  echo "If the runtime folder is missing, install Node.js 18 or newer from https://nodejs.org/ and run this file again."
  echo
  read -r "?Press Return to close this window."
  exit 1
fi

echo "Node runtime: $(basename "$NODE_BIN")"
echo

"$NODE_BIN" <<'NODE'
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const appDir = process.cwd();
function readRequestedPort() {
  const rawPort = process.env.PORT || "5177";
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  return parsedPort;
}

const requestedPort = readRequestedPort();
let port = requestedPort;
let url = `http://127.0.0.1:${port}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canListen(candidatePort) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", (error) => resolve({ ok: false, code: error.code || "UNKNOWN" }));
    tester.once("listening", () => {
      tester.close(() => resolve({ ok: true }));
    });
    tester.listen(candidatePort, "127.0.0.1");
  });
}

async function choosePort() {
  const firstResult = await canListen(requestedPort);
  if (firstResult.ok) return requestedPort;

  if (process.env.PORT) {
    throw new Error(`Port ${requestedPort} is not available (${firstResult.code}). Close the other app or run with a different PORT.`);
  }

  if (firstResult.code !== "EADDRINUSE") {
    throw new Error(`Cannot start a local server on 127.0.0.1:${requestedPort} (${firstResult.code}).`);
  }

  for (let candidate = requestedPort; candidate < requestedPort + 100; candidate += 1) {
    const result = await canListen(candidate);
    if (result.ok) return candidate;
    if (result.code !== "EADDRINUSE") {
      throw new Error(`Cannot start a local server on 127.0.0.1:${candidate} (${result.code}).`);
    }
  }

  throw new Error(`No available local port found between ${requestedPort} and ${requestedPort + 99}.`);
}

function probe(targetUrl = url) {
  return new Promise((resolve) => {
    const req = http.get(targetUrl, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openBrowser() {
  if (process.env.OPEN_BROWSER === "0") {
    return;
  }

  const opener = spawn("open", [url], {
    detached: true,
    stdio: "ignore",
  });
  opener.unref();
}

async function openWhenReady() {
  for (let index = 0; index < 50; index += 1) {
    if (await probe()) {
      if (process.env.OPEN_BROWSER === "0") {
        console.log(`Ready at ${url}`);
      } else {
        console.log(`Opening ${url}`);
      }
      openBrowser();
      return true;
    }
    await sleep(200);
  }
  return false;
}

(async () => {
  port = await choosePort();
  process.env.PORT = String(port);
  url = `http://127.0.0.1:${port}`;

  console.log(`URL: ${url}`);
  console.log("");

  console.log("Starting server...");
  console.log("Keep this Terminal window open while using Sora2App.");
  console.log("");

  const server = spawn(process.execPath, [path.join(appDir, "server.js")], {
    cwd: appDir,
    env: process.env,
    stdio: "inherit",
  });

  server.on("error", (error) => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  });

  const forwardSignal = (signal) => {
    if (!server.killed) server.kill(signal);
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  const opened = await openWhenReady();
  if (!opened) {
    console.log(`Server did not respond yet. You can still try opening ${url}`);
  }

  server.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
})();
NODE

exit_code=$?
echo
echo "Launcher finished with exit code $exit_code."
read -r "?Press Return to close this window."
exit "$exit_code"
