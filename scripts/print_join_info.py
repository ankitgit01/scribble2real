#!/usr/bin/env python3
"""Print LAN/public workshop links and terminal QR codes."""
from __future__ import annotations

import argparse
import os
import socket
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def lan_addresses() -> list[str]:
    found: set[str] = set()
    try:
        for result in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = result[4][0]
            if not address.startswith("127."):
                found.add(address)
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("192.0.2.1", 9))
        address = probe.getsockname()[0]
        probe.close()
        if not address.startswith("127."):
            found.add(address)
    except OSError:
        pass
    return sorted(found)


def qr_text(url: str) -> str:
    try:
        import qrcode
        qr = qrcode.QRCode(border=1, box_size=1)
        qr.add_data(url)
        qr.make(fit=True)
        return "\n".join("".join("##" if cell else "  " for cell in row) for row in qr.get_matrix())
    except ImportError:
        return "(Install the backend qrcode dependency to print a scannable terminal QR.)"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = parser.parse_args()
    urls = [f"http://{address}:{args.port}" for address in lan_addresses()]
    urls.insert(0, f"http://localhost:{args.port}")
    public_url = os.environ.get("PUBLIC_URL", "").strip()
    if not public_url:
        public_file = PROJECT_ROOT / "data" / "public_url.txt"
        if public_file.is_file():
            public_url = public_file.read_text(encoding="utf-8").strip()
    if public_url:
        urls.insert(0, public_url)
    for index, url in enumerate(dict.fromkeys(urls), start=1):
        print(f"\nJoin link {index}: {url}")
        print(qr_text(url))
    if len(urls) == 1:
        print("No LAN address was detected. Check the network connection and firewall.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
