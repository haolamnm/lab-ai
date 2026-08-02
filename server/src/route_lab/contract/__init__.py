"""The JSON contract shared with the frontend.

Every model here mirrors a type in ``web/src/lib/types.ts`` (or the ``PlanInput``
in ``web/src/lib/search.ts``). That file is the authoritative definition; these
are the Python side of the same wire format. Field names are Python
``snake_case`` and serialise to the ``camelCase`` the frontend sends and expects,
via a ``to_camel`` alias generator, so neither side has to translate by hand.

This package is a pure leaf: it imports nothing else from ``route_lab``, which
import-linter enforces. A contract that reached into the algorithms or the
planner would stop being a contract and start being an implementation.
"""

from route_lab.contract.conditions import Conditions, PeriodKey, VehicleKey, Weights
from route_lab.contract.graph import (
    Detail,
    GraphEdge,
    GraphNode,
    GraphPayload,
    RoadClass,
    TurnRule,
    TurnTable,
)
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.contract.result import Metrics, Reveal, RouteResult, TraceStep

__all__ = [
    "AlgoKey",
    "Conditions",
    "Detail",
    "GraphEdge",
    "GraphNode",
    "GraphPayload",
    "Metrics",
    "PeriodKey",
    "PlanRequest",
    "Reveal",
    "RoadClass",
    "RouteResult",
    "TraceStep",
    "TurnRule",
    "TurnTable",
    "VehicleKey",
    "Weights",
]
