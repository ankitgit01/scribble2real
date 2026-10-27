#!/usr/bin/env python3
"""Exercise the workshop API from health through a generated PNG."""
from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"


def env_file_value(name: str) -> str:
    path = BACKEND_DIR / ".env"
    if not path.is_file():
        return ""
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == name:
            return value.strip().strip('"').strip("'")
    return ""


def sketch_b64() -> str:
    image = Image.new("RGB", (1024, 1024), "white")
    draw = ImageDraw.Draw(image)
    draw.line([(220, 780), (500, 250), (800, 780), (220, 780)], fill="black", width=16, joint="curve")
    draw.line([(350, 780), (350, 590), (650, 590), (650, 780)], fill="black", width=12)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def check(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)
    print(f"OK  {message}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--mentor-pin", default=os.environ.get("MENTOR_PIN") or env_file_value("MENTOR_PIN"))
    parser.add_argument("--timeout", type=float, default=180)
    args = parser.parse_args()
    headers = {"X-Client-Id": "scribble-smoke-check", "X-Nickname": "Smoke check"}
    scribble = sketch_b64()
    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=30, headers=headers) as client:
        health = client.get("/api/health")
        health.raise_for_status()
        check(health.json().get("ok") is True, "health endpoint responds")

        workshop = client.get("/api/workshop/status")
        workshop.raise_for_status()
        check("paused" in workshop.json(), "workshop status responds")

        prep = client.post("/api/preprocess", json={"image_b64": scribble, "kind": "drawing"})
        prep.raise_for_status()
        prep_json = prep.json()
        check(bool(prep_json.get("cleaned_png_b64")), "drawing preprocessing returns a cleaned PNG")

        body = {
            "line_map_png_b64": scribble,
            "prompt": "A small welcoming treehouse in a garden",
            "style": "realistic",
            "mode": "fresh",
            "quality": "fast",
            "fidelity": 0.8,
            "creativity": 0.5,
        }
        accepted = client.post("/api/generate", json=body)
        accepted.raise_for_status()
        job_id = accepted.json().get("job_id")
        check(bool(job_id), "generation request is accepted")
        deadline = time.monotonic() + args.timeout
        job = {}
        while time.monotonic() < deadline:
            status_response = client.get(f"/api/jobs/{job_id}")
            status_response.raise_for_status()
            job = status_response.json()
            if job.get("status") in {"done", "error", "cancelled"}:
                break
            time.sleep(0.7)
        check(job.get("status") == "done", f"generation completes (state: {job.get('status', 'unknown')})")
        image_response = client.get(f"/api/jobs/{job_id}/result.png")
        image_response.raise_for_status()
        check(image_response.content.startswith(b"\x89PNG\r\n\x1a\n"), "result endpoint returns a PNG")

        learn_keys = any(os.environ.get(key) or env_file_value(key) for key in ("GEMINI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY"))
        if learn_keys:
            learn = client.post("/api/learn", json={"scribble_png_b64": scribble, "prompt": body["prompt"], "language": "en"})
            learn.raise_for_status()
            check(bool(learn.json().get("title")), "Learn endpoint returns an explanation")
        else:
            print("SKIP  Learn: no provider key configured")

        if not args.mentor_pin:
            raise RuntimeError("MENTOR_PIN is empty; configure it in backend/.env before checking the mentor API")
        mentor = client.get("/api/mentor/overview", headers={"X-Mentor-Pin": args.mentor_pin})
        mentor.raise_for_status()
        check("status" in mentor.json(), "mentor overview accepts the configured PIN")
    print("Smoke check passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (httpx.HTTPError, RuntimeError, OSError) as error:
        print(f"Smoke check failed: {error}", file=sys.stderr)
        raise SystemExit(1)
