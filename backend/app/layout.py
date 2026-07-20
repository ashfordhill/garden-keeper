"""Color-based garden layout extraction + label-mask refinement.

Materials (stable vocabulary for the Ground layer / future seasons):
  - grass
  - mulch
  - hardscape

Plant foliage is intentionally NOT a ground material — tall green plants
(sunflowers etc.) often get swept into grass on first pass; the wizard's
paint tool lets the user relabel those patches to mulch/hardscape.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np
from PIL import Image

from . import vectorize

LayoutRole = Literal["grass", "mulch", "hardscape"]


@dataclass
class LayoutRegion:
    role: LayoutRole
    polygon: list[tuple[float, float]]
    bbox: tuple[float, float, float, float]
    area_px: float
    score: float


def _pil_to_bgr(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def _bbox(poly: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def _regions_from_mask(
    mask: np.ndarray,
    role: LayoutRole,
    *,
    min_area: float,
    max_area: float,
    max_vertices: int,
    score: float,
) -> list[LayoutRegion]:
    binary = np.ascontiguousarray((mask > 0).astype(np.uint8))
    # Soft morph: close gaps along curved lawn paths, open speckles.
    # Avoid the old 11×11×3 close — it merged foliage/garage trim into one
    # giant grass blob and let mulch close-fill erase the path.
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k, iterations=2)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k, iterations=1)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out: list[LayoutRegion] = []
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area or area > max_area:
            continue
        layer = np.zeros(binary.shape, dtype=np.uint8)
        cv2.drawContours(layer, [contour], -1, 1, thickness=-1)
        poly = vectorize.mask_to_polygon(layer, max_vertices=max_vertices)
        if len(poly) < 3:
            continue
        out.append(
            LayoutRegion(
                role=role,
                polygon=poly,
                bbox=_bbox(poly),
                area_px=area,
                score=score,
            )
        )
    return out


def _classify_materials(bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Pixel masks for grass / mulch / hardscape.

    Tuned against real phone photos of mixed beds: dark warm mulch sits near
    hue 20–25 and used to get swallowed by a wide grass band. Grass now
    requires true green chroma (HSV + RGB G-dominance), not just a greenish hue.
    """
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    hsv = cv2.GaussianBlur(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV), (5, 5), 0)
    h, s, v = [c.astype(np.int16) for c in cv2.split(hsv)]
    r, g, b = [rgb[:, :, i].astype(np.int16) for i in range(3)]

    # Yellowish–green turf / clover path (not dark soil, not white siding).
    grass = (
        (h >= 30)
        & (h <= 90)
        & (s >= 40)
        & (v >= 40)
        & (v <= 210)
        & (g > r + 4)
        & (g > b + 12)
    )

    # Near-black beds or warm brown soil/mulch.
    dark = v <= 85
    brown = (h >= 5) & (h <= 28) & (s >= 25) & (v <= 160)
    mulch = (dark | brown) & ~grass

    # Concrete / stone / pale hard surfaces.
    hard = (s <= 45) & (v >= 70) & (v <= 230) & ~grass & ~mulch

    to_u8 = lambda m: m.astype(np.uint8) * 255
    return to_u8(grass), to_u8(mulch), to_u8(hard)


def extract_layout(
    image: Image.Image,
    *,
    max_vertices: int = 48,
) -> list[LayoutRegion]:
    """First-pass automatic layout from a (preferably rectified) photo."""
    bgr = _pil_to_bgr(image)
    h, w = bgr.shape[:2]
    total = float(w * h)
    grass, mulch, hard = _classify_materials(bgr)

    regions: list[LayoutRegion] = []
    # Allow near-full-frame materials (lawn-dominated or mulch-dominated sites).
    for role, mask, min_frac, max_frac, score in (
        ("grass", grass, 0.004, 1.0, 0.7),
        ("mulch", mulch, 0.008, 1.0, 0.7),
        ("hardscape", hard, 0.008, 0.9, 0.65),
    ):
        regions.extend(
            _regions_from_mask(
                mask,
                role,  # type: ignore[arg-type]
                min_area=total * min_frac,
                max_area=total * max_frac + 1,
                max_vertices=max_vertices,
                score=score,
            )
        )

    regions.sort(key=lambda r: r.area_px, reverse=True)
    return regions


def layout_from_label_mask(
    label_image: Image.Image,
    *,
    max_vertices: int = 48,
) -> list[LayoutRegion]:
    """Rebuild layout from a user-painted label image.

    Encoding (RGB):
      R dominant → grass
      G dominant → mulch
      B dominant → hardscape
    Unlabeled / near-black pixels default to mulch so the site never has holes.
    """
    arr = np.asarray(label_image.convert("RGB"))
    h, w, _ = arr.shape
    total = float(w * h)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brightness = r.astype(np.int16) + g.astype(np.int16) + b.astype(np.int16)
    labeled = brightness > 40
    grass = ((r > g) & (r > b) & labeled).astype(np.uint8) * 255
    hard = ((b > r) & (b > g) & labeled).astype(np.uint8) * 255
    # Everything else (including unlabeled) is mulch — full coverage.
    mulch = np.where((grass > 0) | (hard > 0), 0, 255).astype(np.uint8)

    regions: list[LayoutRegion] = []
    for role, mask in (("grass", grass), ("mulch", mulch), ("hardscape", hard)):
        regions.extend(
            _regions_from_mask(
                mask,
                role,  # type: ignore[arg-type]
                min_area=total * 0.002,
                # Allow full-frame materials (common after user paints).
                max_area=total + 1,
                max_vertices=max_vertices,
                score=0.9,
            )
        )
    regions.sort(key=lambda r: r.area_px, reverse=True)
    return regions
