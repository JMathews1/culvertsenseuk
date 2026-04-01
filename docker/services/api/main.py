"""
CulvertSense FastAPI service — placeholder.

Replace / extend with real business logic as the project grows.
"""

import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(
    title="CulvertSense API",
    version="0.1.0",
    docs_url="/v1/docs",
    openapi_url="/v1/openapi.json",
)


@app.get("/health", include_in_schema=False)
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/v1/sensors")
async def list_sensors() -> JSONResponse:
    """Placeholder — return a static stub until sensor logic is implemented."""
    return JSONResponse({"sensors": [], "total": 0})
