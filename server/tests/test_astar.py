"""A* correctness, constraints, bookkeeping, and planner integration."""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES
from route_lab.algorithms.ucs import uniform_cost_search
from route_lab.api import app
from route_lab.contract.graph import GraphPayload
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph
from route_lab.shared.heuristics import geometric_cost_scale
from route_lab.shared.problem import SearchProblem, build_problem

from .fixtures import diamond_json, diamond_problem, diamond_request

client = TestClient(app)


def _payload(
    node_ids: list[str],
    edges: list[dict[str, Any]],
    *,
    turns: dict[str, Any] | None = None,
) -> GraphPayload:
    return GraphPayload.model_validate(
        {
            "nodes": {
                node_id: {"id": node_id, "lat": 10.0, "lng": 106.0 + index * 0.001}
                for index, node_id in enumerate(node_ids)
            },
            "edges": [
                {
                    "roadClass": "secondary",
                    "congestion": 1,
                    "risk": 0,
                    **edge,
                }
                for edge in edges
            ],
            "bounds": [[10.0, 106.0], [10.0, 107.0]],
            "detail": "coarse",
            "turns": turns,
        }
    )


def _problem(
    node_ids: list[str],
    edges: list[dict[str, Any]],
    start: str,
    goal: str,
    *,
    heuristic: Callable[[str], float] = lambda _node: 0.0,
    turns: dict[str, Any] | None = None,
) -> SearchProblem:
    graph = build_graph(_payload(node_ids, edges, turns=turns))
    return SearchProblem(
        graph=graph,
        start=start,
        goal=goal,
        conditions=diamond_request("astar").conditions,
        cost=lambda edge: edge.km,
        heuristic=heuristic,
    )


def _adversarial_geometry_request(
    algo: AlgoKey = "astar",
    *,
    weights: dict[str, float] | None = None,
) -> PlanRequest:
    return PlanRequest.model_validate(
        {
            "graph": {
                "nodes": {
                    "S": {"id": "S", "lat": 0, "lng": 0},
                    "A": {"id": "A", "lat": 0, "lng": -10},
                    "G": {"id": "G", "lat": 0, "lng": 10},
                },
                "edges": [
                    {
                        "from": "S",
                        "to": "G",
                        "km": 10,
                        "roadClass": "secondary",
                        "congestion": 2,
                        "risk": 0.5,
                    },
                    {
                        "from": "S",
                        "to": "A",
                        "km": 1,
                        "roadClass": "secondary",
                        "congestion": 2,
                        "risk": 0.5,
                    },
                    {
                        "from": "A",
                        "to": "G",
                        "km": 1,
                        "roadClass": "secondary",
                        "congestion": 2,
                        "risk": 0.5,
                    },
                ],
            },
            "algo": algo,
            "start": "S",
            "goal": "G",
            "conditions": {
                "vehicle": "car",
                "period": "offpeak",
                "weights": weights or {"distance": 1, "time": 0, "congestion": 0, "risk": 0},
            },
        }
    )


def test_astar_finds_path() -> None:
    result = a_star_search(diamond_problem())

    assert result.found is True
    assert result.path == ["A", "B", "D"]


def test_astar_matches_ucs_minimum_cost() -> None:
    astar = a_star_search(diamond_problem())
    ucs = uniform_cost_search(diamond_problem())

    assert sum(edge.km for edge in astar.edges) == pytest.approx(sum(edge.km for edge in ucs.edges))


def test_astar_matches_ucs_when_stored_km_is_geometrically_impossible() -> None:
    request = _adversarial_geometry_request()
    problem = build_problem(build_graph(request.graph), "S", "G", request.conditions)

    astar = a_star_search(problem)
    ucs = uniform_cost_search(problem)

    assert astar.path == ["S", "A", "G"]
    assert astar.trace[-1].g == pytest.approx(2.0)
    assert astar.trace[-1].g == pytest.approx(ucs.trace[-1].g)


def test_planner_astar_optimal_flag_is_backed_by_the_ucs_optimum() -> None:
    astar = plan_route(_adversarial_geometry_request("astar"))
    ucs = plan_route(_adversarial_geometry_request("ucs"))

    assert astar.found is True
    assert astar.path == ["S", "A", "G"]
    assert astar.metrics.cost == pytest.approx(ucs.metrics.cost)
    assert astar.metrics.optimal is True


def test_geometric_scale_is_zero_when_all_endpoint_distances_are_zero() -> None:
    payload = GraphPayload.model_validate(
        {
            "nodes": {
                "S": {"id": "S", "lat": 10, "lng": 106},
                "G": {"id": "G", "lat": 10, "lng": 106},
            },
            "edges": [
                {
                    "from": "S",
                    "to": "G",
                    "km": 1,
                    "roadClass": "secondary",
                    "congestion": 1,
                    "risk": 0,
                }
            ],
        }
    )
    request = _adversarial_geometry_request()
    graph = build_graph(payload)
    problem = build_problem(graph, "S", "G", request.conditions)

    assert geometric_cost_scale(graph, request.conditions) == 0.0
    assert math.isfinite(problem.heuristic("S"))
    assert problem.heuristic("S") == 0.0
    assert a_star_search(problem).path == ["S", "G"]


@pytest.mark.parametrize(
    "weights",
    [
        {"distance": 0, "time": 1, "congestion": 0, "risk": 0},
        {"distance": 0, "time": 0, "congestion": 1, "risk": 0},
        {"distance": 0, "time": 0, "congestion": 0, "risk": 1},
        {"distance": 0, "time": 1, "congestion": 1, "risk": 1},
    ],
)
def test_astar_geometric_scale_is_safe_across_weight_components(
    weights: dict[str, float],
) -> None:
    request = _adversarial_geometry_request(weights=weights)
    problem = build_problem(build_graph(request.graph), "S", "G", request.conditions)

    astar = a_star_search(problem)
    ucs = uniform_cost_search(problem)

    assert astar.found is True
    assert astar.trace[-1].g == pytest.approx(ucs.trace[-1].g)


def test_astar_total_cost_is_sum_of_edge_costs() -> None:
    problem = diamond_problem()
    result = a_star_search(problem)

    edge_total = sum(problem.cost(edge) for edge in result.edges)
    assert result.trace[-1].g == pytest.approx(edge_total)


def test_heuristic_not_added_to_result_cost() -> None:
    estimates = {"S": 2.0, "A": 1.0, "G": 0.0}
    problem = _problem(
        ["S", "A", "G"],
        [
            {"from": "S", "to": "A", "km": 2.0},
            {"from": "A", "to": "G", "km": 3.0},
        ],
        "S",
        "G",
        heuristic=estimates.__getitem__,
    )

    result = a_star_search(problem)

    assert result.trace[-1].g == pytest.approx(5.0)
    assert sum(problem.cost(edge) for edge in result.edges) == pytest.approx(5.0)


def test_astar_goal_heuristic_is_zero() -> None:
    problem = diamond_problem()
    result = a_star_search(problem)

    assert problem.heuristic(problem.goal) == pytest.approx(0.0, abs=1e-9)
    assert result.trace[-1].h == pytest.approx(0.0, abs=1e-9)


def test_astar_unreachable() -> None:
    problem = _problem(
        ["S", "A", "G"],
        [{"from": "S", "to": "A", "km": 1.0}],
        "S",
        "G",
    )

    result = a_star_search(problem)

    assert result.found is False
    assert result.path == []
    assert result.edges == []


def test_astar_directed_graph() -> None:
    problem = _problem(
        ["S", "G"],
        [{"from": "S", "to": "G", "km": 1.0}],
        "G",
        "S",
    )

    assert a_star_search(problem).found is False


def test_astar_parallel_edges() -> None:
    problem = _problem(
        ["S", "G"],
        [
            {"from": "S", "to": "G", "km": 5.0, "name": "slow", "wayId": 10},
            {"from": "S", "to": "G", "km": 1.0, "name": "fast", "wayId": 11},
        ],
        "S",
        "G",
    )

    result = a_star_search(problem)

    assert result.path == ["S", "G"]
    assert len(result.edges) == 1
    assert result.edges[0].name == "fast"
    assert result.edges[0].way_id == 11


def test_astar_handles_stale_frontier_entries() -> None:
    problem = _problem(
        ["S", "A", "X", "G"],
        [
            {"from": "S", "to": "X", "km": 5.0},
            {"from": "S", "to": "A", "km": 1.0},
            {"from": "A", "to": "X", "km": 1.0},
            {"from": "X", "to": "G", "km": 10.0},
        ],
        "S",
        "G",
    )

    result = a_star_search(problem)

    assert result.path == ["S", "A", "X", "G"]
    assert result.trace[-1].g == pytest.approx(12.0)
    # 2 is the node index of X, not a count: X is expanded exactly once, so the
    # stale 5.0 entry left behind when S -> A -> X improved on it was skipped.
    assert [step.expanded for step in result.trace].count(2) == 1


def test_astar_reopens_when_better_path_found() -> None:
    # Admissible but inconsistent: h(A)=2 <= 2.5 remaining, while
    # h(A) > cost(A,B)+h(B). B is first closed at g=3, then reopened at g=2.5.
    estimates = {"S": 0.0, "A": 2.0, "B": 0.0, "G": 0.0}
    problem = _problem(
        ["S", "A", "B", "G"],
        [
            {"from": "S", "to": "B", "km": 3.0},
            {"from": "S", "to": "A", "km": 2.0},
            {"from": "A", "to": "B", "km": 0.5},
            {"from": "B", "to": "G", "km": 2.0},
        ],
        "S",
        "G",
        heuristic=estimates.__getitem__,
    )

    result = a_star_search(problem)

    assert result.path == ["S", "A", "B", "G"]
    assert result.trace[-1].g == pytest.approx(4.5)
    assert result.stats.reopened >= 1
    # 2 is the node index of B, not a count: B really is expanded twice, once at
    # g=3 and again after the cheaper S -> A -> B route reopened it.
    assert [step.expanded for step in result.trace].count(2) == 2


def test_astar_respects_vehicle_or_road_restriction() -> None:
    problem = _problem(
        ["S", "A", "G"],
        [
            {"from": "S", "to": "G", "km": 0.1, "roadClass": "motorway"},
            {"from": "S", "to": "A", "km": 1.0},
            {"from": "A", "to": "G", "km": 1.0},
        ],
        "S",
        "G",
    )

    result = a_star_search(problem)

    assert result.path == ["S", "A", "G"]
    assert all(edge.road_class != "motorway" for edge in result.edges)


def test_astar_respects_turn_restriction() -> None:
    turns = {
        "no": {"A|1|2": [{"kind": "no_straight_on", "hours": [], "except": []}]},
        "only": {},
    }
    problem = _problem(
        ["S", "A", "B", "G"],
        [
            {"from": "S", "to": "A", "km": 1.0, "wayId": 1},
            {"from": "A", "to": "G", "km": 1.0, "wayId": 2},
            {"from": "S", "to": "B", "km": 2.0, "wayId": 3},
            {"from": "B", "to": "G", "km": 2.0, "wayId": 4},
        ],
        "S",
        "G",
        turns=turns,
    )

    result = a_star_search(problem)

    assert result.path == ["S", "B", "G"]
    assert result.stats.turns_blocked == 1


def test_astar_expands_no_more_than_ucs_on_guided_sample() -> None:
    astar = a_star_search(diamond_problem())
    ucs = uniform_cost_search(diamond_problem())

    assert astar.stats.expanded <= ucs.stats.expanded


def test_astar_registry_configuration() -> None:
    assert POINT_SEARCHES["astar"] is a_star_search
    assert ALGO_OPTIMAL["astar"] is True


def test_planner_runs_astar_for_one_leg() -> None:
    result = plan_route(diamond_request("astar"))

    assert result.found is True
    assert result.algo == "astar"
    assert result.path == ["A", "B", "D"]
    assert result.metrics.cost == pytest.approx(2.0)


def test_planner_runs_astar_for_each_leg_in_given_order() -> None:
    payload = _payload(
        ["A", "B", "C", "D"],
        [
            {"from": "A", "to": "B", "km": 1.0},
            {"from": "B", "to": "C", "km": 1.0},
            {"from": "C", "to": "D", "km": 1.0},
        ],
    )
    request = PlanRequest(
        graph=payload,
        algo="astar",
        start="A",
        stops=["B", "C"],
        goal="D",
        optimise_order=False,
        conditions=diamond_request("astar").conditions,
    )

    result = plan_route(request)

    assert result.found is True
    assert result.order == ["A", "B", "C", "D"]
    assert result.path == ["A", "B", "C", "D"]
    assert result.metrics.cost == pytest.approx(3.0)
    assert len(result.reveal) == 3


def test_plan_endpoint_runs_astar() -> None:
    response = client.post("/plan", json=diamond_json("astar"))

    assert response.status_code == 200
    assert response.json()["found"] is True
    assert response.json()["path"] == ["A", "B", "D"]
