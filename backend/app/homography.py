"""Perspective rectification: oblique photo -> top-down view.

WAVE 1 STUB (owned by Agent C in Wave 2): performs a Pillow QUAD transform,
which crops/warps the marked quadrilateral to a true-scale rectangle. This is
already a usable homography for the marked region; Agent C may replace it
with an OpenCV full-frame warp (cv2.getPerspectiveTransform + warpPerspective)
so context around the calibration rectangle is preserved too.
"""

from PIL import Image

from .models import RectifyRequest

# Output resolution of the rectified image, pixels per real-world unit.
DEFAULT_PIXELS_PER_UNIT = 40.0


def rectify(image: Image.Image, req: RectifyRequest) -> tuple[Image.Image, float]:
    ppu = DEFAULT_PIXELS_PER_UNIT
    out_w = max(1, round(req.realWidth * ppu))
    out_h = max(1, round(req.realHeight * ppu))
    tl, tr, br, bl = req.corners
    # PIL QUAD expects NW, SW, SE, NE.
    quad = (tl[0], tl[1], bl[0], bl[1], br[0], br[1], tr[0], tr[1])
    rectified = image.transform(
        (out_w, out_h), Image.Transform.QUAD, quad, resample=Image.Resampling.BILINEAR
    )
    return rectified, ppu
