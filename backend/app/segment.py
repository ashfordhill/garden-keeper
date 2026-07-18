"""Segmentation dispatch: photo + prompt -> simplified polygon regions.

Inference backend is selected by the GK_INFERENCE env var:
  - "auto" (default): real SAM inference; if the model or its dependencies
    are unavailable, fall back to the Wave 1 blob stub with a logged warning.
  - "stub": always use the blob stub (no torch/weights needed — used by CI
    and by other agents' machines).
  - "sam": force real inference; errors propagate instead of falling back.

The HTTP-facing response model is the frozen Wave 1 contract.
"""

import logging
import os

from .models import SegmentRequest, SegmentResponse
from .photos import StoredPhoto
from .stub_segment import segment_stub

log = logging.getLogger(__name__)

_warned_fallback = False


def inference_mode() -> str:
    return os.environ.get("GK_INFERENCE", "auto").strip().lower()


def current_inference() -> tuple[str, str | None]:
    """(backend, model) the next segment call will use — for /api/health.

    Never triggers a model load; in auto mode before first use it reports
    "sam" if the inference dependencies are importable.
    """
    mode = inference_mode()
    if mode == "stub":
        return "stub", None
    from . import sam_engine

    if sam_engine.is_loaded():
        return "sam", sam_engine.model_name()
    if mode == "sam":
        return "sam", sam_engine.model_name()
    import importlib.util

    deps_ok = all(
        importlib.util.find_spec(m) is not None for m in ("torch", "transformers")
    )
    if deps_ok:
        return "sam", sam_engine.model_name()
    return "stub", None


def segment(
    photo: StoredPhoto, req: SegmentRequest, image_id: str = ""
) -> SegmentResponse:
    global _warned_fallback
    mode = inference_mode()
    if mode == "stub":
        return segment_stub(photo, req)

    try:
        from . import sam_engine

        engine = sam_engine.get_engine()
    except Exception as exc:
        if mode == "sam":
            raise
        if not _warned_fallback:
            log.warning(
                "SAM model unavailable (%s); falling back to stub segmentation. "
                "Set GK_INFERENCE=stub to silence this warning.",
                exc,
            )
            _warned_fallback = True
        return segment_stub(photo, req)
    return engine.segment(image_id, photo, req)
