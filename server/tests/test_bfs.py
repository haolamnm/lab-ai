"""BFS on the diamond: fewest segments, and the price of ignoring cost."""

from __future__ import annotations

from fastapi.testclient import TestClient

from route_lab.algorithms.bfs import breadth_first_search
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES
from route_lab.api import app
from route_lab.planner import plan_route

from .fixtures import diamond_json, diamond_problem, diamond_request, graph_problem

client = TestClient(app)


def test_bfs_takes_the_fewest_segments_not_the_cheapest_route() -> None:
    result = plan_route(diamond_request("bfs"))

    # This is the whole reason BFS is in the grid. A -> D is one segment and 3.0
    # km; A -> B -> D is two segments and 2.0 km. UCS returns the second, BFS the
    # first, and BFS is not wrong — it optimised the thing it was asked to.
    assert result.found is True
    assert result.path == ["A", "D"]
    assert result.metrics.hops == 1
    assert result.metrics.km == 3.0
    assert plan_route(diamond_request("ucs")).metrics.km == 2.0


def test_bfs_never_claims_optimality() -> None:
    assert ALGO_OPTIMAL["bfs"] is False
    assert plan_route(diamond_request("bfs")).metrics.optimal is False


def test_bfs_is_blind() -> None:
    # Every leg is built with a real heuristic now; a blind search is blind
    # because it never calls it, and a trace with no `h` is what proves it: the
    # pane shows g only, with no f column.
    leg = breadth_first_search(diamond_problem())
    assert leg.trace
    assert all(step.h is None for step in leg.trace)


def test_bfs_trace_g_counts_hops_not_cost() -> None:
    leg = breadth_first_search(diamond_problem())

    # A is expanded at depth 0; B, C and D are all one hop from A. Were `g` the
    # accumulated cost instead, D would read 3.0 here.
    assert [step.g for step in leg.trace] == [0.0, 1.0, 1.0, 1.0]


def test_bfs_expands_every_state_it_queues() -> None:
    leg = breadth_first_search(diamond_problem())

    # A(0) then B, C, D at depth 1 — the whole diamond, since the goal is popped
    # last in FIFO order. Each state is queued exactly once, so nothing is
    # reopened and the frontier peaks at the three successors of A.
    assert leg.stats.expanded == len(leg.trace) == 4
    assert leg.stats.generated == 3
    assert leg.stats.reopened == 0
    assert leg.stats.max_frontier == 3


def test_bfs_prefers_the_shallow_branch_over_the_deep_one() -> None:
    # Two ways to G: through X in two hops, or through Y and Z in three. Every
    # edge is 1 km, so hop count and cost agree and BFS is right on both.
    problem = graph_problem(
        ["S", "X", "Y", "Z", "G"],
        [
            {"from": "S", "to": "X", "km": 1.0},
            {"from": "S", "to": "Y", "km": 1.0},
            {"from": "X", "to": "G", "km": 1.0},
            {"from": "Y", "to": "Z", "km": 1.0},
            {"from": "Z", "to": "G", "km": 1.0},
        ],
        "S",
        "G",
    )
    leg = breadth_first_search(problem)

    assert leg.found is True
    assert leg.path == ["S", "X", "G"]


def test_bfs_reports_no_route_when_the_goal_is_unreachable() -> None:
    problem = graph_problem(
        ["S", "M", "G"],
        [{"from": "S", "to": "M", "km": 1.0}],
        "S",
        "G",
    )
    leg = breadth_first_search(problem)

    assert leg.found is False
    assert leg.path == []
    # It gave up only after exhausting everything it could reach.
    assert leg.stats.expanded == 2


def test_bfs_follows_one_way_streets() -> None:
    # The diamond's edges are one-way. Searching against them finds nothing,
    # which is the check that BFS reads `adj` rather than assuming symmetry.
    leg = breadth_first_search(diamond_problem("D", "A"))
    assert leg.found is False


def test_bfs_is_registered_as_a_point_search() -> None:
    assert POINT_SEARCHES["bfs"] is breadth_first_search


def test_plan_endpoint_runs_bfs() -> None:
    response = client.post("/plan", json=diamond_json("bfs"))

    assert response.status_code == 200
    body = response.json()
    assert body["found"] is True
    assert body["path"] == ["A", "D"]
    assert body["metrics"]["optimal"] is False
