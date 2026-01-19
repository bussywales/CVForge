#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d "app/api/ops" ]; then
  exit 0
fi

missing=0
while IFS= read -r file; do
  if ! grep -Eq "(requireOpsAccess|getUserRole|isOpsRole)" "$file"; then
    echo "Ops route missing RBAC guard: $file"
    missing=1
  fi
  if ! grep -Eq "jsonError" "$file"; then
    echo "Ops route missing structured error helper: $file"
    missing=1
  fi
  if ! grep -Eq "withRequestIdHeaders" "$file"; then
    echo "Ops route missing requestId headers: $file"
    missing=1
  fi
done < <(find app/api/ops -name "route.ts")

exit $missing
