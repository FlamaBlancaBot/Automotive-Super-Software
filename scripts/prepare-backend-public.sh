#!/usr/bin/env bash
set -euo pipefail

# Build the React frontend and copy it into `backend/public/` so the backend can
# serve the app in a single-domain production deployment.
#
# This script does NOT copy:
# - `.env` files
# - `node_modules`
# - local database files

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
BACKEND_PUBLIC_DIR="$REPO_ROOT/backend/public"
FRONTEND_DIST_DIR="$FRONTEND_DIR/dist"

print() {
  printf "\n==> %s\n" "$1"
}

fail() {
  printf "\nERROR: %s\n" "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

print "Building frontend"
require_cmd npm
(
  cd "$FRONTEND_DIR"
  # For single-domain production deploys, the frontend should call the API on the same origin.
  # We force this during the build so a local `frontend/.env` cannot accidentally bake in
  # `http://localhost:3001` for production.
  VITE_API_BASE_URL= npm run build
)

test -d "$FRONTEND_DIST_DIR" || fail "Build output not found at: $FRONTEND_DIST_DIR"
test -f "$FRONTEND_DIST_DIR/index.html" || fail "Build output missing index.html"

print "Copying frontend/dist -> backend/public"
mkdir -p "$BACKEND_PUBLIC_DIR"

if command -v rsync >/dev/null 2>&1; then
  # Keep backend/public/README.md if present.
  rsync -az --delete \
    --exclude "README.md" \
    "$FRONTEND_DIST_DIR/" \
    "$BACKEND_PUBLIC_DIR/"
else
  # Fallback: basic copy (does not delete removed files).
  cp -R "$FRONTEND_DIST_DIR/." "$BACKEND_PUBLIC_DIR/"
fi

print "Done"
echo "Backend public folder ready at: $BACKEND_PUBLIC_DIR"
