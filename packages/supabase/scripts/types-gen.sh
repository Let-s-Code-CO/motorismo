#!/usr/bin/env bash
# Generates types/database.types.ts from the LOCAL sandbox (i.e. exactly from supabase/migrations).
# With --check it fails if the committed file is stale (used in CI).
set -euo pipefail
cd "$(dirname "$0")/.."

target="types/database.types.ts"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

supabase gen types typescript --local --schema public > "$tmp"

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -q "$tmp" "$target" > /dev/null; then
    echo "✗ $target is stale. Run: pnpm db:types" >&2
    diff -u "$target" "$tmp" | head -50 >&2 || true
    exit 1
  fi
  echo "✓ $target is up to date"
else
  cp "$tmp" "$target"
  echo "✓ Wrote $target"
fi
