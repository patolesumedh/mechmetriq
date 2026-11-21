"""
Smart Quote parser service (v1 + Pub/Sub Push Worker).

Endpoints:
  GET  /health          -> {"ok": true, "version": "smartquote-v1"}
  POST /analyze         -> multipart form field "file" = .step/.stp (protected by X-API-Key: SMARTQUOTE_API_KEY; used for local dev & CI smoke tests)
  POST /pubsub/analyze  -> GCP Pub/Sub authenticated push envelope -> downloads from GCS `uploads/`, writes thumbnail only under `derived/`, and POSTs HMAC-signed result to `${WEB_CALLBACK_URL}/api/internal/cad-result`.

Security Isolation:
  This worker holds ZERO database credentials. It never connects to PostgreSQL directly.
"""

import base64
import hashlib
import hmac
import json
import multiprocessing as mp
import os
import re
import tempfile
import time
import traceback

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile

from .analyze import ANALYSIS_VERSION, analyze_step
from .callback import send_cad_callback

API_KEY = os.environ.get("SMARTQUOTE_API_KEY", "")
MAX_BYTES = int(os.environ.get("SMARTQUOTE_MAX_MB", "50")) * 1024 * 1024
TIMEOUT_S = int(os.environ.get("SMARTQUOTE_TIMEOUT_S", "120"))
GCS_BUCKET = os.environ.get("GCS_CAD_BUCKET", "")
ALLOWED_EXT = (".step", ".stp")
SAFE_UPLOAD_PATH_RE = re.compile(r"^uploads/[0-9a-fA-F-]+/[0-9a-fA-F-]+\.(step|stp)$")
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

app = FastAPI(title="MECHmetriQ Smart Quote parser", version=ANALYSIS_VERSION)


def _worker(path, queue):
    try:
        queue.put(("ok", analyze_step(path)))
    except Exception as exc:  # parser errors come back as a clean message
        queue.put(("error", f"{type(exc).__name__}: {exc}"))
        traceback.print_exc()


def _run_with_timeout(path):
    """Run the parser in a child process so a pathological file can be killed."""
    # "fork" reuses the already-imported CadQuery on Linux, saving ~5 s per request.
    start_method = "fork" if "fork" in mp.get_all_start_methods() else "spawn"
    ctx = mp.get_context(start_method)
    queue = ctx.Queue()
    proc = ctx.Process(target=_worker, args=(path, queue), daemon=True)
    proc.start()
    try:
        status, payload = queue.get(timeout=TIMEOUT_S)
    except Exception:
        proc.kill()
        proc.join(5)
        raise HTTPException(504, f"Analysis took longer than {TIMEOUT_S}s and was stopped.")
    proc.join(5)
    if status == "error":
        raise HTTPException(422, f"Could not analyse this STEP file. {payload}")
    return payload


def _looks_like_step(head: bytes) -> bool:
    return head.lstrip().upper().startswith(b"ISO-10303-21")


def _download_from_gcs(bucket_name: str, object_path: str) -> bytes:
    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_path)
    blob.reload()
    if blob.size is not None and blob.size > MAX_BYTES:
        raise ValueError(f"File is larger than {MAX_BYTES // (1024 * 1024)} MB.")
    data = blob.download_as_bytes()
    if len(data) > MAX_BYTES:
        raise ValueError(f"File is larger than {MAX_BYTES // (1024 * 1024)} MB.")
    return data


def _upload_derived_thumbnail(bucket_name: str, analysis_id: str, png_b64: str) -> str:
    from google.cloud import storage

    derived_path = f"derived/{analysis_id}.png"
    raw_png = base64.b64decode(png_b64)
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(derived_path)
    blob.upload_from_string(raw_png, content_type="image/png")
    return derived_path


@app.get("/health")
def health():
    return {"ok": True, "version": ANALYSIS_VERSION}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), x_api_key: str = Header(default="")):
    if not API_KEY or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(401, "Invalid API key.")

    name = (file.filename or "part.step").lower()
    if not name.endswith(ALLOWED_EXT):
        raise HTTPException(415, "Only .step or .stp files can be analysed.")

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"File is larger than {MAX_BYTES // (1024 * 1024)} MB.")
    if not _looks_like_step(data[:64]):
        raise HTTPException(415, "This file is not a valid STEP (ISO 10303-21) file.")

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "part" + os.path.splitext(name)[1])
        with open(path, "wb") as fh:
            fh.write(data)
        started = time.monotonic()
        result = _run_with_timeout(path)

    result["file_name"] = file.filename
    result["processing_ms"] = int((time.monotonic() - started) * 1000)
    return result


@app.post("/pubsub/analyze")
async def pubsub_analyze(request: Request):
    """
    Handles authenticated GCP Pub/Sub Push envelopes.
    Downloads the uploaded CAD file from GCS (`uploads/`), validates size and
    ISO-10303-21 magic bytes, executes the CadQuery parser in a child process,
    writes any generated thumbnail strictly under `derived/{analysis_id}.png`,
    and reports the result via HMAC-signed callback to the web service.
    """
    try:
        envelope = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON envelope.")

    message = envelope.get("message") if isinstance(envelope, dict) else None
    if not isinstance(message, dict) or "data" not in message:
        raise HTTPException(400, "Missing Pub/Sub message.data.")

    try:
        raw_json = base64.b64decode(message["data"]).decode("utf-8")
        job = json.loads(raw_json)
    except Exception:
        raise HTTPException(400, "Malformed base64 message.data.")

    analysis_id = str(job.get("analysis_id") or "").strip()
    object_path = str(job.get("object_path") or "").strip()
    file_name = str(job.get("file_name") or os.path.basename(object_path) or "part.step").strip()
    bucket_name = str(job.get("bucket") or GCS_BUCKET).strip()

    if not UUID_RE.match(analysis_id):
        # Permanent payload defect: acknowledge so Pub/Sub does not retry infinitely
        return {"ok": False, "ignored": "invalid analysis_id"}

    if not bucket_name or not SAFE_UPLOAD_PATH_RE.match(object_path):
        send_cad_callback({
            "analysis_id": analysis_id,
            "status": "failed",
            "error": "Rejected: invalid storage object path or extension.",
        })
        return {"ok": False, "rejected": True}

    started = time.monotonic()
    try:
        data = _download_from_gcs(bucket_name, object_path)
    except ValueError as ve:
        send_cad_callback({
            "analysis_id": analysis_id,
            "status": "failed",
            "error": str(ve)[:400],
        })
        return {"ok": False, "rejected": True}
    except Exception:
        send_cad_callback({
            "analysis_id": analysis_id,
            "status": "failed",
            "error": "Could not read the uploaded CAD file from storage.",
        })
        return {"ok": False}

    if len(data) < 16 or not _looks_like_step(data[:64]):
        send_cad_callback({
            "analysis_id": analysis_id,
            "status": "failed",
            "error": "Rejected: file is not a valid STEP (ISO 10303-21) file.",
        })
        return {"ok": False, "rejected": True}

    sha256_hex = hashlib.sha256(data).hexdigest()
    ext = os.path.splitext(object_path)[1].lower() or ".step"

    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "part" + ext)
            with open(path, "wb") as fh:
                fh.write(data)
            result = _run_with_timeout(path)
    except HTTPException as he:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        send_cad_callback({
            "analysis_id": analysis_id,
            "status": "failed",
            "error": str(he.detail)[:450],
            "processing_ms": elapsed_ms,
        })
        return {"ok": False, "error": str(he.detail)}

    elapsed_ms = int((time.monotonic() - started) * 1000)
    result["file_name"] = file_name
    result["processing_ms"] = elapsed_ms

    thumbnail_path = None
    png_b64 = result.pop("thumbnail_png_base64", None)
    if png_b64:
        try:
            thumbnail_path = _upload_derived_thumbnail(bucket_name, analysis_id, png_b64)
        except Exception:
            thumbnail_path = None

    send_cad_callback({
        "analysis_id": analysis_id,
        "status": "completed",
        "result": result,
        "thumbnail_path": thumbnail_path,
        "sha256": sha256_hex,
        "processing_ms": elapsed_ms,
    })
    return {"ok": True, "analysis_id": analysis_id, "processing_ms": elapsed_ms}
