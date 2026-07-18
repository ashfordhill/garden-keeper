# Garden Keeper backend

FastAPI service behind the photo-tracing feature: photo upload, SAM-based
segmentation (click/box -> polygon), and perspective rectification.

## Setup (local dev)

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows; use .venv/bin/activate on POSIX

# IMPORTANT: install torch from the CPU wheel index FIRST, otherwise pip
# resolves the default (CUDA) build, which is multiple GB.
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-dev.txt

uvicorn app.main:app --reload
```

## Inference modes

The segmentation backend is selected with the `GK_INFERENCE` env var:

| Value  | Behavior |
| ------ | -------- |
| `auto` (default) | Real SAM inference; falls back to the blob stub with a logged warning if the model or its deps are unavailable. |
| `stub` | Always the blob stub — no torch, no weights. Used by CI and by frontend devs who don't need real masks. |
| `sam`  | Force real inference; load errors propagate as 500s instead of silently degrading. |

`GET /api/health` reports which backend the next segment call will use:
`{"status": "ok", "inference": "sam" | "stub", "model": "<hf id>" | null}`.

### Model selection

- `GK_SAM_MODEL` — Hugging Face model id, default `Zigeng/SlimSAM-uniform-77`
  (a pruned, CPU-friendly SAM; any transformers `SamModel` checkpoint works,
  e.g. `facebook/sam-vit-base`).
- `GK_CHECKPOINT_DIR` — where weights are downloaded on first use, default
  `backend/checkpoints/` (gitignored). In Docker it defaults to
  `/srv/checkpoints`; mount a volume there so weights survive restarts:

```yaml
# docker-compose.yml
backend:
  build: ./backend
  volumes:
    - gk-checkpoints:/srv/checkpoints
```

The model is lazy-loaded on the first segment call (uploads and rectify stay
fast), and image embeddings are cached per `imageId`, so the first click on a
photo pays the encoder cost and subsequent clicks only run the mask decoder.

## Tests

```bash
python -m pytest -q            # fast suite, stub inference, no weights needed
python -m pytest -m slow -q    # real-inference tests; downloads weights on
                               # first run, skips cleanly if the model can't load
```
