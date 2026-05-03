#!/usr/bin/env bash
set -euo pipefail

# Prepare a deployable Hostinger Node.js bundle.
#
# Output:
# - `build/hostinger-node-bundle/` (ignored by git)
#
# The bundle includes:
# - backend app (server.js, routes, db, scripts, config)
# - package.json + package-lock.json
# - built frontend copied into backend/public/
#
# The bundle does NOT include:
# - node_modules
# - .env files
# - local database files

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BUNDLE_DIR="$REPO_ROOT/build/hostinger-node-bundle"

print() {
  printf "\n==> %s\n" "$1"
}

fail() {
  printf "\nERROR: %s\n" "$1" >&2
  exit 1
}

print "Preparing backend/public with frontend build"
"$REPO_ROOT/scripts/prepare-backend-public.sh"

print "Creating bundle folder"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

print "Copying backend into bundle (excluding node_modules, .env, local database files)"
rsync -az \
  --exclude "node_modules" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude "data" \
  --exclude "data/**" \
  --exclude "*.db" \
  "$BACKEND_DIR/" \
  "$BUNDLE_DIR/"

test -f "$BUNDLE_DIR/server.js" || fail "Bundle missing server.js"
test -f "$BUNDLE_DIR/package.json" || fail "Bundle missing package.json"
test -f "$BUNDLE_DIR/package-lock.json" || fail "Bundle missing package-lock.json"
test -f "$BUNDLE_DIR/public/index.html" || fail "Bundle missing public/index.html (frontend build)"

print "Done"
echo "Bundle ready at: $BUNDLE_DIR"
