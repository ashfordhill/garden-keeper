"""Stub segmentation (moved verbatim from the Wave 1 segment.py).

Returns a plausible organic blob around the prompt so the frontend photo UX
is fully exercisable end-to-end without model weights. Selected with
GK_INFERENCE=stub, and used as the automatic fallback when the real model
cannot load (GK_INFERENCE=auto).
"""

import math

from .models import BoxPrompt, SegmentedRegion, SegmentRequest, SegmentResponse
from .photos import StoredPhoto

STUB_SCORE = 0.5  # deliberately mediocre so stub results are recognizable


def segment_stub(photo: StoredPhoto, req: SegmentRequest) -> SegmentResponse:
    if req.points:
        cx = sum(p.x for p in req.points) / len(req.points)
        cy = sum(p.y for p in req.points) / len(req.points)
        radius = min(photo.width, photo.height) * 0.12
    elif req.box:
        cx = (req.box.x1 + req.box.x2) / 2
        cy = (req.box.y1 + req.box.y2) / 2
        radius = min(abs(req.box.x2 - req.box.x1), abs(req.box.y2 - req.box.y1)) / 2
    else:
        cx, cy = photo.width / 2, photo.height / 2
        radius = min(photo.width, photo.height) * 0.25

    # Wobbly blob: a circle with two superimposed sine harmonics.
    n = min(req.maxVertices, 24)
    polygon: list[tuple[float, float]] = []
    for i in range(n):
        theta = 2 * math.pi * i / n
        r = radius * (1 + 0.15 * math.sin(3 * theta) + 0.08 * math.sin(7 * theta))
        x = min(max(cx + r * math.cos(theta), 0), photo.width)
        y = min(max(cy + r * math.sin(theta), 0), photo.height)
        polygon.append((x, y))

    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    bbox = BoxPrompt(x1=min(xs), y1=min(ys), x2=max(xs), y2=max(ys))
    area = abs(
        sum(
            polygon[i][0] * polygon[(i + 1) % n][1]
            - polygon[(i + 1) % n][0] * polygon[i][1]
            for i in range(n)
        )
        / 2
    )
    return SegmentResponse(
        regions=[
            SegmentedRegion(polygon=polygon, bbox=bbox, areaPx=area, score=STUB_SCORE)
        ]
    )
