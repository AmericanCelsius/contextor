#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OFFLINE=0
FULLSCREEN=0
LINK_LOCAL=0
NO_LAUNCH=0
SKIP_INSTALL=0
SKIP_BUILD=0
TUI_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --offline)
      OFFLINE=1
      shift
      ;;
    --fullscreen)
      FULLSCREEN=1
      shift
      ;;
    --link)
      LINK_LOCAL=1
      shift
      ;;
    --no-launch)
      NO_LAUNCH=1
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Contextor macOS starter

Usage:
  bash scripts/start-macos.sh [options] [--config path]

Options:
  --offline       Launch the TUI in local-only offline mode.
  --fullscreen    Request best-effort terminal fullscreen before launch.
  --link          Run npm link after building so "contextor" works globally.
  --no-launch     Install/build only; do not open the TUI.
  --skip-install  Skip npm install.
  --skip-build    Skip npm run build.
  --help          Show this help.

Fresh clone path:
  git clone https://github.com/AmericanCelsius/contextor.git
  cd contextor
  bash scripts/start-macos.sh --offline

After optional linking:
  bash scripts/setup-macos.sh --link
  contextor start --offline
EOF
      exit 0
      ;;
    *)
      TUI_ARGS+=("$1")
      shift
      ;;
  esac
done

log() {
  printf '[contextor:mac] %s\n' "$1"
}

fail() {
  printf '[contextor:mac] ERROR: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    fail "This bootstrap script is macOS-only for now. Use npm install && npm run build && node dist/cli/index.js tui on other systems."
  fi
}

ensure_node() {
  if command_exists node && command_exists npm; then
    local major
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0')"
    if [[ "${major}" -ge 20 ]]; then
      return
    fi
    log "Node.js >=20 is required; current major version is ${major}."
  else
    log "Node.js and npm are required but were not found."
  fi

  if command_exists brew; then
    if [[ -t 0 ]]; then
      printf '[contextor:mac] Install or upgrade Node.js with Homebrew now? [Y/n] '
      read -r answer
      case "${answer:-Y}" in
        y|Y|yes|YES|"")
          brew install node
          hash -r
          ;;
        *)
          fail "Install Node.js >=20, then rerun bash scripts/start-macos.sh."
          ;;
      esac
    else
      log "Homebrew is available. Installing Node.js non-interactively."
      brew install node
      hash -r
    fi
  else
    cat >&2 <<'EOF'
[contextor:mac] Install Node.js >=20 before continuing.

Recommended macOS options:
  1. Install Node from https://nodejs.org/en/download
  2. Or install Homebrew, then run: brew install node

After Node is installed:
  cd contextor
  bash scripts/start-macos.sh --offline
EOF
    exit 1
  fi

  command_exists node || fail "node is still unavailable after install attempt."
  command_exists npm || fail "npm is still unavailable after install attempt."

  local major_after
  major_after="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0')"
  [[ "${major_after}" -ge 20 ]] || fail "Node.js >=20 is required; found major version ${major_after}."
}

ensure_interactive_terminal() {
  if [[ ! -t 0 || ! -t 1 ]]; then
    fail "The Contextor TUI needs an interactive terminal. Run this from Terminal.app, iTerm2, or another real TTY."
  fi
}

main() {
  ensure_macos
  ensure_interactive_terminal
  cd "${PROJECT_ROOT}"

  log "Project root: ${PROJECT_ROOT}"
  ensure_node
  log "Node: $(node --version)"
  log "npm: $(npm --version)"

  if [[ "${SKIP_INSTALL}" -eq 0 ]]; then
    log "Installing npm dependencies..."
    npm install
  fi

  if [[ "${SKIP_BUILD}" -eq 0 ]]; then
    log "Building Contextor..."
    npm run build
  fi

  if [[ "${LINK_LOCAL}" -eq 1 ]]; then
    log "Linking local contextor command with npm link..."
    npm link
  fi

  if [[ ! -f "${PROJECT_ROOT}/dist/cli/index.js" ]]; then
    fail "dist/cli/index.js was not found. Run npm run build or remove --skip-build."
  fi

  if [[ "${NO_LAUNCH}" -eq 1 ]]; then
    log "Setup complete. Launch later with: node dist/cli/index.js tui"
    exit 0
  fi

  log "Launching Contextor TUI..."
  if [[ "${OFFLINE}" -eq 1 ]]; then
    TUI_ARGS=(--offline "${TUI_ARGS[@]}")
  fi
  if [[ "${FULLSCREEN}" -eq 1 ]]; then
    TUI_ARGS=(--fullscreen "${TUI_ARGS[@]}")
  fi

  exec node dist/cli/index.js tui "${TUI_ARGS[@]}"
}

main "$@"
