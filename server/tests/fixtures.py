"""A tiny, deterministic graph the tests reason about by hand.

A diamond with a tempting shortcut::

        B
      1/ \\1
      A   D
    1.5\\ /1
        C
      (A -> D direct = 3.0)

Distances are set explicitly on the edges, not derived from the coordinates, so
the arithmetic in a test is exact. With distance-only weights the one cheapest
route is A -> B -> D at cost 2.0; the direct A -> D (3.0) and A -> C -> D (2.5)
both lose.

Everything is built through ``model_validate`` from camelCase dicts, so the
fixtures also exercise the real wire-parsing path the frontend hits.
"""

from __future__ import annotations

from typing import Any

from route_lab.contract.conditions import Weights
from route_lab.contract.graph import GraphPayload
from route_lab.contract.request import PlanRequest

_NODES: dict[str, tuple[float, float]] = {
    "A": (10.770, 106.700),
    "B": (10.780, 106.700),
    "C": (10.770, 106.710),
    "D": (10.780, 106.710),
}

# (from, to, km) — every edge is a plain two-way "secondary" road a motorbike may use.
_EDGES: list[tuple[str, str, float]] = [
    ("A", "B", 1.0),
    ("B", "D", 1.0),
    ("A", "C", 1.5),
    ("C", "D", 1.0),
    ("A", "D", 3.0),
]

# Distance-only, so a test can read the cost straight off the kilometres.
SHORTEST: dict[str, float] = {"distance": 1.0, "time": 0.0, "congestion": 0.0, "risk": 0.0}


def _diamond_dict() -> dict[str, Any]:
    lats = [lat for lat, _ in _NODES.values()]
    lngs = [lng for _, lng in _NODES.values()]
    return {
        "nodes": {
            node_id: {"id": node_id, "lat": lat, "lng": lng}
            for node_id, (lat, lng) in _NODES.items()
        },
        "edges": [
            {
                "from": src,
                "to": dst,
                "km": km,
                "roadClass": "secondary",
                "congestion": 3,
                "risk": 0.2,
            }
            for src, dst, km in _EDGES
        ],
        "bounds": [[min(lats), min(lngs)], [max(lats), max(lngs)]],
        "detail": "coarse",
    }


def diamond_payload() -> GraphPayload:
    """The diamond as a validated graph payload."""
    return GraphPayload.model_validate(_diamond_dict())


def diamond_json(algo: str = "ucs") -> dict[str, Any]:
    """An A -> D plan request as the camelCase JSON the frontend would POST."""
    return {
        "graph": _diamond_dict(),
        "algo": algo,
        "start": "A",
        "goal": "D",
        "stops": [],
        "optimiseOrder": True,
        "conditions": {"vehicle": "bike", "period": "peak", "weights": dict(SHORTEST)},
    }


def diamond_request(algo: str = "ucs") -> PlanRequest:
    """The same request as a validated model, for planner-level tests."""
    return PlanRequest.model_validate(diamond_json(algo))


def shortest_weights() -> Weights:
    """The distance-only weights as a model, for cost-function tests."""
    return Weights.model_validate(SHORTEST)


def turn_blocked_json() -> dict[str, Any]:
    """A -> B -> C where the only through-turn at B is banned all day for everyone.

    The two points are physically connected and the vehicle can use both roads, so
    the failure is purely the turn restriction — the case :func:`why_blocked` must
    name as such instead of blaming a road class the route never uses.
    """
    return {
        "graph": {
            "nodes": {
                "A": {"id": "A", "lat": 10.77, "lng": 106.70},
                "B": {"id": "B", "lat": 10.78, "lng": 106.70},
                "C": {"id": "C", "lat": 10.79, "lng": 106.70},
            },
            "edges": [
                {
                    "from": "A",
                    "to": "B",
                    "km": 1.0,
                    "roadClass": "secondary",
                    "congestion": 2,
                    "risk": 0.1,
                    "wayId": 1,
                },
                {
                    "from": "B",
                    "to": "C",
                    "km": 1.0,
                    "roadClass": "secondary",
                    "congestion": 2,
                    "risk": 0.1,
                    "wayId": 2,
                },
            ],
            "bounds": [[10.77, 106.70], [10.79, 106.70]],
            "detail": "coarse",
            "turns": {
                "no": {"B|1|2": [{"kind": "no_straight_on", "hours": [], "except": []}]},
                "only": {},
            },
        },
        "algo": "ucs",
        "start": "A",
        "goal": "C",
        "stops": [],
        "optimiseOrder": False,
        "conditions": {"vehicle": "bike", "period": "peak", "weights": dict(SHORTEST)},
    }
