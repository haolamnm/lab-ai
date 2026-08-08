"""Tiny, deterministic graphs the tests reason about by hand.

The diamond, with a tempting shortcut::

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

Every edge is **one-way**: ``build_graph`` indexes an edge under ``from`` only,
so listing ``A -> B`` does not create ``B -> A``. Nothing can be routed backwards
through the diamond, which is what ``test_bfs_follows_one_way_streets`` and
``test_ucs_returns_not_found_when_goal_is_unreachable`` rely on, and what makes
``why_blocked(graph, "D", "A", ...)`` the one-way-street case.

Everything is built through ``model_validate`` from camelCase dicts, so the
fixtures also exercise the real wire-parsing path the frontend hits.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from route_lab.contract.conditions import Weights
from route_lab.contract.graph import GraphPayload
from route_lab.contract.request import PlanRequest
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import SearchProblem, build_problem

_NODES: dict[str, tuple[float, float]] = {
    "A": (10.770, 106.700),
    "B": (10.780, 106.700),
    "C": (10.770, 106.710),
    "D": (10.780, 106.710),
}

# (from, to, km) — each is a one-way "secondary" road a motorbike may use.
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
        # There is nothing to order with no stops, so this stays false rather
        # than asserting a preference the request cannot act on.
        "optimiseOrder": False,
        "conditions": {"vehicle": "bike", "period": "peak", "weights": dict(SHORTEST)},
    }


def diamond_request(algo: str = "ucs") -> PlanRequest:
    """The same request as a validated model, for planner-level tests."""
    return PlanRequest.model_validate(diamond_json(algo))


def graph_problem(
    node_ids: Sequence[str],
    edges: Sequence[dict[str, Any]],
    start: str,
    goal: str,
) -> SearchProblem:
    """One leg over a graph spelled out edge by edge.

    Only ``from``, ``to`` and ``km`` need supplying; every other edge field takes
    a neutral default, so a test that is about frontier order is not obliged to
    restate the whole cost model. The run conditions are the diamond's, which are
    distance-only — the same for every algorithm, so no algorithm is named here.
    """
    payload = GraphPayload.model_validate(
        {
            "nodes": {
                node_id: {"id": node_id, "lat": 10.0, "lng": 106.0 + index * 0.001}
                for index, node_id in enumerate(node_ids)
            },
            "edges": [
                {"roadClass": "secondary", "congestion": 1, "risk": 0.0, **edge} for edge in edges
            ],
            "bounds": [[10.0, 106.0], [10.0, 107.0]],
            "detail": "coarse",
        }
    )
    return build_problem(build_graph(payload), start, goal, diamond_request().conditions)


def diamond_problem(start: str = "A", goal: str = "D") -> SearchProblem:
    """One leg over the diamond, under its distance-only conditions."""
    return build_problem(build_graph(diamond_payload()), start, goal, diamond_request().conditions)


def shortest_weights() -> Weights:
    """The distance-only weights as a model, for cost-function tests."""
    return Weights.model_validate(SHORTEST)


# A warehouse and two destinations, for the trip-level planners. The costs are
# asymmetric on purpose: a test that confused the directed pair (A, B) with
# (B, A) would still pass on a symmetric matrix.
TRIP_EDGES: list[tuple[str, str, float]] = [
    ("W", "A", 1.0),
    ("W", "B", 2.0),
    ("A", "W", 3.0),
    ("A", "B", 1.0),
    ("B", "W", 4.0),
    ("B", "A", 1.0),
]

_TRIP_NODES: dict[str, tuple[float, float]] = {
    "W": (10.0, 106.0),
    "A": (10.001, 106.001),
    "B": (10.002, 106.002),
}


def trip_json(
    algo: str,
    *,
    start: str = "W",
    goal: str = "W",
    stops: Sequence[str] = (),
    edges: Sequence[tuple[str, str, float]] = tuple(TRIP_EDGES),
    optimise_order: bool = False,
    return_to_start: bool = False,
) -> dict[str, Any]:
    """A warehouse-and-two-stops trip as the JSON the frontend would POST.

    One builder for all three trip-level test modules: they were three copies of
    this graph differing only in which edges exist, and a copy that drifted would
    have made two of them quietly stop testing the same thing.
    """
    payload: dict[str, Any] = {
        "graph": {
            "nodes": {
                node_id: {"id": node_id, "lat": lat, "lng": lng}
                for node_id, (lat, lng) in _TRIP_NODES.items()
            },
            "edges": [
                {
                    "from": source,
                    "to": target,
                    "km": km,
                    "roadClass": "secondary",
                    "congestion": 1.0,
                    "risk": 0.0,
                    "name": f"{source}-{target}",
                }
                for source, target, km in edges
            ],
            "bounds": [[10.0, 106.0], [10.002, 106.002]],
            "detail": "fine",
        },
        "algo": algo,
        "start": start,
        "goal": goal,
        "stops": list(stops),
        "optimiseOrder": optimise_order,
        "returnToStart": return_to_start,
        "conditions": {
            "vehicle": "van",
            "period": "peak",
            "weights": {"distance": 1.0, "time": 0.0, "congestion": 0.0, "risk": 0.0},
        },
    }
    return payload


def trip_request(algo: str, **kwargs: Any) -> PlanRequest:
    """The same trip as a validated model, for planner-level tests."""
    return PlanRequest.model_validate(trip_json(algo, **kwargs))


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
