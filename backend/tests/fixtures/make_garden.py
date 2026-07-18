"""Generate the synthetic garden test image (tests/fixtures/garden.png).

A grass-textured background with distinct, saturated garden features whose
exact colors double as ground truth: tests threshold on the feature color to
recover the true mask and compare it against SAM's polygon.

Run once to (re)create the fixture:  python tests/fixtures/make_garden.py
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = (640, 480)

# Pure feature colors (ground truth recoverable by exact-ish color match).
BUSH_GREEN = (20, 90, 30)
BED_BROWN = (120, 72, 30)
STONE_GRAY = (150, 150, 155)

BUSH_BBOX = (60, 70, 220, 210)  # ellipse
BED_BBOX = (300, 260, 560, 400)  # rounded rectangle
STONE_BBOX = (420, 60, 540, 170)  # ellipse


def make_garden() -> Image.Image:
    rng = random.Random(42)
    img = Image.new("RGB", SIZE, (110, 160, 80))
    draw = ImageDraw.Draw(img)
    # Grass speckle so the background isn't a flat color.
    for _ in range(6000):
        x = rng.randrange(SIZE[0])
        y = rng.randrange(SIZE[1])
        g = rng.randint(130, 185)
        draw.point((x, y), fill=(rng.randint(85, 125), g, rng.randint(55, 95)))

    draw.ellipse(BUSH_BBOX, fill=BUSH_GREEN)
    draw.rounded_rectangle(BED_BBOX, radius=30, fill=BED_BROWN)
    draw.ellipse(STONE_BBOX, fill=STONE_GRAY)
    return img


if __name__ == "__main__":
    out = Path(__file__).parent / "garden.png"
    make_garden().save(out)
    print(f"wrote {out}")
