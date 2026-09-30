# MECHmetriQ Smart Quote — parser service (v1)

A small web service that reads a STEP file and returns the part's geometry and
machining features as JSON. The MECHmetriQ website calls it every time a buyer
attaches a `.step` / `.stp` file to a quote request.

It runs the v1 algorithm (`app/poc_parsing.py`) unchanged, apart from two
marked `[service fix]` changes:

1. **Full 360° cylinders and cones are now read correctly.** The original
   worked out a face's normal at its area centroid. For a full cylinder that
   centroid sits on the axis, so the calculation failed and every hole, bore
   and OD came out as `UNKNOWN` (no holes found at all). Many CAD tools export
   cylinders this way (Onshape, Fusion, FreeCAD, anything OCC-based). The fix
   uses a point on the surface only when the centroid can't be used.
   STEP files that split cylinders into two halves (SolidWorks style) give
   **byte-identical output** to the original script — checked on
   `samples/turned_lid_split.step`.
2. `tkinter` is imported only by the desktop file picker, so the server
   doesn't need a GUI.

It reads **STEP only**. Drawings (PDF/DWG/images) are stored with the RFQ for
the team but not read by this version.

## API

| Method | Path | |
|---|---|---|
| `GET` | `/health` | `{"ok": true, "version": "smartquote-v1"}` |
| `POST` | `/analyze` | multipart form, field `file` = `.step`/`.stp`. Header `X-API-Key: <SMARTQUOTE_API_KEY>` |

Responses: `200` JSON analysis · `401` bad key · `413` too big · `415` not a
STEP file · `422` STEP couldn't be read (message says why) · `504` took longer
than the timeout and was stopped.

The JSON contains `summary` (bounding box, volume, surface area, face counts),
`bodies`, `feature_sections` (sections 8–16 of the algorithm), `relationships`,
`turning` (stock size, material removed, operation sequence, machinability,
tool-path preview points) and `warnings`.

## Settings (environment variables)

| Name | Default | |
|---|---|---|
| `SMARTQUOTE_API_KEY` | — (required) | Shared secret. Same value goes in Vercel. |
| `SMARTQUOTE_MAX_MB` | `50` | Largest file accepted. |
| `SMARTQUOTE_TIMEOUT_S` | `120` | A file taking longer is stopped. |
| `WEB_CONCURRENCY` | `2` | Parallel requests. Each needs ~300–500 MB RAM for typical parts. |

## Deploy

It's a plain Docker image, so any container host works. Each request uses
**~450 MB RAM** (measured on the samples), so give it **2 GB** for 2 parallel
requests. On Render that's the Standard plan; Free/Starter (512 MB) crash. Pick a region close to Mumbai (Singapore / Mumbai).

**Render (simplest):** New → Blueprint → pick the mechmetriq repo (it reads
`render.yaml` at the repo root). Or New → Web Service → Docker with root
directory `services/smartquote`. Set `SMARTQUOTE_API_KEY`.

**Google Cloud Run / Railway / Fly.io:** build the `Dockerfile`, expose port
`8000` (Cloud Run sets `PORT` itself), 1 GB memory, set `SMARTQUOTE_API_KEY`.

Generate the key once, e.g. `openssl rand -hex 32`.

## Run locally

```bash
pip install -r requirements.txt
SMARTQUOTE_API_KEY=dev-key uvicorn app.main:app --port 8000
curl -H "X-API-Key: dev-key" -F file=@samples/turned_lid.step localhost:8000/analyze
```

`samples/make_samples.py` regenerates the three test parts.

## Measured on the samples

| File | Features | Time |
|---|---|---|
| turned_lid.step (Ø55×12, Ø30 bore, 4×Ø4.2 holes) | 29 | ~2 s |
| turned_lid_split.step (same, SolidWorks-style faces) | 54 | ~3 s |
| milled_block.step (80×50×20, pocket, 2×Ø6 holes) | 36 | ~1 s |

Algorithm observations for v2 (not changed here): on the milled block the two
Ø6 holes are labelled `BORE` (the "≥50 % of largest diameter" rule has no
external cylinder to compare against), the one pocket produces ~20 pocket /
slot / boss candidates, and a prismatic part still gets a turning plan with a
round-bar stock of Ø165 mm. Split-face files report duplicate features (one
per half-face), e.g. 54 vs 29 on the same lid.
