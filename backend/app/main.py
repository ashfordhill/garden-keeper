"""Garden Keeper inference API.

Routes are the FROZEN CONTRACT from Wave 1; implementations behind them are
upgraded by Agent C in Wave 2 (see segment.py / vectorize.py / homography.py).
"""

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from . import homography, photos, segment
from .models import (
    PhotoUploadResponse,
    RectifyRequest,
    RectifyResponse,
    SegmentRequest,
    SegmentResponse,
)

app = FastAPI(title="Garden Keeper API", version="0.1.0")

# Dev convenience (Vite dev server proxies /api, but allow direct calls too).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str | None]:
    inference, model = segment.current_inference()
    return {"status": "ok", "inference": inference, "model": model}


@app.post("/api/photos")
async def upload_photo(file: UploadFile) -> PhotoUploadResponse:
    try:
        image = photos.load_bytes(await file.read())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Not a readable image: {exc}")
    image_id = photos.put(image)
    return PhotoUploadResponse(imageId=image_id, width=image.width, height=image.height)


@app.get("/api/photos/{image_id}/image")
def get_photo(image_id: str) -> Response:
    photo = photos.get(image_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Unknown imageId")
    return Response(content=photos.to_png_bytes(photo.image), media_type="image/png")


@app.post("/api/photos/{image_id}/segment")
def segment_photo(image_id: str, req: SegmentRequest) -> SegmentResponse:
    photo = photos.get(image_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Unknown imageId")
    return segment.segment(photo, req, image_id=image_id)


@app.post("/api/photos/{image_id}/rectify")
def rectify_photo(image_id: str, req: RectifyRequest) -> RectifyResponse:
    photo = photos.get(image_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Unknown imageId")
    rectified, ppu = homography.rectify(photo.image, req)
    new_id = photos.put(rectified)
    return RectifyResponse(
        imageId=new_id,
        width=rectified.width,
        height=rectified.height,
        pixelsPerUnit=ppu,
    )
