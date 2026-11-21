# MECHmetriQ (MechOneHub) Smart Quote Isolated CAD Worker (v1)
# Security: Non-root execution (CIS Docker Benchmark 4.1), zero database credentials.
FROM python:3.15-slim

# OpenCascade (via cadquery-ocp) needs X/GL shared libraries even headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 libxrender1 libxext6 libsm6 libx11-6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Never run as root.
RUN useradd --create-home parser
USER parser

ENV PORT=8080 \
    SMARTQUOTE_MAX_MB=50 \
    SMARTQUOTE_TIMEOUT_S=120 \
    WEB_CONCURRENCY=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${WEB_CONCURRENCY:-1}"]
