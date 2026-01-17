#!/usr/bin/env bash

# CI guard to prevent client components from reading Stripe env vars or importing server-only billing modules.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

client_files=$(cd "$ROOT" && rg --files-with-matches 'use client' app components || true)
status=0

for file in $client_files; do
  env_matches=$(rg -n 'process\.env\.(STRIPE_[A-Z0-9_]+|STRIPE_PACK_[A-Z0-9_]+|STRIPE_SUB_[A-Z0-9_]+)' "$ROOT/$file" || true)
  if [[ -n "$env_matches" ]]; then
    echo "Client env guard: forbidden Stripe env usage in $file"
    echo "$env_matches"
    status=1
  fi

  import_matches=$(rg -n "from ['\"]@/lib/billing/(packs|plans)['\"]" "$ROOT/$file" || true)
  if [[ -n "$import_matches" ]]; then
    echo "Client env guard: forbidden billing import in $file"
    echo "$import_matches"
    status=1
  fi
done

if [[ $status -ne 0 ]]; then
  exit "$status"
fi

echo "Client env guard: ok"
