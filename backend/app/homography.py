"""Perspective rectification: oblique photo -> top-down view.

OpenCV homography: cv2.getPerspectiveTransform maps the marked quadrilateral
(TL, TR, BR, BL in photo pixels) onto a true-scale rectangle rendered at
DEFAULT_PIXELS_PER_UNIT, then cv2.warpPerspective produces the rectified crop.
"""

import cv2
import numpy as np
from PIL import Image

from .models import RectifyRequest

# Output resolution of the rectified image, pixels per real-world unit.
DEFAULT_PIXELS_PER_UNIT = 40.0


def rectify(image: Image.Image, req: RectifyRequest) -> tuple[Image.Image, float]:
    ppu = DEFAULT_PIXELS_PER_UNIT
    out_w = max(1, round(req.realWidth * ppu))
    out_h = max(1, round(req.realHeight * ppu))

    src = np.array(req.corners, dtype=np.float32)  # TL, TR, BR, BL
    dst = np.array(
        [[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float32
    )
    matrix = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(
        np.asarray(image.convert("RGB")),
        matrix,
        (out_w, out_h),
        flags=cv2.INTER_LINEAR,
    )
    return Image.fromarray(warped), ppu
