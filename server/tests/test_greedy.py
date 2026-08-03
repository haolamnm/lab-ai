"""Greedy: what dropping the `g` term buys, and what it costs."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from route_lab.algorithms.greedy import greedy_best_first_search
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES, guided
from route_lab.algorithms.ucs import uniform_cost_search
from route_lab.api import app
from route_lab.contract.graph import GraphPayload
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import SearchProblem, build_problem

from .fixtures import diamond_json, diamond_payload, diamond_request

client = TestClient(app)

# The trap. Two routes from S to G: through T, which the heuristic likes and which
# is 200 km long, or through U, which the heuristic dislikes and which is 2 km
# long. The heuristic is admissible for neither — it is simply wrong, the way a
# straight-line estimate is wrong when a river sits between two points — and a
# search that consults it *and* the distance already travelled survives that.
_TRAP_NODES = ["S", "T", "U", "G"]
_TRAP_EDGES: list[dict[str, Any]] = [
    {"from": "S", "to": "T", "km": 100.0},
    {"from": "S", "to": "U", "km": 1.0},
    {"from": "T", "to": "G", "km": 100.0},
    {"from": "U", "to": "G", "km": 1.0},
]
_TRAP_HEURISTIC: dict[str, float] = {"S": 5.0, "T": 1.0, "U": 10.0, "G": 0.0}


def _problem(
    node_ids: list[str],
    edges: list[dict[str, Any]],
    start: str,
    goal: str,
    *,
    heuristic: Callable[[str], float] = lambda _node: 0.0,
) -> SearchProblem:
    payload = GraphPayload.model_validate(
        {
            "nodes": {
                node_id: {"id": node_id, "lat": 10.0, "lng": 106.0 + index * 0.001}
                for index, node_id in enumerate(node_ids)
            },
            "edges": [
                {"roadClass": "secondary", "congestion": 1, "risk": 0, **edge} for edge in edges
            ],
            "bounds": [[10.0, 106.0], [10.0, 107.0]],
            "detail": "coarse",
        }
    )
    return SearchProblem(
        graph=build_graph(payload),
        start=start,
        goal=goal,
        conditions=diamond_request("greedy").conditions,
        cost=lambda edge: edge.km,
        heuristic=heuristic,
    )


def _trap() -> SearchProblem:
    return _problem(
        _TRAP_NODES, _TRAP_EDGES, "S", "G", heuristic=lambda node: _TRAP_HEURISTIC[node]
    )


def _diamond_problem() -> SearchProblem:
    return build_problem(
        build_graph(diamond_payload()),
        "A",
        "D",
        diamond_request("greedy").conditions,
        guided=True,
    )


def test_greedy_follows_the_heuristic_into_the_expensive_route() -> None:
    greedy = greedy_best_first_search(_trap())
    ucs = uniform_cost_search(_trap())

    assert greedy.found is ucs.found is True
    assert greedy.path == ["S", "T", "G"]
    assert ucs.path == ["S", "U", "G"]
    assert sum(edge.km for edge in greedy.edges) == 200.0
    assert sum(edge.km for edge in ucs.edges) == 2.0


def test_greedy_reports_the_real_cost_it_travelled() -> None:
    leg = greedy_best_first_search(_trap())

    # The heuristic orders the frontier and nothing else. If it leaked into the
    # accumulated cost, the last expansion would read 200 + h rather than 200.
    assert leg.trace[-1].g == 200.0
    assert [step.g for step in leg.trace] == [0.0, 100.0, 200.0]


def test_greedy_records_the_heuristic_it_consulted() -> None:
    assert guided("greedy") is True
    leg = greedy_best_first_search(_trap())

    # A guided search owes the pane an `h` for every expansion — that column is
    # the only visible difference between a Greedy run and a UCS one.
    assert [step.h for step in leg.trace] == [5.0, 1.0, 0.0]


def test_greedy_heuristic_at_the_goal_is_zero() -> None:
    leg = greedy_best_first_search(_trap())
    assert leg.trace[-1].h == 0.0


def test_greedy_never_claims_optimality() -> None:
    assert ALGO_OPTIMAL["greedy"] is False
    assert plan_route(diamond_request("greedy")).metrics.optimal is False


def test_greedy_expands_no_more_than_ucs_on_the_diamond() -> None:
    # The payoff side of the trade: racing at the goal means touching fewer
    # states. On a graph this small it is a tie or a small win, never a loss.
    greedy = greedy_best_first_search(_diamond_problem())
    ucs = uniform_cost_search(_diamond_problem())

    assert greedy.found is True
    assert greedy.stats.expanded <= ucs.stats.expanded


def test_greedy_reports_no_route_when_the_goal_is_unreachable() -> None:
    leg = greedy_best_first_search(
        _problem(["S", "M", "G"], [{"from": "S", "to": "M", "km": 1.0}], "S", "G")
    )

    assert leg.found is False
    assert leg.path == []
    assert leg.stats.expanded == 2


def test_greedy_follows_one_way_streets() -> None:
    leg = greedy_best_first_search(
        build_problem(
            build_graph(diamond_payload()),
            "D",
            "A",
            diamond_request("greedy").conditions,
            guided=True,
        )
    )
    assert leg.found is False


def test_greedy_is_registered_as_a_point_search() -> None:
    assert POINT_SEARCHES["greedy"] is greedy_best_first_search


def test_plan_endpoint_runs_greedy() -> None:
    response = client.post("/plan", json=diamond_json("greedy"))

    assert response.status_code == 200
    body = response.json()
    assert body["found"] is True
    assert body["metrics"]["optimal"] is False
    # Guided, so every trace step carries an h the browser can render.
    assert all(step["h"] is not None for step in body["trace"])
