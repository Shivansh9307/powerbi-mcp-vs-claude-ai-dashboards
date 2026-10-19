"""Render the Claude artifact's pages to PNG, for the page-by-page comparison.

The artifact is plain browser JavaScript (``artifact/src``). ``artifact/preview/index.html`` is a small
stand-in for the runtime that claude.ai provides, so the same code can run locally. This script serves
``artifact/``, opens each page at a fixed viewport and saves a full-page screenshot.

Prerequisites::

    uv run python artifact/prep_data.py <raw CSV folder> artifact/data
    uv run --no-project --with playwright python tools/artifact-capture/capture.py

It drives the Chrome you already have installed (no browser download). d3 loads from a CDN, so it
needs internet access.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import threading
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

#: (file stem, query string for artifact/preview/index.html)
STATES: list[tuple[str, dict[str, str]]] = [
    ("01-overview", {"page": "overview"}),
    ("02-drivers", {"page": "drivers"}),
    ("02b-drivers-hamilton", {"page": "drivers", "driver": "Lewis Hamilton", "cmp": "Nico Rosberg"}),
    ("03-constructors", {"page": "constructors"}),
    ("03b-constructors-ferrari", {"page": "constructors", "cons": "Ferrari", "cmp": "McLaren"}),
    ("04-races", {"page": "races", "y0": "2021", "y1": "2021"}),
    ("04b-races-circuit", {"page": "races", "view": "circuit", "circuit": "Silverstone"}),
    ("05-quali", {"page": "quali"}),
    ("06-pits", {"page": "pits"}),
    ("07-eras", {"page": "eras"}),
    ("08-quality", {"page": "quality"}),
]


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=Path("artifact"), help="folder with src/, data/, preview/")
    parser.add_argument("--out", type=Path, default=Path("docs/images/artifact"))
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--height", type=int, default=1000)
    parser.add_argument("--scale", type=float, default=1.5)
    parser.add_argument(
        "--max-height",
        type=int,
        default=3600,
        help="CSS px; taller pages are cropped (the Data Quality page runs to 12,000 px of lookup tables)",
    )
    args = parser.parse_args()

    handler = functools.partial(_Quiet, directory=str(args.root.resolve()))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/preview/index.html"
    args.out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(
            viewport={"width": args.width, "height": args.height}, device_scale_factor=args.scale
        )
        page = context.new_page()
        for stem, query in STATES:
            page.goto(f"{base}?{urlencode(query)}")
            page.wait_for_function("document.title === 'READY'", timeout=60_000)
            page.wait_for_timeout(1500)
            target = args.out / f"{stem}.png"
            height = page.evaluate("document.documentElement.scrollHeight")
            clip = {"x": 0, "y": 0, "width": args.width, "height": min(height, args.max_height)}
            page.screenshot(path=str(target), full_page=True, clip=clip)
            print(f"{target}  ({target.stat().st_size // 1024} KB)")
        browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
