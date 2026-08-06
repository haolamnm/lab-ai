"""Nearest Neighbor planner integration through directed Pairwise A*."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import pytest

import route_lab.planner as planner
from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.registry import POINT_SEARCHES
from route_lab.contract.conditions import Conditions
from route_lab.contract.request import PlanRequest
from route_lab.contract.result import TraceStep
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.pairwise import PairwiseResult, PointSearch
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult, SearchStats


def _request(
    *,
    stops: list[str] | None = None,
    goal: str = "B",
    optimise_order: bool = False,
    return_to_start: bool | None = None,
) -> PlanRequest:
    edges = [
        ("W", "A", 1.0),
        ("W", "B", 2.0),
        ("A", "W", 3.0),
        ("A", "B", 1.0),
        ("B", "W", 4.0),
        ("B", "A", 1.0),
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
                for source, target, km in edges
            ],
            "bounds": [[10.0, 106.0], [10.002, 106.002]],
            "detail": "fine",
        },
        "algo": "nearest",
        "start": "W",
        "goal": goal,
        "stops": ["A"] if stops is None else stops,
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
    if return_to_start is not None:
        payload["returnToStart"] = return_to_start
    return PlanRequest.model_validate(payload)


def _leg(graph: Graph, source: str, target: str, value: int) -> SearchLegResult:
    edge = next(edge for edge in graph.adj[source] if edge.to == target)
    return SearchLegResult(
        path=[source, target],
        edges=[edge],
        trace=[TraceStep(expanded=value, frontier=[], g=float(value), h=0.0, parent=None)],
        found=True,
        ms=float(value),
        stats=SearchStats(
            expanded=value,
            generated=value + 1,
            reopened=max(0, value - 1),
            max_frontier=value + 2,
            turns_blocked=max(0, value - 1),
        ),
    )


@pytest.mark.parametrize("optimise_order", [False, True])
def test_nearest_uses_pairwise_astar_without_rerunning_selected_legs(
    monkeypatch: pytest.MonkeyPatch,
    optimise_order: bool,
) -> None:
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return a_star_search(problem)

    monkeypatch.setattr(planner, "a_star_search", search)
    result = planner.plan_route(_request(optimise_order=optimise_order))

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    assert result.path == ["W", "A", "B"]
    assert result.metrics.optimal is False
    assert calls == 6
    assert "nearest" not in POINT_SEARCHES


def test_nearest_respects_directed_pairwise_costs(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request(stops=["A"], goal="B")
    graph = build_graph(request.graph)
    paths = {
        ("W", "B"): _leg(graph, "W", "B", 1),
        ("B", "A"): _leg(graph, "B", "A", 2),
    }
    costs = {
        ("W", "W"): 0.0,
        ("A", "A"): 0.0,
        ("B", "B"): 0.0,
        ("W", "A"): 5.0,
        ("W", "B"): 1.0,
        ("A", "B"): 0.1,
        ("B", "A"): 2.0,
    }
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )

    result = planner.plan_route(request)

    assert result.found is True
    assert result.order == ["W", "B", "A"]
    assert result.path == ["W", "B", "A"]


def test_nearest_preserves_input_order_for_pairwise_cost_ties(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=["B"], goal="A")
    graph = build_graph(request.graph)
    costs = {
        ("W", "W"): 0.0,
        ("A", "A"): 0.0,
        ("B", "B"): 0.0,
        ("W", "A"): 1.0,
        ("W", "B"): 1.0,
        ("B", "A"): 1.0,
    }
    paths = {
        ("W", "B"): _leg(graph, "W", "B", 1),
        ("B", "A"): _leg(graph, "B", "A", 2),
    }
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )

    result = planner.plan_route(request)

    assert result.order == ["W", "B", "A"]


def test_nearest_metrics_include_only_selected_cached_legs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request()
    graph = build_graph(request.graph)
    selected = {
        ("W", "A"): _leg(graph, "W", "A", 1),
        ("A", "B"): _leg(graph, "A", "B", 2),
    }
    unused = _leg(graph, "W", "B", 99)
    costs = {
        ("W", "W"): 0.0,
        ("A", "A"): 0.0,
        ("B", "B"): 0.0,
        ("W", "A"): 1.0,
        ("W", "B"): 2.0,
        ("A", "B"): 1.0,
    }
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths={**selected, ("W", "B"): unused}),
    )

    result = planner.plan_route(request)

    assert result.path == ["W", "A", "B"]
    assert result.metrics.ms == 3.0
    assert result.metrics.expanded == 3
    assert result.metrics.generated == 5
    assert result.metrics.reopened == 1
    assert result.metrics.max_frontier == 4
    assert result.metrics.turns_blocked == 1


def test_nearest_reports_missing_selected_cached_leg(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    graph = build_graph(request.graph)
    costs = {
        ("W", "W"): 0.0,
        ("A", "A"): 0.0,
        ("B", "B"): 0.0,
        ("W", "A"): 1.0,
        ("W", "B"): 3.0,
    }
    paths = {("W", "A"): _leg(graph, "W", "A", 1)}
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )

    result = planner.plan_route(request)

    assert result.found is False
    assert result.problem is not None and "A -> B" in result.problem
    assert result.metrics.cost == 0.0


def test_explicit_open_nearest_ignores_goal() -> None:
    result = planner.plan_route(_request(stops=["A", "B"], goal="GHOST", return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    assert result.path == ["W", "A", "B"]
    assert result.metrics.optimal is False


def test_explicit_closed_nearest_ignores_goal() -> None:
    result = planner.plan_route(_request(stops=["A", "B"], goal="GHOST", return_to_start=True))

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]
    assert result.path == ["W", "A", "B", "W"]
    assert result.metrics.optimal is False


@pytest.mark.parametrize("return_to_start", [False, True])
def test_explicit_nearest_zero_stops_is_trivial(return_to_start: bool) -> None:
    result = planner.plan_route(_request(stops=[], goal="GHOST", return_to_start=return_to_start))

    assert result.found is True
    assert result.order == ["W"]
    assert result.path == ["W"]
    assert result.metrics.cost == 0.0
    assert result.metrics.optimal is False


def test_explicit_open_nearest_one_stop() -> None:
    result = planner.plan_route(_request(stops=["A"], goal="GHOST", return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "A"]


def test_explicit_closed_nearest_one_stop() -> None:
    result = planner.plan_route(_request(stops=["A"], goal="GHOST", return_to_start=True))

    assert result.found is True
    assert result.order == ["W", "A", "W"]


@pytest.mark.parametrize(
    ("return_to_start", "expected_order"),
    [(False, ["W", "A"]), (True, ["W", "A", "W"])],
)
def test_explicit_nearest_reuses_pairwise_astar_legs(
    monkeypatch: pytest.MonkeyPatch,
    return_to_start: bool,
    expected_order: list[str],
) -> None:
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return a_star_search(problem)

    monkeypatch.setattr(planner, "a_star_search", search)
    result = planner.plan_route(
        _request(stops=["A"], goal="GHOST", return_to_start=return_to_start)
    )

    assert result.found is True
    assert result.order == expected_order
    assert calls == 2


def test_explicit_open_nearest_succeeds_without_return_leg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=["A"], goal="GHOST", return_to_start=False)
    graph = build_graph(request.graph)
    costs = {("W", "W"): 0.0, ("A", "A"): 0.0, ("W", "A"): 1.0}
    paths = {("W", "A"): _leg(graph, "W", "A", 1)}
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )

    result = planner.plan_route(request)

    assert result.found is True
    assert result.order == ["W", "A"]


def test_explicit_closed_nearest_fails_without_return_leg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=["A"], goal="GHOST", return_to_start=True)
    graph = build_graph(request.graph)
    costs = {("W", "W"): 0.0, ("A", "A"): 0.0, ("W", "A"): 1.0}
    paths = {("W", "A"): _leg(graph, "W", "A", 1)}
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )

    result = planner.plan_route(request)

    assert result.found is False
    assert result.problem is not None and "closed tour" in result.problem


def test_explicit_open_nearest_reports_missing_internal_leg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=["A", "B"], goal="GHOST", return_to_start=False)
    graph = build_graph(request.graph)
    costs = {
        ("W", "W"): 0.0,
        ("A", "A"): 0.0,
        ("B", "B"): 0.0,
        ("W", "A"): 1.0,
    }
    paths = {("W", "A"): _leg(graph, "W", "A", 1)}
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )

    result = planner.plan_route(request)

    assert result.found is False
    assert result.problem is not None and "open route" in result.problem


@pytest.mark.parametrize(
    ("stops", "expected_order"),
    [
        (["A", "A"], ["W", "A"]),
        (["W", "A"], ["W", "A"]),
        (["W", "W"], ["W"]),
    ],
)
def test_explicit_open_nearest_handles_duplicate_stops(
    stops: list[str],
    expected_order: list[str],
) -> None:
    result = planner.plan_route(_request(stops=stops, goal="A", return_to_start=False))

    assert result.found is True
    assert result.order == expected_order


def test_omitted_return_to_start_preserves_legacy_goal_participation() -> None:
    result = planner.plan_route(_request(stops=["B", "A"], goal="B"))

    assert result.found is True
    assert result.order == ["W", "A", "B"]


@pytest.mark.parametrize(
    ("stops", "goal", "expected_order", "expected_locations"),
    [
        (["A"], "W", ["W", "A"], ["W", "A"]),
        (["A", "B"], "B", ["W", "A", "B"], ["W", "A", "B"]),
        (["A", "A"], "B", ["W", "A", "B"], ["W", "A", "B"]),
    ],
)
def test_nearest_uses_stable_unique_pairwise_locations_without_dropping_destinations(
    monkeypatch: pytest.MonkeyPatch,
    stops: list[str],
    goal: str,
    expected_order: list[str],
    expected_locations: list[str],
) -> None:
    captured: list[str] = []
    original = planner.build_pairwise

    def pairwise(
        graph: Graph,
        locations: Sequence[str],
        conditions: Conditions,
        search: PointSearch,
    ) -> PairwiseResult:
        captured.extend(locations)
        return original(graph, locations, conditions, search)

    monkeypatch.setattr(planner, "build_pairwise", pairwise)
    request = _request(stops=stops, goal=goal)
    original_stops = list(request.stops)

    result = planner.plan_route(request)

    assert captured == expected_locations
    assert result.order == expected_order
    assert request.stops == original_stops


def test_nearest_trivial_duplicate_legs_need_no_diagonal_cached_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[str] = []
    original = planner.build_pairwise

    def pairwise(
        graph: Graph,
        locations: Sequence[str],
        conditions: Conditions,
        search: PointSearch,
    ) -> PairwiseResult:
        captured.extend(locations)
        return original(graph, locations, conditions, search)

    monkeypatch.setattr(planner, "build_pairwise", pairwise)
    result = planner.plan_route(_request(stops=["W"], goal="W"))

    assert captured == ["W"]
    assert result.found is False
    assert result.order == ["W"]
    assert result.problem is not None and "same intersection" in result.problem
