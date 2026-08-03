"""The HTTP surface — a thin FastAPI wrapper over :func:`plan_route`.

Two endpoints, no state: ``POST /plan`` runs one algorithm across one trip and
returns a ``RouteResult``; ``GET /health`` is for readiness checks. The planner
is pure, so the api layer only handles transport concerns — CORS for the Vite dev
server, and turning an unimplemented algorithm into a normal 200 response whose
``problem`` explains the gap, rather than a 500 that would read as a server
crash. Every algorithm in the registry is written now; that guarantee stays for
the next one, which starts life as a stub like all of these did.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from route_lab.contract.request import PlanRequest
from route_lab.contract.result import RouteResult
from route_lab.planner import plan_route

_DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def _cors_origins() -> list[str]:
    """Allowed browser origins, from ``ROUTELAB_CORS_ORIGINS`` or the dev default."""
    raw = os.environ.get("ROUTELAB_CORS_ORIGINS", _DEFAULT_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="Route Lab planning backend",
    version="0.1.0",
    summary="Runs classical search algorithms over a road graph the frontend supplies.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
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
