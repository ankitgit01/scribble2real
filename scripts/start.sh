#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$project_root/backend"
env_file="$backend_dir/.env"
read_env() { local key="$1"; if [[ -f "$env_file" ]]; then awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); gsub(/^\047|\047$|^"|"$/, ""); print; exit }' "$env_file"; fi; }
venv_dir="$project_root/.venv"
if [[ ! -f "$venv_dir/bin/activate" ]]; then venv_dir="$(dirname "$project_root")/.venv"; fi
if [[ ! -f "$venv_dir/bin/activate" ]]; then echo "Python environment not found. Create one with: python3.11 -m venv '$project_root/.venv'" >&2; exit 1; fi
if [[ ! -f "$env_file" ]]; then echo "Missing $env_file. Copy .env.example to .env and configure MENTOR_PIN." >&2; exit 1; fi
source "$venv_dir/bin/activate"
mentor_pin="${MENTOR_PIN:-$(read_env MENTOR_PIN)}"
if [[ -z "${mentor_pin//[[:space:]]/}" ]]; then echo 'Set a private MENTOR_PIN in backend/.env before starting the workshop.' >&2; exit 1; fi
for key in GEMINI_API_KEY OPENROUTER_API_KEY GROQ_API_KEY; do
  if [[ -z "${!key:-$(read_env "$key")}" ]]; then echo "Warning: $key is not set; that Learn provider will be skipped." >&2; fi
done
port_number="${PORT:-$(read_env PORT)}"; port_number="${port_number:-8000}"
bind_host="${HOST:-$(read_env HOST)}"; bind_host="${bind_host:-0.0.0.0}"
cd "$backend_dir"
echo 'Checking Python and GPU availability…'
if ! python -c 'import importlib.util; print("PyTorch:", "installed" if importlib.util.find_spec("torch") else "not installed"); import torch; print("CUDA:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "not available")'; then echo 'Warning: GPU check could not complete. Check the CUDA PyTorch setup or set DEVICE=cpu for slow local generation.' >&2; fi
python "$project_root/scripts/print_join_info.py" --port "$port_number"
echo "Starting Scribble2Real on port $port_number (Ctrl+C to stop)."
exec python -m uvicorn app.main:app --host "$bind_host" --port "$port_number"
