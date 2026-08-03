"""DFS: the same loop as BFS with the frontier reversed, and a worse route for it."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from route_lab.algorithms.bfs import breadth_first_search
from route_lab.algorithms.dfs import depth_first_search
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES, guided
from route_lab.api import app
from route_lab.contract.graph import GraphPayload
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import SearchProblem, build_problem

from .fixtures import diamond_json, diamond_payload, diamond_request

client = TestClient(app)

# Two ways from S to G: through X in two hops, or the long way through Y and Z in
# three. Every edge is 1 km, so the short branch is better by both measures and
# there is nothing to excuse taking the other one. The edge order matters: `adj`
# preserves it, so S discovers X first and Y second, and a LIFO frontier pops the
# one discovered *last*.
_FORK_NODES = ["S", "X", "Y", "Z", "G"]
_FORK_EDGES: list[dict[str, Any]] = [
    {"from": "S", "to": "X", "km": 1.0},
    {"from": "S", "to": "Y", "km": 1.0},
    {"from": "X", "to": "G", "km": 1.0},
    {"from": "Y", "to": "Z", "km": 1.0},
    {"from": "Z", "to": "G", "km": 1.0},
]


def _problem(
    node_ids: list[str],
    edges: list[dict[str, Any]],
    start: str,
    goal: str,
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
    return build_problem(
        build_graph(payload),
        start,
        goal,
        diamond_request("dfs").conditions,
        guided=False,
    )


def _diamond_problem() -> SearchProblem:
    return build_problem(
        build_graph(diamond_payload()),
        "A",
        "D",
        diamond_request("dfs").conditions,
        guided=False,
    )


def test_dfs_takes_the_deep_branch_where_bfs_takes_the_shallow_one() -> None:
    # One line separates the two algorithms — Stack instead of Queue — so running
    # both over one graph is the honest way to show what that line costs.
    deep = depth_first_search(_problem(_FORK_NODES, _FORK_EDGES, "S", "G"))
    shallow = breadth_first_search(_problem(_FORK_NODES, _FORK_EDGES, "S", "G"))

    assert deep.found is shallow.found is True
    assert deep.path == ["S", "Y", "Z", "G"]
    assert shallow.path == ["S", "X", "G"]
    assert len(deep.path) > len(shallow.path)


def test_dfs_never_claims_optimality() -> None:
    assert ALGO_OPTIMAL["dfs"] is False
    assert plan_route(diamond_request("dfs")).metrics.optimal is False


def test_dfs_is_blind() -> None:
    assert guided("dfs") is False
    leg = depth_first_search(_diamond_problem())
    assert leg.trace
    assert all(step.h is None for step in leg.trace)


def test_dfs_trace_g_counts_depth() -> None:
    leg = depth_first_search(_problem(_FORK_NODES, _FORK_EDGES, "S", "G"))

    # S, Y, Z, G — one plunge, with depth rising by one at every step.
    assert [step.g for step in leg.trace] == [0.0, 1.0, 2.0, 3.0]


def test_dfs_stops_at_the_first_arrival_on_the_diamond() -> None:
    leg = depth_first_search(_diamond_problem())

    # A's successors are queued B, C, D and popped last-first, so D — the goal —
    # comes off immediately. Two expansions against UCS's four, for a route that
    # costs 3.0 against UCS's 2.0.
    assert leg.path == ["A", "D"]
    assert leg.stats.expanded == len(leg.trace) == 2
    assert leg.stats.generated == 3
    assert leg.stats.reopened == 0
    assert leg.stats.max_frontier == 3


def test_dfs_reports_no_route_when_the_goal_is_unreachable() -> None:
    leg = depth_first_search(
        _problem(["S", "M", "G"], [{"from": "S", "to": "M", "km": 1.0}], "S", "G")
    )

    assert leg.found is False
    assert leg.path == []
    assert leg.stats.expanded == 2


def test_dfs_terminates_on_a_cycle() -> None:
    # A stack search that did not record states at push time would ride S -> A ->
    # B -> S forever. This is the test that pins that down.
    leg = depth_first_search(
        _problem(
            ["S", "A", "B", "G"],
            [
                {"from": "S", "to": "A", "km": 1.0},
                {"from": "A", "to": "B", "km": 1.0},
                {"from": "B", "to": "S", "km": 1.0},
                {"from": "B", "to": "G", "km": 1.0},
            ],
            "S",
            "G",
        )
    )

    assert leg.found is True
    assert leg.path == ["S", "A", "B", "G"]


def test_dfs_follows_one_way_streets() -> None:
    leg = depth_first_search(
        build_problem(
            build_graph(diamond_payload()),
            "D",
            "A",
            diamond_request("dfs").conditions,
            guided=False,
        )
    )
    assert leg.found is False


def test_dfs_is_registered_as_a_point_search() -> None:
    assert POINT_SEARCHES["dfs"] is depth_first_search


def test_plan_endpoint_runs_dfs() -> None:
    response = client.post("/plan", json=diamond_json("dfs"))

    assert response.status_code == 200
    body = response.json()
    assert body["found"] is True
    assert body["path"] == ["A", "D"]
    assert body["metrics"]["optimal"] is False
