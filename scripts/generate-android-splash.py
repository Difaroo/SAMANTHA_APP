#!/usr/bin/env python3
"""Render Android splash assets from the app's canonical Samantha lockup."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
LOGO = ROOT / "public" / "samantha_flame_eternal_trans.png"
FONT = Path("/System/Library/Fonts/HelveticaNeue.ttc")
DENSITY_SCALE = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}


def density_scale(path: Path) -> float:
    qualifier = path.parent.name
    density = qualifier.rsplit("-", 1)[-1]
    return DENSITY_SCALE.get(density, 1)


def tracked_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, tracking: int) -> Image.Image:
    widths = [draw.textlength(character, font=font) for character in text]
    width = round(sum(widths) + tracking * (len(text) - 1))
    ascent, descent = font.getmetrics()
    image = Image.new("RGBA", (width + 4, ascent + descent + 4), (0, 0, 0, 0))
    layer = ImageDraw.Draw(image)
    x = 2
    for character, character_width in zip(text, widths):
        layer.text((x, 2), character, font=font, fill=(245, 245, 245, 230))
        x += character_width + tracking
    return image


def render(path: Path) -> None:
    existing = Image.open(path)
    width, height = existing.size
    scale = density_scale(path)

    background = Image.new("RGB", (width, height), (10, 10, 10))
    pixels = background.load()
    fade_start = int(height * 0.62)
    fade_span = max(1, height - fade_start)
    purple = (34, 17, 48)
    for y in range(fade_start, height):
        amount = ((y - fade_start) / fade_span) ** 1.35
        colour = tuple(round(10 + (channel - 10) * amount) for channel in purple)
        for x in range(width):
            pixels[x, y] = colour

    canvas = background.convert("RGBA")
    logo_size = round(176 * scale)
    logo = Image.open(LOGO).convert("RGBA").resize(
        (logo_size, logo_size),
        Image.Resampling.LANCZOS,
    )
    font = ImageFont.truetype(str(FONT), round(24 * scale), index=12)
    text_probe = ImageDraw.Draw(canvas)
    wordmark = tracked_text(text_probe, "SAMANTHA", font, max(1, round(5 * scale)))

    overlap = round(16 * scale)
    block_height = logo.height + wordmark.height - overlap
    # The in-app CTA top is 216dp above the viewport bottom. Centre the
    # lockup between the viewport top and that edge; clamp shallow landscape
    # assets so the complete lockup remains visible.
    target_center = height / 2 - 108 * scale
    safe_center = max(target_center, block_height / 2 + 16 * scale)
    top = round(safe_center - block_height / 2)
    canvas.alpha_composite(logo, (round((width - logo.width) / 2), top))
    canvas.alpha_composite(
        wordmark,
        (round((width - wordmark.width) / 2), top + logo.height - overlap),
    )
    canvas.convert("RGB").save(path, optimize=True)


def main() -> None:
    targets = sorted(RES.glob("drawable*/splash.png"))
    if not targets:
        raise SystemExit("No Android splash assets found")
    for target in targets:
        render(target)
        print(target.relative_to(ROOT))


if __name__ == "__main__":
    main()
