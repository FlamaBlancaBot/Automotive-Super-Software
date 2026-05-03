#!/usr/bin/env bash
set -euo pipefail

# Deploy the frontend (static build) to Hostinger using the SSH alias:
#   hostinger-autoss
#
# It will:
# - build the frontend (Vite) locally
# - verify SSH connection works
# - create a timestamped backup of the current remote folder
# - deploy `frontend/dist/` to the remote folder (rsync preferred)
#
# No passwords are stored, and no secrets are uploaded.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_ALIAS="hostinger-autoss"
REMOTE_DIR="/home/u437809449/domains/business-automations.uk/public_html/autoss"
REMOTE_BACKUP_DIR="/home/u437809449/domains/business-automations.uk/public_html/_deploy_backups"

FRONTEND_DIR="$REPO_ROOT/frontend"
DIST_DIR="$FRONTEND_DIR/dist"

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
  # BatchMode prevents password prompts (safer for automation).
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_ALIAS" "$@"
}

print "Building frontend"
require_cmd npm
(
  cd "$FRONTEND_DIR"
  npm run build
)

test -d "$DIST_DIR" || fail "Build output not found at: $DIST_DIR"
test -f "$DIST_DIR/index.html" || fail "Build output missing index.html"

print "Checking SSH connection (${SSH_ALIAS})"
if ! ssh_quiet "echo connected >/dev/null"; then
  fail "SSH connection failed. Try running: ssh ${SSH_ALIAS}"
fi

print "Ensuring remote directories exist"
ssh_quiet "mkdir -p '$REMOTE_DIR' '$REMOTE_BACKUP_DIR'"

timestamp="$(date -u +%Y%m%d_%H%M%S)"
backup_file="${REMOTE_BACKUP_DIR}/autoss_${timestamp}.tar.gz"

print "Creating remote backup: ${backup_file}"
ssh_quiet "if [ -d '$REMOTE_DIR' ] && [ \"\$(ls -A '$REMOTE_DIR' 2>/dev/null)\" ]; then tar -czf '$backup_file' -C '$REMOTE_DIR' .; else echo 'No existing files to back up.'; fi"

print "Deploying dist/ to ${REMOTE_DIR}"

use_rsync="false"
if command -v rsync >/dev/null 2>&1; then
  if ssh_quiet "command -v rsync >/dev/null 2>&1"; then
    use_rsync="true"
  fi
fi

if [ "$use_rsync" = "true" ]; then
  print "Using rsync (recommended)"
  rsync -az --delete \
    --exclude "node_modules" \
    --exclude ".env" \
    --exclude ".env.*" \
    -e "ssh -o BatchMode=yes -o ConnectTimeout=10" \
    "$DIST_DIR/" \
    "${SSH_ALIAS}:${REMOTE_DIR}/"
else
  print "rsync not available (local or remote) — using tar over SSH"
  require_cmd tar
  tar -C "$DIST_DIR" -czf - . | ssh_quiet "tar -xzf - -C '$REMOTE_DIR'"
fi

print "Verifying remote deployment"
ssh_quiet "test -f '$REMOTE_DIR/index.html'"

print "Done"
echo "Deployed to: https://autoss.business-automations.uk/"

