# MECHmetriQ Smart Quote parser service (v1)
FROM python:3.11-slim

# OpenCascade (via cadquery-ocp) needs a few X/GL shared libraries even headless.
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

ENV PORT=8000 \
    SMARTQUOTE_MAX_MB=50 \
    SMARTQUOTE_TIMEOUT_S=120 \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY:-2}"]
