"""Planner ownership of optional and algorithm-intrinsic stop ordering."""

from typing import Any

import pytest

from route_lab import planner
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult


def _request(algo: AlgoKey, *, optimise_order: bool) -> PlanRequest:
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
                }
                for source, target, km in (
                    ("W", "A", 1.0),
                    ("W", "B", 4.0),
                    ("A", "B", 1.0),
                    ("B", "A", 1.0),
                )
            ],
            "bounds": [[10.0, 106.0], [10.002, 106.002]],
            "detail": "fine",
        },
        "algo": algo,
        "start": "W",
        "goal": "B",
        "stops": ["B", "A"],
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


@pytest.mark.parametrize("optimise_order", [False, True])
def test_nearest_ignores_optimise_order(optimise_order: bool) -> None:
    result = planner.plan_route(_request("nearest", optimise_order=optimise_order))

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    assert result.metrics.optimal is False


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_search_without_optimisation_preserves_entered_order(algo: AlgoKey) -> None:
    result = planner.plan_route(_request(algo, optimise_order=False))

    assert result.found is True
    assert result.order == ["W", "B", "A", "B"]


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_search_with_optimisation_uses_nearest_order(algo: AlgoKey) -> None:
    result = planner.plan_route(_request(algo, optimise_order=True))

    assert result.found is True
    assert result.order == ["W", "A", "B"]


@pytest.mark.parametrize(
    ("algo", "search_name"),
    [
        ("bfs", "breadth_first_search"),
        ("dfs", "depth_first_search"),
        ("ucs", "uniform_cost_search"),
        ("astar", "a_star_search"),
    ],
)
def test_optional_ordering_does_not_change_leg_search(
    monkeypatch: pytest.MonkeyPatch,
    algo: AlgoKey,
    search_name: str,
) -> None:
    selected_search = planner.POINT_SEARCHES[algo]
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return selected_search(problem)

    assert selected_search.__name__ == search_name
    monkeypatch.setitem(planner.POINT_SEARCHES, algo, search)

    result = planner.plan_route(_request(algo, optimise_order=True))

    assert result.found is True
    assert calls == 2
