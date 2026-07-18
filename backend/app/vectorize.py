"""Mask -> polygon vectorization.

Turns a binary mask into a simplified polygon:
  - largest external contour (cv2.findContours, RETR_EXTERNAL — holes ignored)
  - Douglas-Peucker simplification (cv2.approxPolyDP), binary-searching the
    epsilon for the smallest value that gets under max_vertices, so we keep
    as much detail as the vertex budget allows.

Coordinates are (x, y) floats in the mask's (== photo's) pixel space.
"""

import cv2
import numpy as np


def mask_to_polygon(
    mask: np.ndarray, max_vertices: int = 64
) -> list[tuple[float, float]]:
    """Vectorize a binary mask. Returns [] if the mask has no usable region."""
    binary = np.ascontiguousarray((np.asarray(mask) > 0).astype(np.uint8))
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    contour = max(contours, key=cv2.contourArea)
    if len(contour) < 3 or cv2.contourArea(contour) <= 0:
        return []
    if len(contour) <= max_vertices:
        return _to_points(contour)

    # Binary-search the smallest epsilon that satisfies the vertex budget.
    perimeter = cv2.arcLength(contour, closed=True)
    lo, hi = 0.0, perimeter
    best: np.ndarray | None = None
    for _ in range(40):
        eps = (lo + hi) / 2
        approx = cv2.approxPolyDP(contour, eps, closed=True)
        if len(approx) <= max_vertices:
            if len(approx) >= 3:
                best = approx
            hi = eps
        else:
            lo = eps
    if best is None:
        # Degenerate contour that collapses below a triangle before it fits
        # the budget; nothing sensible to return.
        return []
    return _to_points(best)


def _to_points(contour: np.ndarray) -> list[tuple[float, float]]:
    return [(float(x), float(y)) for x, y in contour[:, 0, :]]
