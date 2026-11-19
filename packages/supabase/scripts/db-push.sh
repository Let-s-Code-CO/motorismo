#!/usr/bin/env bash
# Applies pending migrations to a REMOTE Supabase project without `supabase link`
# (link writes local version pins that silently change the sandbox).
# Requires SUPABASE_DB_URL (Supabase dashboard → Connect → Session pooler connection string).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the target database connection string}"

supabase db push --db-url "$SUPABASE_DB_URL" "$@"
