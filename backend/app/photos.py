"""In-memory photo store.

The server is stateless across restarts by design: documents own their data;
uploaded photos only need to live as long as a tracing session. If memory
pressure ever matters, swap the dict for an LRU or temp-dir store.
"""

import io
import uuid
from dataclasses import dataclass

from PIL import Image


@dataclass
class StoredPhoto:
    image: Image.Image
    width: int
    height: int


_photos: dict[str, StoredPhoto] = {}


def put(image: Image.Image) -> str:
    image_id = str(uuid.uuid4())
    _photos[image_id] = StoredPhoto(image=image, width=image.width, height=image.height)
    return image_id


def get(image_id: str) -> StoredPhoto | None:
    return _photos.get(image_id)


def load_bytes(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image.convert("RGB")


def to_png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
