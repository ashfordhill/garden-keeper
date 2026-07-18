import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")

from app.vectorize import mask_to_polygon


def _rasterize(polygon: list[tuple[float, float]], shape: tuple[int, int]) -> np.ndarray:
    out = np.zeros(shape, dtype=np.uint8)
    pts = np.round(np.array(polygon)).astype(np.int32).reshape(-1, 1, 2)
    cv2.fillPoly(out, [pts], 1)
    return out


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    a = a > 0
    b = b > 0
    union = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / union) if union else 0.0


def test_empty_mask_returns_empty():
    assert mask_to_polygon(np.zeros((50, 50), dtype=np.uint8)) == []


def test_rectangle():
    mask = np.zeros((100, 120), dtype=np.uint8)
    mask[20:80, 30:100] = 1
    polygon = mask_to_polygon(mask, max_vertices=16)
    assert 3 <= len(polygon) <= 16
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    assert min(xs) == pytest.approx(30, abs=1)
    assert max(xs) == pytest.approx(99, abs=1)
    assert min(ys) == pytest.approx(20, abs=1)
    assert max(ys) == pytest.approx(79, abs=1)
    assert _iou(_rasterize(polygon, mask.shape), mask) > 0.95


def test_circle_honors_max_vertices():
    mask = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(mask, (100, 100), 70, 1, thickness=-1)
    for budget in (8, 32, 64):
        polygon = mask_to_polygon(mask, max_vertices=budget)
        assert 3 <= len(polygon) <= budget
        assert _iou(_rasterize(polygon, mask.shape), mask) > 0.85


def test_blob_with_hole_uses_outer_contour_only():
    mask = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(mask, (100, 100), 80, 1, thickness=-1)
    cv2.circle(mask, (100, 100), 30, 0, thickness=-1)  # punch a hole
    polygon = mask_to_polygon(mask, max_vertices=64)
    filled = _rasterize(polygon, mask.shape)
    # Outer boundary matches the outer disc; the hole is ignored.
    outer = np.zeros_like(mask)
    cv2.circle(outer, (100, 100), 80, 1, thickness=-1)
    assert _iou(filled, outer) > 0.95
    assert filled[100, 100] == 1  # hole interior is inside the polygon


def test_largest_of_multiple_components_wins():
    mask = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(mask, (60, 60), 15, 1, thickness=-1)
    cv2.circle(mask, (140, 140), 45, 1, thickness=-1)
    polygon = mask_to_polygon(mask, max_vertices=64)
    big = np.zeros_like(mask)
    cv2.circle(big, (140, 140), 45, 1, thickness=-1)
    assert _iou(_rasterize(polygon, mask.shape), big) > 0.9
