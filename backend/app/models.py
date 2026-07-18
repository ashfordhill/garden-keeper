"""FROZEN CONTRACT (Wave 1): API request/response models.

Mirrors frontend/src/photo/api.ts exactly. Additive changes only; keep the
two files in sync.

All coordinates are pixels in the uploaded photo's coordinate system,
origin top-left.
"""

from typing import Literal

from pydantic import BaseModel, Field


class PhotoUploadResponse(BaseModel):
    imageId: str
    width: int
    height: int


class PointPrompt(BaseModel):
    x: float
    y: float
    label: Literal[0, 1] = 1


class BoxPrompt(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class SegmentRequest(BaseModel):
    points: list[PointPrompt] | None = None
    box: BoxPrompt | None = None
    maxVertices: int = Field(default=64, ge=3, le=512)


class SegmentedRegion(BaseModel):
    polygon: list[tuple[float, float]]
    bbox: BoxPrompt
    areaPx: float
    score: float


class SegmentResponse(BaseModel):
    regions: list[SegmentedRegion]


class RectifyRequest(BaseModel):
    """Corner order: top-left, top-right, bottom-right, bottom-left."""

    corners: list[tuple[float, float]] = Field(min_length=4, max_length=4)
    realWidth: float = Field(gt=0)
    realHeight: float = Field(gt=0)


class RectifyResponse(BaseModel):
    imageId: str
    width: int
    height: int
    pixelsPerUnit: float
