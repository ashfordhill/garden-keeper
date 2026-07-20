"""Axis-aligned crop from four corner picks.

Takes the bounding box of the marked corners (TL, TR, BR, BL in photo pixels)
and returns that region as a new image. No perspective warp. Long edge is
clamped so HSV layout extraction stays fast.
"""

from PIL import Image

from .models import RectifyRequest

# Cap output so layout / label refine stay responsive on large phone photos.
MAX_EDGE_PX = 1600


def rectify(image: Image.Image, req: RectifyRequest) -> tuple[Image.Image, float]:
    """Crop the axis-aligned bbox of ``req.corners``.

    ``realWidth`` / ``realHeight`` on the request (if present) are ignored —
    kept only for API compatibility with older clients.
    Returns (cropped_image, pixelsPerUnit_placeholder).
    """
    xs = [float(c[0]) for c in req.corners]
    ys = [float(c[1]) for c in req.corners]
    x1 = max(0, int(min(xs)))
    y1 = max(0, int(min(ys)))
    x2 = min(image.width, int(max(xs) + 0.999999))
    y2 = min(image.height, int(max(ys) + 0.999999))
    if x2 <= x1:
        x2 = min(image.width, x1 + 1)
    if y2 <= y1:
        y2 = min(image.height, y1 + 1)

    cropped = image.convert("RGB").crop((x1, y1, x2, y2))
    w, h = cropped.size
    long_edge = max(w, h)
    if long_edge > MAX_EDGE_PX:
        scale = MAX_EDGE_PX / long_edge
        cropped = cropped.resize(
            (max(1, round(w * scale)), max(1, round(h * scale))),
            Image.Resampling.LANCZOS,
        )

    # No real-world calibration anymore; placeholder keeps response shape stable.
    return cropped, 1.0
