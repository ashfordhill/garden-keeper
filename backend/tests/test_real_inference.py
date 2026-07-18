"""Real-SAM inference tests (marked slow; excluded from the default run).

Run with:  python -m pytest -m slow -q
They load real weights (downloading on first use) and skip cleanly when the
model or its dependencies are unavailable.
"""

import io
import time
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

pytestmark = pytest.mark.slow

cv2 = pytest.importorskip("cv2")

FIXTURE = Path(__file__).parent / "fixtures" / "garden.png"

# Feature colors / bboxes must match tests/fixtures/make_garden.py.
BUSH_GREEN = (20, 90, 30)
BED_BROWN = (120, 72, 30)
BED_BBOX = (300, 260, 560, 400)


@pytest.fixture(scope="module")
def client(request):
    import os

    os.environ["GK_INFERENCE"] = "sam"
    request.addfinalizer(lambda: os.environ.pop("GK_INFERENCE", None))

    from app import sam_engine

    try:
        sam_engine.get_engine()
    except Exception as exc:
        pytest.skip(f"SAM model unavailable: {exc}")

    from app.main import app

    return TestClient(app)


@pytest.fixture(scope="module")
def garden(client) -> tuple[str, Image.Image]:
    image = Image.open(FIXTURE).convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    res = client.post(
        "/api/photos", files={"file": ("garden.png", buf.getvalue(), "image/png")}
    )
    assert res.status_code == 200
    return res.json()["imageId"], image


def _color_mask(image: Image.Image, color: tuple[int, int, int]) -> np.ndarray:
    arr = np.asarray(image).astype(int)
    dist = np.abs(arr - np.array(color)).sum(axis=2)
    return (dist < 30).astype(np.uint8)


def _polygon_iou(polygon, truth: np.ndarray) -> float:
    filled = np.zeros_like(truth)
    pts = np.round(np.array(polygon)).astype(np.int32).reshape(-1, 1, 2)
    cv2.fillPoly(filled, [pts], 1)
    inter = np.logical_and(filled, truth).sum()
    union = np.logical_or(filled, truth).sum()
    return float(inter / union) if union else 0.0


def test_point_click_on_bush_returns_tight_polygon(client, garden):
    image_id, image = garden
    truth = _color_mask(image, BUSH_GREEN)
    ys, xs = np.nonzero(truth)
    cx, cy = float(xs.mean()), float(ys.mean())

    start = time.perf_counter()
    res = client.post(
        f"/api/photos/{image_id}/segment",
        json={"points": [{"x": cx, "y": cy, "label": 1}]},
    )
    print(f"\nsegment (first call, incl. image encode): {time.perf_counter() - start:.2f}s")
    assert res.status_code == 200
    regions = res.json()["regions"]
    assert len(regions) == 1
    region = regions[0]
    assert region["score"] > 0.6  # a real prediction, well above the 0.5 stub
    iou = _polygon_iou(region["polygon"], truth)
    print(f"bush IoU: {iou:.3f}, score: {region['score']:.3f}")
    assert iou > 0.7


def test_repeat_click_uses_embedding_cache(client, garden):
    image_id, image = garden
    truth = _color_mask(image, BED_BROWN)
    ys, xs = np.nonzero(truth)
    cx, cy = float(xs.mean()), float(ys.mean())

    start = time.perf_counter()
    res = client.post(
        f"/api/photos/{image_id}/segment",
        json={"points": [{"x": cx, "y": cy, "label": 1}]},
    )
    elapsed = time.perf_counter() - start
    print(f"\nsegment (cached embedding): {elapsed:.2f}s")
    assert res.status_code == 200
    iou = _polygon_iou(res.json()["regions"][0]["polygon"], truth)
    print(f"bed IoU: {iou:.3f}")
    assert iou > 0.7


def test_box_prompt(client, garden):
    image_id, image = garden
    truth = _color_mask(image, BED_BROWN)
    x1, y1, x2, y2 = BED_BBOX
    res = client.post(
        f"/api/photos/{image_id}/segment",
        json={"box": {"x1": x1 - 10, "y1": y1 - 10, "x2": x2 + 10, "y2": y2 + 10}},
    )
    assert res.status_code == 200
    iou = _polygon_iou(res.json()["regions"][0]["polygon"], truth)
    print(f"\nbox-prompt bed IoU: {iou:.3f}")
    assert iou > 0.7


def test_background_point_excludes_region(client, garden):
    """Foreground click on the bed plus a background click on the bush must
    not return a mask that covers the bush."""
    image_id, image = garden
    bed = _color_mask(image, BED_BROWN)
    bush = _color_mask(image, BUSH_GREEN)
    bed_ys, bed_xs = np.nonzero(bed)
    bush_ys, bush_xs = np.nonzero(bush)
    res = client.post(
        f"/api/photos/{image_id}/segment",
        json={
            "points": [
                {"x": float(bed_xs.mean()), "y": float(bed_ys.mean()), "label": 1},
                {"x": float(bush_xs.mean()), "y": float(bush_ys.mean()), "label": 0},
            ]
        },
    )
    assert res.status_code == 200
    polygon = res.json()["regions"][0]["polygon"]
    filled = np.zeros_like(bush)
    pts = np.round(np.array(polygon)).astype(np.int32).reshape(-1, 1, 2)
    cv2.fillPoly(filled, [pts], 1)
    bush_overlap = np.logical_and(filled, bush).sum() / bush.sum()
    print(f"\noverlap with background-labelled bush: {bush_overlap:.3f}")
    assert bush_overlap < 0.2


def test_max_vertices_respected(client, garden):
    image_id, image = garden
    truth = _color_mask(image, BUSH_GREEN)
    ys, xs = np.nonzero(truth)
    res = client.post(
        f"/api/photos/{image_id}/segment",
        json={
            "points": [{"x": float(xs.mean()), "y": float(ys.mean()), "label": 1}],
            "maxVertices": 12,
        },
    )
    assert res.status_code == 200
    assert 3 <= len(res.json()["regions"][0]["polygon"]) <= 12
