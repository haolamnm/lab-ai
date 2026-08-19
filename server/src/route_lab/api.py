"""The HTTP surface — a thin FastAPI wrapper over :func:`plan_route`.

Two endpoints, no state: ``POST /plan`` runs one algorithm across one trip and
returns a ``RouteResult``; ``GET /health`` is for readiness checks. There is no
exception handling here, and that is the point — :func:`plan_route` already
turns a degenerate query or an unimplemented algorithm into a normal result
whose ``problem`` explains it, so this layer is left with nothing but transport
concerns: the request contract, the response contract, and CORS for the Vite dev
server.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from route_lab.contract.request import PlanRequest
from route_lab.contract.result import RouteResult
from route_lab.planner import plan_route

_DEFAULT_ORIGINS = "http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173"


def cors_origins() -> list[str]:
    """Allowed browser origins, from ``ROUTELAB_CORS_ORIGINS`` or the dev default.

    Public so it can be asserted on: a stray space or empty entry in the
    deployment's env var produces an origin no browser ever sends, and the only
    symptom is a blocked request in a user's console.
    """
    raw = os.environ.get("ROUTELAB_CORS_ORIGINS", _DEFAULT_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="Route Lab planning backend",
    version="0.1.0",
    summary="Runs classical search algorithms over a road graph the frontend supplies.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness/readiness probe."""
    return {"status": "ok"}


@app.post("/plan")
def plan(request: PlanRequest) -> RouteResult:
    """Plan one algorithm across one trip and return the full result.

    An unimplemented algorithm is not an error here: :func:`plan_route` returns a
    result whose ``problem`` says so, and the pane shows that message.
    """
    return plan_route(request)
