"""Layout extraction: synthetic garden + label-mask refine."""

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.layout import extract_layout, layout_from_label_mask
from app.main import app

client = TestClient(app)


def make_garden_scene(w: int = 640, h: int = 480) -> Image.Image:
    img = Image.new("RGB", (w, h), (160, 160, 155))
    draw = ImageDraw.Draw(img)
    draw.rectangle((40, 40, w - 40, h - 80), fill=(45, 32, 22))
    path = []
    for i in range(40):
        t = i / 39
        x = 80 + t * (w - 160)
        y = h * 0.55 + np.sin(t * np.pi) * (-h * 0.18)
        path.append((x, y))
    for x, y in path:
        draw.ellipse((x - 28, y - 22, x + 28, y + 22), fill=(60, 150, 55))
    return img


def test_extract_layout_finds_grass_and_mulch():
    regions = extract_layout(make_garden_scene())
    roles = {r.role for r in regions}
    assert "grass" in roles or "mulch" in roles
    assert any(r.area_px > 2000 for r in regions)


def test_extract_layout_keeps_large_lawn():
    """Lawn-dominated sites must not drop grass (old max_area was 65%)."""
    w, h = 400, 300
    img = Image.new("RGB", (w, h), (55, 140, 50))  # mostly grass
    draw = ImageDraw.Draw(img)
    draw.rectangle((20, 20, 160, 140), fill=(50, 35, 22))  # mulch bed
    draw.rectangle((220, 180, 360, 270), fill=(170, 170, 165))  # patio
    regions = extract_layout(img)
    grass = [r for r in regions if r.role == "grass"]
    assert grass, "expected at least one grass region"
    assert max(r.area_px for r in grass) > 0.5 * (w * h)


def test_extract_layout_dark_mulch_not_swallowed_by_grass():
    """Dark warm mulch (hue ~22) must stay mulch; yellowish path stays grass.

    Regression from yard.JPEG: a wide grass HSV band claimed the beds, then
    morphology erased the curved lawn path from the result.
    """
    w, h = 320, 240
    # Near-black / dark warm mulch bed (matches sampled yard mulch RGB)
    img = Image.new("RGB", (w, h), (58, 54, 44))
    draw = ImageDraw.Draw(img)
    # Curved-ish grass path through the middle (yellowish green like the photo)
    for i in range(40):
        t = i / 39
        x = 40 + t * (w - 80)
        y = h * 0.55 + np.sin(t * np.pi) * (-h * 0.2)
        draw.ellipse((x - 22, y - 18, x + 22, y + 18), fill=(95, 110, 50))
    # Concrete strip at top
    draw.rectangle((0, 0, w, 40), fill=(200, 205, 200))
    regions = extract_layout(img)
    by_role = {r.role: r.area_px for r in regions}
    assert by_role.get("grass", 0) > 0.08 * (w * h)
    assert by_role.get("mulch", 0) > 0.25 * (w * h)
    # Grass must not dominate a mulch-majority scene
    assert by_role.get("grass", 0) < by_role.get("mulch", 0)


def test_layout_from_label_mask():
    w, h = 200, 160
    label = Image.new("RGB", (w, h), (0, 0, 0))
    draw = ImageDraw.Draw(label)
    draw.rectangle((0, 0, w, h // 2), fill=(255, 0, 0))  # grass
    draw.rectangle((0, h // 2, w, h), fill=(0, 255, 0))  # mulch
    regions = layout_from_label_mask(label)
    roles = {r.role for r in regions}
    assert "grass" in roles
    assert "mulch" in roles


def test_layout_api_endpoint():
    buf = io.BytesIO()
    make_garden_scene().save(buf, format="PNG")
    up = client.post(
        "/api/photos",
        files={"file": ("garden.png", buf.getvalue(), "image/png")},
    )
    assert up.status_code == 200
    image_id = up.json()["imageId"]
    res = client.post(f"/api/photos/{image_id}/layout", json={"maxVertices": 48})
    assert res.status_code == 200
    for r in res.json()["regions"]:
        assert r["role"] in ("grass", "mulch", "hardscape")


def test_layout_from_labels_api():
    scene = make_garden_scene(200, 160)
    buf = io.BytesIO()
    scene.save(buf, format="PNG")
    up = client.post(
        "/api/photos",
        files={"file": ("g.png", buf.getvalue(), "image/png")},
    )
    image_id = up.json()["imageId"]

    label = Image.new("RGB", (200, 160), (0, 0, 0))
    draw = ImageDraw.Draw(label)
    draw.rectangle((10, 10, 190, 80), fill=(200, 0, 0))
    draw.rectangle((10, 90, 190, 150), fill=(0, 200, 0))
    lbuf = io.BytesIO()
    label.save(lbuf, format="PNG")
    res = client.post(
        f"/api/photos/{image_id}/layout/from-labels",
        files={"file": ("labels.png", lbuf.getvalue(), "image/png")},
    )
    assert res.status_code == 200
    roles = {r["role"] for r in res.json()["regions"]}
    assert "grass" in roles
    assert "mulch" in roles
