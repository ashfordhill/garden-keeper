"""Real SAM inference engine (transformers SamModel, CPU).

Default checkpoint is SlimSAM-uniform-77: a pruned SAM ViT that runs well on
CPU with ~half the encoder cost of ViT-B while keeping the same prompt
interface. Any transformers-compatible SAM checkpoint works via GK_SAM_MODEL
(e.g. "facebook/sam-vit-base").

Design:
  - Lazy module-level singleton: nothing heavy is imported or downloaded until
    the first real segment call. Load failures are cached so every click
    doesn't retry a broken download.
  - Per-imageId embedding cache: SAM encodes the image once (the expensive
    part); subsequent prompts on the same photo only run the cheap mask
    decoder.
  - Weights download to GK_CHECKPOINT_DIR (default backend/checkpoints/,
    gitignored) on first use.
"""

import logging
import os
import threading
from collections import OrderedDict
from pathlib import Path

import numpy as np

from .models import BoxPrompt, SegmentedRegion, SegmentRequest, SegmentResponse
from .photos import StoredPhoto
from .vectorize import mask_to_polygon

log = logging.getLogger(__name__)

DEFAULT_MODEL = "Zigeng/SlimSAM-uniform-77"
_EMBED_CACHE_SIZE = 8

_lock = threading.Lock()
_engine: "SamEngine | None" = None
_load_error: Exception | None = None


class ModelUnavailableError(RuntimeError):
    """Raised when the SAM model cannot be loaded (deps or weights missing)."""


def model_name() -> str:
    return os.environ.get("GK_SAM_MODEL", DEFAULT_MODEL)


def checkpoint_dir() -> str:
    default = Path(__file__).resolve().parent.parent / "checkpoints"
    return os.environ.get("GK_CHECKPOINT_DIR", str(default))


def is_loaded() -> bool:
    return _engine is not None


def get_engine() -> "SamEngine":
    """Return the singleton engine, loading it on first call."""
    global _engine, _load_error
    with _lock:
        if _engine is not None:
            return _engine
        if _load_error is not None:
            raise ModelUnavailableError(str(_load_error)) from _load_error
        try:
            _engine = SamEngine(model_name(), checkpoint_dir())
        except Exception as exc:
            _load_error = exc
            raise ModelUnavailableError(str(exc)) from exc
        return _engine


class SamEngine:
    def __init__(self, model_id: str, cache_dir: str) -> None:
        import torch
        from transformers import SamModel, SamProcessor

        log.info("Loading SAM model %s (cache dir %s)", model_id, cache_dir)
        self.torch = torch
        self.model_id = model_id
        self.processor = SamProcessor.from_pretrained(model_id, cache_dir=cache_dir)
        self.model = SamModel.from_pretrained(model_id, cache_dir=cache_dir)
        self.model.eval()
        # imageId -> image embeddings from the (expensive) vision encoder.
        self._embeddings: OrderedDict[str, "torch.Tensor"] = OrderedDict()
        self._infer_lock = threading.Lock()

    def _image_embeddings(self, image_id: str, photo: StoredPhoto):
        cached = self._embeddings.get(image_id)
        if cached is not None:
            self._embeddings.move_to_end(image_id)
            return cached
        inputs = self.processor(images=photo.image, return_tensors="pt")
        with self.torch.no_grad():
            embeddings = self.model.get_image_embeddings(inputs["pixel_values"])
        self._embeddings[image_id] = embeddings
        while len(self._embeddings) > _EMBED_CACHE_SIZE:
            self._embeddings.popitem(last=False)
        return embeddings

    def segment(
        self, image_id: str, photo: StoredPhoto, req: SegmentRequest
    ) -> SegmentResponse:
        if req.points:
            input_points = [[[p.x, p.y] for p in req.points]]
            input_labels = [[p.label for p in req.points]]
        else:
            input_points = None
            input_labels = None
        if req.box:
            input_boxes = [[[req.box.x1, req.box.y1, req.box.x2, req.box.y2]]]
        else:
            input_boxes = None
        if input_points is None and input_boxes is None:
            # SAM needs some prompt; default to the photo center.
            input_points = [[[photo.width / 2, photo.height / 2]]]
            input_labels = [[1]]

        with self._infer_lock:
            embeddings = self._image_embeddings(image_id, photo)
            inputs = self.processor(
                images=photo.image,
                input_points=input_points,
                input_labels=input_labels,
                input_boxes=input_boxes,
                return_tensors="pt",
            )
            inputs.pop("pixel_values")
            with self.torch.no_grad():
                outputs = self.model(
                    **inputs, image_embeddings=embeddings, multimask_output=True
                )
            masks = self.processor.image_processor.post_process_masks(
                outputs.pred_masks.cpu(),
                inputs["original_sizes"].cpu(),
                inputs["reshaped_input_sizes"].cpu(),
            )

        # masks[0]: (point_batch, num_masks, H, W); scores: (1, point_batch, num_masks)
        scores = outputs.iou_scores[0, 0]
        best = int(scores.argmax())
        mask = masks[0][0, best].numpy().astype(np.uint8)
        score = float(min(max(scores[best].item(), 0.0), 1.0))

        polygon = mask_to_polygon(mask, req.maxVertices)
        if len(polygon) < 3:
            return SegmentResponse(regions=[])
        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        n = len(polygon)
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
                SegmentedRegion(
                    polygon=polygon,
                    bbox=BoxPrompt(x1=min(xs), y1=min(ys), x2=max(xs), y2=max(ys)),
                    areaPx=area,
                    score=score,
                )
            ]
        )
