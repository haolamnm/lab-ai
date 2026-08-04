from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

import route_lab.planner as planner
from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES
from route_lab.api import app
from route_lab.contract.request import PlanRequest
from route_lab.contract.result import TraceStep
from route_lab.shared.graph import build_graph
from route_lab.shared.pairwise import PairwiseResult
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult, SearchStats


def _request(
    *,
    start: str = "W",
    goal: str = "W",
    stops: list[str] | None = None,
    optimise_order: bool = True,
    edges: list[tuple[str, str, float]] | None = None,
) -> PlanRequest:
    edge_values = edges or [
        ("W", "A", 1.0),
        ("A", "B", 1.0),
        ("B", "W", 1.0),
        ("W", "B", 1.5),
        ("B", "A", 1.5),
        ("A", "W", 1.5),
    ]
    payload: dict[str, Any] = {
        "graph": {
            "nodes": {
                "W": {"id": "W", "lat": 10.0, "lng": 106.0},
                "A": {"id": "A", "lat": 10.001, "lng": 106.001},
                "B": {"id": "B", "lat": 10.002, "lng": 106.002},
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
                for source, target, km in edge_values
            ],
            "bounds": [[10.0, 106.0], [10.002, 106.002]],
            "detail": "fine",
        },
        "algo": "held_karp",
        "start": start,
        "goal": goal,
        "stops": [] if stops is None else stops,
        "optimiseOrder": optimise_order,
        "conditions": {
            "vehicle": "van",
            "period": "peak",
            "weights": {
                "distance": 1.0,
                "time": 0.0,
                "congestion": 0.0,
                "risk": 0.0,
            },
        },
    }
    return PlanRequest.model_validate(payload)


def test_contract_and_registry_accept_held_karp_without_point_search_registration() -> None:
    request = _request()

    assert request.algo == "held_karp"
    assert ALGO_OPTIMAL["held_karp"] is True
    assert "held_karp" not in POINT_SEARCHES


def test_plan_endpoint_accepts_held_karp() -> None:
    request = _request()

    response = TestClient(app).post("/plan", json=request.model_dump(mode="json", by_alias=True))

    assert response.status_code == 200
    assert response.json()["algo"] == "held_karp"
    assert response.json()["found"] is True


def test_held_karp_plans_closed_multi_stop_route_with_pairwise_astar(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return a_star_search(problem)

    monkeypatch.setattr(planner, "a_star_search", search)
    result = planner.plan_route(_request(stops=["B", "A"], optimise_order=False))

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]
    assert result.path == ["W", "A", "B", "W"]
    assert result.metrics.km == 3.0
    assert result.metrics.cost == 3.0
    assert result.metrics.optimal is True
    assert calls == 6


def test_held_karp_assembles_only_selected_cached_legs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=["A", "B"])
    graph = build_graph(request.graph)
    edges = {(edge.from_, edge.to): edge for edge in graph.edges}

    def leg(source: str, target: str, value: int) -> SearchLegResult:
        return SearchLegResult(
            path=[source, target],
            edges=[edges[(source, target)]],
            trace=[TraceStep(expanded=value, frontier=[], g=float(value), h=0.0, parent=None)],
            found=True,
            ms=float(value),
            stats=SearchStats(
                expanded=value,
                generated=value + 1,
                reopened=value - 1,
                max_frontier=value + 2,
                turns_blocked=value - 1,
            ),
        )

    selected = {
        ("W", "A"): leg("W", "A", 1),
        ("A", "B"): leg("A", "B", 2),
        ("B", "W"): leg("B", "W", 3),
    }
    unused = leg("W", "B", 99)
    costs = {
        ("W", "W"): 0.0,
        ("A", "A"): 0.0,
        ("B", "B"): 0.0,
        ("W", "A"): 1.0,
        ("A", "B"): 1.0,
        ("B", "W"): 1.0,
        ("W", "B"): 9.0,
        ("B", "A"): 9.0,
        ("A", "W"): 9.0,
    }

    def pairwise(**kwargs: object) -> PairwiseResult:
        assert kwargs["search"] is planner.a_star_search
        return PairwiseResult(costs=costs, paths={**selected, ("W", "B"): unused})

    monkeypatch.setattr(planner, "build_pairwise", pairwise)
    result = planner.plan_route(request)

    assert result.path == ["W", "A", "B", "W"]
    assert [edge.name for edge in selected[("W", "A")].edges] == ["W-A"]
    assert result.reveal[-1].path == result.path
    assert len(result.trace) == 3
    assert result.metrics.km == 3.0
    assert result.metrics.cost == 3.0
    assert result.metrics.ms == 6.0
    assert result.metrics.expanded == 6
    assert result.metrics.generated == 9
    assert result.metrics.reopened == 3
    assert result.metrics.max_frontier == 5
    assert result.metrics.turns_blocked == 3


def test_held_karp_rejects_open_trip() -> None:
    result = planner.plan_route(_request(goal="A", stops=["B"]))

    assert result.found is False
    assert result.problem is not None and "same warehouse" in result.problem


def test_held_karp_rejects_stop_limit_before_pairwise(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=[f"S{index}" for index in range(planner.MAX_HELD_KARP_STOPS + 1)])
    request.graph.nodes.update(
        {stop: request.graph.nodes["A"].model_copy(update={"id": stop}) for stop in request.stops}
    )

    def fail_pairwise(**kwargs: object) -> PairwiseResult:
        raise AssertionError(f"Pairwise must not run: {kwargs}")

    monkeypatch.setattr(planner, "build_pairwise", fail_pairwise)
    result = planner.plan_route(request)

    assert result.found is False
    assert result.problem is not None and "at most" in result.problem


@pytest.mark.parametrize(
    ("stops", "message"),
    [(["A", "A"], "duplicates"), (["W"], "warehouse")],
)
def test_held_karp_invalid_stops_return_failure(stops: list[str], message: str) -> None:
    result = planner.plan_route(_request(stops=stops))

    assert result.found is False
    assert result.problem is not None and message in result.problem


def test_held_karp_no_hamiltonian_cycle_is_finite_failure() -> None:
    result = planner.plan_route(_request(stops=["A"], edges=[("W", "A", 1.0)]))

    assert result.found is False
    assert result.problem is not None and "return" in result.problem
    assert result.metrics.cost == 0.0
    assert result.metrics.ms == 0.0


def test_held_karp_unknown_location_preserves_planner_validation() -> None:
    result = planner.plan_route(_request(stops=["GHOST"]))

    assert result.found is False
    assert result.problem is not None and "GHOST" in result.problem


def test_held_karp_zero_stops_skips_pairwise(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_pairwise(**kwargs: object) -> PairwiseResult:
        raise AssertionError(f"Pairwise must not run: {kwargs}")

    monkeypatch.setattr(planner, "build_pairwise", fail_pairwise)
    result = planner.plan_route(_request())

    assert result.found is True
    assert result.order == ["W"]
    assert result.path == ["W"]
    assert result.metrics.cost == 0.0
    assert result.metrics.optimal is True
