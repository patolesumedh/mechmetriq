---
title: MECHmetriQ Smart Quote parser
emoji: ⚙️
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
---

STEP-file analysis API for MECHmetriQ (Smart Quote v1).

- `GET /health`
- `POST /analyze` — multipart field `file` (.step/.stp), header `X-API-Key`

Set the Space secret `SMARTQUOTE_API_KEY`. Source: github.com/patolesumedh/mechmetriq, `services/smartquote`.
