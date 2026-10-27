# Scribble2Real

Scribble2Real is a small, mentor-led drawing workshop for students. Sketch on the canvas, add an optional idea, then turn it into an image. The app runs from one laptop; students join over the same Wi-Fi or through an optional Cloudflare quick tunnel.

## Requirements

- Windows 10/11 or Linux, Python 3.11, and Node.js 20+
- An NVIDIA GPU supported by the matching PyTorch CUDA build for fast local image generation (CPU mode works but is very slow)
- A Gemini, OpenRouter, or Groq API key for explanations (optional; explanations can be disabled)
- `cloudflared` only when students cannot reach the laptop over local Wi-Fi

## Set up

From the repository root, create and activate a virtual environment:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the matching PyTorch and TorchVision builds first, then install the app requirements. For CUDA 12.8 on Windows:

```powershell
python -m pip install --upgrade pip
python -m pip install torch==2.10.0 torchvision==0.25.0 torchaudio==2.10.0 --index-url https://download.pytorch.org/whl/cu128
python -m pip install -r .\backend\requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and set a private `MENTOR_PIN`. Add at least one Learn provider key; Gemini is the default, with automatic fallback to OpenRouter and Groq when configured. The first server start downloads the SD 1.5, Scribble ControlNet, and LCM-LoRA weights. Keep several GB of disk space free. Model weights run locally; Learn explanations are sent to the configured provider.

Build the browser app:

```powershell
.\scripts\build_frontend.ps1
```

Or use `./scripts/build_frontend.sh` on Linux. These scripts run `npm ci` and `npm run build` in `frontend/`.

## Start the workshop

```powershell
.\scripts\start.ps1
```

Linux:

```bash
./scripts/start.sh
```

The server listens on the configured `HOST` and `PORT` (defaults: `0.0.0.0:8000`). The terminal prints local join links and QR codes. Students on the same network open a LAN link. If the school Wi-Fi blocks device-to-laptop connections, start a quick tunnel in another terminal with `./scripts/start_tunnel.ps1` or `./scripts/start_tunnel.sh`; it prints an HTTPS join link and removes the saved URL when stopped.

If PowerShell blocks local scripts, run them explicitly with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

## Check the setup

Run the frontend checks from `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
```

With the backend running, run the API smoke check from the repository root:

```powershell
python .\scripts\smoke_test.py
```

The smoke check exercises health, status, preprocessing, generation, the result PNG, Learn when configured, and mentor authentication. It exits with a failure message if a required endpoint does not respond as expected.

## Privacy and workshop use

There are no student accounts. Mentors can see prompts and recent activity during the session. Explanations use an online AI provider when enabled. Ask students not to enter personal details, and check the consent requirements for your institution before using the workshop with minors. See [the runbook](docs/RUNBOOK.md), [mentor guide](docs/MENTOR_GUIDE.md), and [student handout](docs/STUDENT_HANDOUT.md).
