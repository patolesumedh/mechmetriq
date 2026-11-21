"""
HMAC-signed callback helper for the isolated CAD worker.

The CAD worker holds ZERO database credentials. Instead, it POSTs analysis
results (or sanitized failure states) to `${WEB_CALLBACK_URL}/api/internal/cad-result`
signed with `CAD_CALLBACK_SECRET` (`x-cad-timestamp`, `x-cad-signature`).
"""

import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict


def send_cad_callback(payload: Dict[str, Any]) -> None:
    base_url = os.environ.get("WEB_CALLBACK_URL", "").strip().rstrip("/")
    secret = os.environ.get("CAD_CALLBACK_SECRET", "").strip()
    if not base_url or not secret:
        raise RuntimeError("WEB_CALLBACK_URL and CAD_CALLBACK_SECRET must be set for callback delivery.")

    endpoint = f"{base_url}/api/internal/cad-result"
    raw_body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    ts = str(int(time.time()))
    sig = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.{raw_body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    req = urllib.request.Request(
        endpoint,
        data=raw_body.encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-cad-timestamp": ts,
            "x-cad-signature": sig,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        status = resp.getcode()
        if status < 200 or status >= 300:
            raise RuntimeError(f"Callback returned HTTP {status}.")
