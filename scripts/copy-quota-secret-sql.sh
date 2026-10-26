#!/usr/bin/env bash
# Builds the SQL that stores GUEST_QUOTA_SECRET (from .env.local) in
# private.app_settings, and puts it on the macOS CLIPBOARD, so the secret never
# appears in a terminal, a chat or a file. The script itself contains no secret.
#
#   scripts/copy-quota-secret-sql.sh          copy the statement to the clipboard
#   scripts/copy-quota-secret-sql.sh --check  show the statement with the value masked
#
# After pasting it into the Supabase SQL editor and running it, clear the
# clipboard (`pbcopy < /dev/null`) and delete the editor's saved snippet/history entry.
set -euo pipefail
cd "$(dirname "$0")/.."

SECRET="$(sed -n 's/^GUEST_QUOTA_SECRET=//p' .env.local | head -n1)"
if [ "${#SECRET}" -lt 32 ]; then
  echo "GUEST_QUOTA_SECRET is missing or shorter than 32 characters in .env.local" >&2
  exit 1
fi
if ! [[ "$SECRET" =~ ^[0-9A-Za-z_-]+$ ]]; then
  echo "GUEST_QUOTA_SECRET contains characters that are not safe to embed in SQL" >&2
  exit 1
fi

sql() {
  printf "insert into private.app_settings (key, value)\nvalues ('quota_secret', '%s')\non conflict (key) do update set value = excluded.value;\n" "$1"
}

if [ "${1:-}" = "--check" ]; then
  sql "<${#SECRET} characters, hidden>"
else
  sql "$SECRET" | pbcopy
  echo "Copied the SQL (${#SECRET}-character secret) to the clipboard. Paste it into the Supabase SQL editor and run it."
fi
