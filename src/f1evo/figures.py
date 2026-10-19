"""Documentation images: crop Power BI Desktop captures to the report page and build the before/after hero."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG, TEXT, MUTED, AMBER = (15, 17, 21), (242, 242, 242), (154, 163, 175), (245, 179, 1)
CANVAS = (2400, 1254)
PAGE_WIDTH = 1920
TOOLTIP_WIDTH = 640

#: Where the report sits inside a 3510 x 1500 Power BI Desktop capture. A 16:9 page is centred in the
#: window; the two tall pages are shown fit-to-width; a tooltip page is a small card in the middle.
STANDARD_BOX = (374, 0, 374 + 2667, 1500)
TALL_BOX = (28, 20, 3370, 1500)
TOOLTIP_BOX = (1150, 340, 2260, 1330)

#: Desktop writes one file per page display name; the repo uses stable lowercase names.
SLUGS: dict[str, str] = {
    "Overview": "01-overview",
    "Driver Intelligence": "02-driver-intelligence",
    "Constructor Analysis": "03-constructor-analysis",
    "Race & Circuit Explorer": "04-race-circuit-explorer",
    "Qualifying & Race Performance": "05-qualifying-race-performance",
    "Pit Stop Analysis": "06-pit-stop-analysis",
    "F1 Through the Eras": "07-f1-through-the-eras",
    "Data Quality & Coverage": "08-data-quality-coverage",
    "Driver tooltip": "tooltip-driver",
    "Constructor tooltip": "tooltip-constructor",
    "Season tooltip": "tooltip-season",
}
TALL_PAGES = frozenset({"04-race-circuit-explorer", "08-data-quality-coverage"})

BEFORE_NOTES = [
    "Same headline on every page",
    "Five colours with no meaning",
    "Boxed panels, gridlines, tilted labels",
    "Dual-axis charts",
    "Five takeaway lines nobody reads",
]
AFTER_NOTES = [
    "A headline that states the finding, live",
    "One accent: amber marks the story",
    "White space instead of boxes and gridlines",
    "Dual-axis charts split into two aligned ones",
    'A "Next" button: eight pages, one story',
]


def crop_capture(src: Path, dst: Path, slug: str) -> Path:
    """Crop one Desktop capture to the report page and scale it to 1920 px wide."""
    width = PAGE_WIDTH
    if slug.startswith("tooltip-"):
        box, width = TOOLTIP_BOX, TOOLTIP_WIDTH
    elif slug in TALL_PAGES:
        box = TALL_BOX
    else:
        box = STANDARD_BOX
    page = Image.open(src).convert("RGB").crop(box)
    height = round(page.height * width / page.width)
    dst.parent.mkdir(parents=True, exist_ok=True)
    page.resize((width, height), Image.Resampling.LANCZOS).save(dst, optimize=True)
    return dst


def crop_captures(src_dir: Path, out_dir: Path) -> list[Path]:
    """Crop and rename every capture in ``src_dir`` whose page name is known. Returns the files written."""
    written = []
    for name, slug in SLUGS.items():
        source = src_dir / f"{name}.png"
        if source.is_file():
            written.append(crop_capture(source, out_dir / f"{slug}.png", slug))
    return written


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Segoe UI on Windows, DejaVu elsewhere, Pillow's default as the last resort."""
    for name in ("segoeuib.ttf" if bold else "segoeui.ttf", "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def before_after(before: Path, after: Path, out: Path) -> Path:
    """Compose two cropped Overview pages side by side with short captions."""
    page_width = 1140
    left, right = 48, 48 + page_width + 24
    top = 214
    canvas = Image.new("RGB", CANVAS, BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((48, 26), "Same report. Same data. One book later.", font=_font(60, True), fill=TEXT)
    draw.text(
        (48, 108), "Applying Storytelling with Data to an AI-built Power BI dashboard", font=_font(34), fill=MUTED
    )
    draw.text((left, top - 58), "BEFORE", font=_font(40, True), fill=MUTED)
    draw.text((right, top - 58), "AFTER", font=_font(40, True), fill=AMBER)
    size = (page_width, round(page_width * 9 / 16))
    page_before = Image.open(before).convert("RGB").resize(size, Image.Resampling.LANCZOS)
    page_after = Image.open(after).convert("RGB").resize(size, Image.Resampling.LANCZOS)
    canvas.paste(page_before, (left, top))
    canvas.paste(page_after, (right, top))
    page_height = size[1]
    draw.rectangle((left - 1, top - 1, left + page_width, top + page_height), outline=(60, 66, 76), width=2)
    draw.rectangle((right - 1, top - 1, right + page_width, top + page_height), outline=AMBER, width=3)
    for i, (b, a) in enumerate(zip(BEFORE_NOTES, AFTER_NOTES, strict=True)):
        y = top + page_height + 34 + i * 56
        draw.text((left, y), "•  " + b, font=_font(37), fill=MUTED)
        draw.text((right, y), "•  " + a, font=_font(37), fill=TEXT)
        draw.text((right, y), "•", font=_font(37, True), fill=AMBER)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)
    return out
