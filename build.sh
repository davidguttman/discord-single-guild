#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

show_help() {
  cat <<'HELP'
Discord Single Guild build helper

Nativefier is no longer used. This helper installs locked dependencies, runs the
focused tests, builds the Electron AppImage, and launches it with the familiar
profile options.

Usage:
  ./build.sh [app options]
  ./build.sh --build-only

App options:
  --name NAME       Profile/window name (default: Discord)
  --guild ID        Guild ID, or @me (default: @me)
  --icon PATH|URL   Local icon or HTTPS icon URL
  --color COLOR     blurple, pink, red, yellow, green, or cyan
  --install         Copy the AppImage under ~/.local/opt and create a launcher

Example:
  ./build.sh --name "My Server" --guild 123456789012345678 --color cyan --install

For day-to-day use, download the AppImage from GitHub Releases. Maintainers can
run `npm ci && npm test && npm run dist` directly.
HELP
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

BUILD_ONLY=false
if [[ "${1:-}" == "--build-only" ]]; then
  BUILD_ONLY=true
  shift
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Error: Node.js 22.12 or newer and npm are required to build." >&2
  exit 1
fi

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) process.exit(1)' || {
  echo "Error: Node.js 22.12 or newer is required (found $(node --version))." >&2
  exit 1
}

echo "Building the maintained Electron app (Nativefier has been retired)..."
npm ci
npm test
npm run dist

APPIMAGE="$(find "$SCRIPT_DIR/dist" -maxdepth 1 -type f -name 'discord-single-guild-*.AppImage' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)"
if [[ -z "$APPIMAGE" ]]; then
  echo "Error: electron-builder did not produce an AppImage." >&2
  exit 1
fi

echo "Built: $APPIMAGE"
if [[ "$BUILD_ONLY" == true ]]; then
  exit 0
fi

exec "$APPIMAGE" "$@"
