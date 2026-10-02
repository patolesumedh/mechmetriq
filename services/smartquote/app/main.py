"""
Smart Quote parser service (v1).

POST /analyze   multipart form field "file" = .step/.stp  -> JSON analysis
GET  /health    -> {"ok": true}

Auth: every /analyze call must send header  X-API-Key: <SMARTQUOTE_API_KEY>.
The website calls this from the server only; the key never reaches a browser.
"""

import hmac
import multiprocessing as mp
import os
import tempfile
import time
import traceback

from fastapi import FastAPI, File, Header, HTTPException, UploadFile

from .analyze import ANALYSIS_VERSION, analyze_step

API_KEY = os.environ.get("SMARTQUOTE_API_KEY", "")
MAX_BYTES = int(os.environ.get("SMARTQUOTE_MAX_MB", "50")) * 1024 * 1024
TIMEOUT_S = int(os.environ.get("SMARTQUOTE_TIMEOUT_S", "120"))
ALLOWED_EXT = (".step", ".stp")

app = FastAPI(title="MECHmetriQ Smart Quote parser", version=ANALYSIS_VERSION)


def _worker(path, queue):
    try:
        queue.put(("ok", analyze_step(path)))
    except Exception as exc:  # parser errors come back as a clean message
        queue.put(("error", f"{type(exc).__name__}: {exc}"))
        traceback.print_exc()


def _run_with_timeout(path):
    """Run the parser in a child process so a pathological file can be killed."""
    # "fork" reuses the already-imported CadQuery, saving ~5 s per request.
    ctx = mp.get_context("fork")
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
