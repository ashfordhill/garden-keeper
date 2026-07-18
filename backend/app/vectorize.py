"""Mask -> polygon vectorization.

WAVE 1 STUB (owned by Agent C in Wave 2). Agent C implements:
  - largest-contour extraction from a binary mask (OpenCV findContours)
  - Douglas-Peucker simplification down to max_vertices (cv2.approxPolyDP,
    binary-searching epsilon)
Keep the signature: it is called from segment.py once real masks exist.
"""

import numpy as np


def mask_to_polygon(
    mask: np.ndarray, max_vertices: int = 64
) -> list[tuple[float, float]]:
    raise NotImplementedError("Implemented by Agent C in Wave 2")
