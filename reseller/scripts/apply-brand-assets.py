#!/usr/bin/env python3
"""Regenerate every bundled logo asset from one master logo.

Usage:
  python3 reseller/scripts/apply-brand-assets.py                 # default monogram
  python3 reseller/scripts/apply-brand-assets.py --logo my.png --svg my.svg

--logo must be a square PNG of at least 1024x1024. --svg is optional; without it
the in-app SVG logo embeds the PNG. Requires Pillow (pip install pillow).
"""

import argparse
import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[2]
BRAND_DIR = REPO_ROOT / "reseller" / "brand"
ICONS_DIR = REPO_ROOT / "packages" / "twenty-front" / "public" / "images" / "icons"
IN_APP_SVG_LOGO = (
    REPO_ROOT / "packages" / "twenty-front" / "public" / "images" / "integrations" / "twenty-logo.svg"
)

MASTER_SIZE = 1024
SUPERSAMPLING = 4
VIEWBOX = 96
BACKGROUND = "#4F46E5"
FOREGROUND = "#FFFFFF"
STROKE = 10
CORNER_RADIUS = 22

DEFAULT_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="{CORNER_RADIUS}" fill="{BACKGROUND}"/>
  <path d="M34 72V24h18a13 13 0 0 1 0 26H34M49 50l15 22" fill="none" stroke="{FOREGROUND}"
    stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""


def draw_default_monogram(rounded: bool) -> Image.Image:
    size = MASTER_SIZE * SUPERSAMPLING
    scale = size / VIEWBOX
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def point(x: float, y: float) -> tuple[float, float]:
        return (x * scale, y * scale)

    radius = CORNER_RADIUS * scale if rounded else 0
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BACKGROUND)

    width = round(STROKE * scale)
    cap = STROKE * scale / 2

    def dot(x: float, y: float) -> None:
        cx, cy = point(x, y)
        draw.ellipse((cx - cap, cy - cap, cx + cap, cy + cap), fill=FOREGROUND)

    def line(start: tuple[float, float], end: tuple[float, float]) -> None:
        draw.line((point(*start), point(*end)), fill=FOREGROUND, width=width)
        dot(*start)
        dot(*end)

    line((34, 24), (34, 72))
    line((34, 24), (52, 24))
    line((34, 50), (52, 50))
    line((49, 50), (64, 72))
    bowl_radius = 13 + STROKE / 2
    draw.arc(
        (*point(52 - bowl_radius, 37 - bowl_radius), *point(52 + bowl_radius, 37 + bowl_radius)),
        start=-90,
        end=90,
        fill=FOREGROUND,
        width=width,
    )

    return image.resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)


def load_master(logo_path: Path | None, rounded: bool) -> Image.Image:
    if logo_path is None:
        return draw_default_monogram(rounded)

    image = Image.open(logo_path).convert("RGBA")
    if image.width != image.height or image.width < MASTER_SIZE:
        raise SystemExit(f"{logo_path} must be a square PNG of at least {MASTER_SIZE}px")

    return image.resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)


def render_icon(master: Image.Image, width: int, height: int) -> Image.Image:
    if width == height:
        return master.resize((width, height), Image.LANCZOS)

    # Wide tiles and splash screens: centered mark on a transparent canvas.
    mark_size = round(min(width, height) * 0.8)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mark = master.resize((mark_size, mark_size), Image.LANCZOS)
    canvas.paste(mark, ((width - mark_size) // 2, (height - mark_size) // 2), mark)

    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--logo", type=Path, help="square PNG, at least 1024px")
    parser.add_argument("--svg", type=Path, help="vector version of the logo")
    arguments = parser.parse_args()

    rounded_master = load_master(arguments.logo, rounded=True)
    square_master = load_master(arguments.logo, rounded=False)

    icon_paths = sorted(ICONS_DIR.rglob("*.png"))
    for icon_path in icon_paths:
        with Image.open(icon_path) as existing:
            width, height = existing.size

        # iOS applies its own corner mask and rejects transparency.
        master = square_master if icon_path.parent.name == "ios" else rounded_master
        icon = render_icon(master, width, height)
        if icon_path.parent.name == "ios":
            icon = icon.convert("RGB")
        icon.save(icon_path, optimize=True)

    if arguments.svg is not None:
        svg = arguments.svg.read_text()
    elif arguments.logo is not None:
        buffer = io.BytesIO()
        rounded_master.resize((256, 256), Image.LANCZOS).save(buffer, format="PNG", optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode()
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
            f'<image width="96" height="96" href="data:image/png;base64,{encoded}"/></svg>\n'
        )
    else:
        svg = DEFAULT_SVG
    IN_APP_SVG_LOGO.write_text(svg)

    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    rounded_master.save(BRAND_DIR / "logo.png", optimize=True)
    (BRAND_DIR / "logo.svg").write_text(svg)

    print(f"Regenerated {len(icon_paths)} icons, {IN_APP_SVG_LOGO.relative_to(REPO_ROOT)} and reseller/brand/logo.*")


if __name__ == "__main__":
    main()
