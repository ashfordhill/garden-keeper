# garden-keeper

An Excalidraw-style garden planner and record-keeper. Draw your garden as
cartoon SVG, trace real layouts from photos with ML-assisted segmentation,
and watch plantings change across seasons.

## Features (building toward)

- Excalidraw-like SVG editor: single-key tools, pan/zoom, undo/redo
- Photo-to-layout: upload a garden photo, click regions, get proportional
  vector shapes (SAM 2 segmentation + perspective calibration)
- Parametric plant icons: every plant is data (foliage / bloom / branching
  params), rendered by one cartoon SVG renderer — no per-species artwork
- Seasonal forms: toggle early-spring through winter and watch blooms and
  foliage change; timelapse playback
- Portable `.garden.json` documents (save/load/autosave), stateless server

## Run

```sh
docker compose up --build
# open http://localhost:8080
```

## Develop

```sh
# frontend (http://localhost:5173, proxies /api to :8000)
cd frontend && npm install && npm run dev

# backend
cd backend
python -m venv .venv && .venv/Scripts/activate  # or source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
pytest
```

## Architecture

- `frontend/` — React 19 + TypeScript + Vite, Zustand store, Zod schemas.
  - `src/document/` — the `GardenDocument` schema (views, elements, species,
    seasonal forms), store, save/load. The core contract.
  - `src/editor/` — SVG canvas, tools, selection, hotkeys.
  - `src/plants/` — parametric plant icon renderer + built-in species catalog.
  - `src/photo/` — photo reference layer, calibration, click-to-segment;
    `api.ts` is the typed client for the backend contract.
  - `src/ui/` — toolbar, sidebar (plant list/filters), season bar.
- `backend/` — FastAPI inference sidecar (segmentation, vectorization,
  perspective rectification). Currently ships stub inference; real SAM 2.1
  integration replaces it behind the same API (`app/models.py`).

Documents are self-contained JSON (embedded species catalog), so gardens are
portable files and the server keeps no state worth backing up.
