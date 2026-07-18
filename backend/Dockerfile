FROM python:3.12-slim

WORKDIR /srv

# CPU-only torch first (its own wheel index), then the rest. Keeps the image
# free of multi-GB CUDA wheels.
COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Model weights are NOT baked into the image: they download on first segment
# call into GK_CHECKPOINT_DIR. Mount a volume there to persist across
# restarts, e.g. in docker-compose:
#   volumes:
#     - gk-checkpoints:/srv/checkpoints
ENV GK_CHECKPOINT_DIR=/srv/checkpoints

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
