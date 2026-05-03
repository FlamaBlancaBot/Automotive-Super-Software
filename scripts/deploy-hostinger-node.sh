#!/usr/bin/env bash
set -euo pipefail

# Deploy the single-domain Node.js app bundle to Hostinger.
#
# This script DOES NOT upload:
# - `.env` files
# - `node_modules`
# - local database files
#
# It DOES:
# - build the frontend
# - prepare a backend bundle (including backend/public with the built frontend)
# - verify SSH connectivity
# - create a timestamped backup of the current remote folder
# - upload the new bundle to the subdomain folder
#
# IMPORTANT:
# - It does not configure Hostinger hPanel for you.
# - You must set production env vars in hPanel (see docs/HOSTINGER_NODE_SETUP.md).

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_ALIAS="hostinger-autoss"
REMOTE_DIR="/home/u437809449/domains/business-automations.uk/public_html/autoss"
REMOTE_BACKUP_DIR="/home/u437809449/domains/business-automations.uk/public_html/_deploy_backups"
BUNDLE_DIR="$REPO_ROOT/build/hostinger-node-bundle"

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

ssh_quiet() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_ALIAS" "$@"
}

print "Preparing bundle"
require_cmd rsync
"$REPO_ROOT/scripts/prepare-hostinger-node-bundle.sh"

test -d "$BUNDLE_DIR" || fail "Bundle folder not found: $BUNDLE_DIR"
test -f "$BUNDLE_DIR/server.js" || fail "Bundle missing server.js"
test -f "$BUNDLE_DIR/public/index.html" || fail "Bundle missing public/index.html"

print "Checking SSH connection (${SSH_ALIAS})"
if ! ssh_quiet "echo connected >/dev/null"; then
  fail "SSH connection failed. Try running: ssh ${SSH_ALIAS}"
fi

print "Ensuring remote directories exist"
ssh_quiet "mkdir -p '$REMOTE_DIR' '$REMOTE_BACKUP_DIR'"

timestamp="$(date -u +%Y%m%d_%H%M%S)"
backup_file="${REMOTE_BACKUP_DIR}/autoss_node_${timestamp}.tar.gz"

print "Creating remote backup: ${backup_file}"
ssh_quiet "if [ -d '$REMOTE_DIR' ] && [ \"\$(ls -A '$REMOTE_DIR' 2>/dev/null)\" ]; then tar -czf '$backup_file' -C '$REMOTE_DIR' .; else echo 'No existing files to back up.'; fi"

print "Uploading bundle to ${REMOTE_DIR}"
rsync -az --delete \
  --exclude "node_modules" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude "data" \
  --exclude "data/**" \
  --exclude "*.db" \
  -e "ssh -o BatchMode=yes -o ConnectTimeout=10" \
  "$BUNDLE_DIR/" \
  "${SSH_ALIAS}:${REMOTE_DIR}/"

print "Verifying remote upload"
ssh_quiet "test -f '$REMOTE_DIR/server.js' && test -f '$REMOTE_DIR/public/index.html'"

print "Next steps (manual in Hostinger hPanel)"
cat <<'EOF'
- In hPanel → Node.js:
  - Set the application root to the `autoss` folder for the subdomain.
  - Set the startup file to `server.js`.
  - Set environment variables (see `docs/HOSTINGER_NODE_SETUP.md`).
  - Run `npm install` (production) if hPanel does not do it automatically.
  - Restart the Node.js app.

Test:
- https://autoss.business-automations.uk/api/health
- https://autoss.business-automations.uk/
EOF

print "Done"
