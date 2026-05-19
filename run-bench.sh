#!/usr/bin/env bash
set -euo pipefail

# Requires: curl, jq. Assumes servers on 3001 (TS Express), 3004 (TS Fastify), 3005 (TS NestJS), 3002 (Rust), 3003 (Go).

for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "error: $cmd is required" >&2
    exit 1
  fi
done

bench_one() {
  local name="$1"
  local url="$2"
  local times_file checksum
  times_file="$(mktemp)"
  checksum=""
  local i
  for i in 1 2 3 4 5; do
    local json
    if ! json="$(curl -sS --fail "$url" 2>/dev/null)"; then
      echo "error: cannot reach $name at $url (is the server running?)" >&2
      rm -f "$times_file"
      exit 1
    fi
    jq -r '.elapsed_seconds' <<<"$json" >>"$times_file"
    checksum="$(jq -r '.checksum' <<<"$json")"
  done
  # Warm-up: discard first measurement; stats on last 4
  local sorted
  sorted="$(tail -n +2 "$times_file" | sort -n)"
  rm -f "$times_file"

  local stats
  stats="$(printf '%s\n' "$sorted" | awk '
    NF { v[++n] = $1 + 0; s += $1 + 0 }
    END {
      if (n < 1) exit 1
      min = v[1]; max = v[1]
      for (i = 2; i <= n; i++) {
        if (v[i] < min) min = v[i]
        if (v[i] > max) max = v[i]
      }
      if (n % 2 == 1) med = v[(n + 1) / 2]
      else med = (v[n / 2] + v[n / 2 + 1]) / 2.0
      printf "%.10f|%.10f|%.10f", min, med, s / n
    }
  ')"

  IFS='|' read -r min median avg <<<"$stats"
  echo "$name|$min|$median|$avg|$checksum"
}

declare -a rows
rows+=("$(bench_one "TypeScript (Express)" "http://127.0.0.1:3001/compute")")
rows+=("$(bench_one "TypeScript (Fastify)" "http://127.0.0.1:3004/compute")")
rows+=("$(bench_one "TypeScript (NestJS)" "http://127.0.0.1:3005/compute")")
rows+=("$(bench_one "Rust" "http://127.0.0.1:3002/compute")")
rows+=("$(bench_one "Go" "http://127.0.0.1:3003/compute")")

printf "\n%-22s | %9s | %10s | %9s | %s\n" "Server" "Min (s)" "Median (s)" "Avg (s)" "Checksum"
printf "%s\n" "----------------------|-----------|------------|-----------|----------"
for row in "${rows[@]}"; do
  IFS='|' read -r lang min med avg chk <<<"$row"
  printf "%-22s | %9s | %10s | %9s | %s\n" "$lang" "$min" "$med" "$avg" "$chk"
done

first_chk="$(echo "${rows[0]}" | cut -d'|' -f5)"
all_match=1
for row in "${rows[@]}"; do
  chk="$(echo "$row" | cut -d'|' -f5)"
  if [[ "$chk" != "$first_chk" ]]; then
    all_match=0
    break
  fi
done
printf "\n"
if [[ "$all_match" -eq 1 ]]; then
  echo "Checksums match — implementations agree."
else
  echo "warning: checksum mismatch between servers; verify implementations." >&2
  exit 1
fi
