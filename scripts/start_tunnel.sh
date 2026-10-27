#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$project_root/backend/.env"
read_env() { local key="$1"; if [[ -f "$env_file" ]]; then awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); gsub(/^\047|\047$|^"|"$/, ""); print; exit }' "$env_file"; fi; }
port_number="${PORT:-$(read_env PORT)}"; port_number="${port_number:-8000}"
if ! command -v cloudflared >/dev/null 2>&1; then echo 'cloudflared is not installed or is not on PATH.' >&2; exit 1; fi
data_dir="$project_root/data"
public_file="$data_dir/public_url.txt"
log_file="$(mktemp)"
mkdir -p "$data_dir"
rm -f "$public_file"
cloudflared tunnel --url "http://localhost:$port_number" >"$log_file" 2>&1 &
tunnel_pid=$!
tail_pid=''
cleanup() {
  if [[ -n "$tail_pid" ]]; then kill "$tail_pid" 2>/dev/null || true; fi
  kill "$tunnel_pid" 2>/dev/null || true
  wait "$tunnel_pid" 2>/dev/null || true
  rm -f "$public_file" "$log_file"
}
trap cleanup EXIT INT TERM
public_url=''
for _ in $(seq 1 60); do
  public_url="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$log_file" | head -n 1 || true)"
  [[ -n "$public_url" ]] && break
  if ! kill -0 "$tunnel_pid" 2>/dev/null; then cat "$log_file" >&2; echo 'cloudflared exited before providing a tunnel URL.' >&2; exit 1; fi
  sleep 1
done
if [[ -z "$public_url" ]]; then cat "$log_file" >&2; echo 'Tunnel URL was not reported within 60 seconds.' >&2; exit 1; fi
printf '%s\n' "$public_url" > "$public_file"
echo "Public workshop URL: $public_url"
echo 'Tunnel is running. Press Ctrl+C to stop it and clear the saved URL.'
tail -n +1 -f "$log_file" &
tail_pid=$!
wait "$tunnel_pid"
