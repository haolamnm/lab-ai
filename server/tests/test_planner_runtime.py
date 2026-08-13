"""The public runtime covers the complete post-validation planner pipeline."""

from collections.abc import Iterator

import pytest

import route_lab.planner as planner
from route_lab.contract.request import AlgoKey, PlanRequest

from .fixtures import diamond_json, trip_request


def _clock(monkeypatch: pytest.MonkeyPatch, *values: float) -> None:
    readings: Iterator[float] = iter(values)
    monkeypatch.setattr(planner, "perf_counter", lambda: next(readings))


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar", "nearest", "held_karp"])
def test_runtime_is_planner_wall_clock_for_every_algorithm(
    monkeypatch: pytest.MonkeyPatch,
    algo: AlgoKey,
) -> None:
    _clock(monkeypatch, 10.0, 10.01234)
    request = PlanRequest.model_validate(diamond_json(algo))

    result = planner.plan_route(request)

    assert result.found is True
    assert result.metrics.ms == 12.3


def test_unknown_point_is_rejected_before_runtime_starts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_clock() -> float:
        raise AssertionError("the planner timer must not start before validation")

    monkeypatch.setattr(planner, "perf_counter", fail_clock)
    request = PlanRequest.model_validate(diamond_json("astar"))
    request.start = "GHOST"

    result = planner.plan_route(request)

    assert result.found is False
    assert result.metrics.ms == 0.0


def test_failed_search_after_dispatch_reports_elapsed_planning_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clock(monkeypatch, 30.0, 30.00604)
    request = trip_request(
        "ucs",
        start="W",
        goal="B",
        edges=[("W", "A", 1.0)],
    )

    result = planner.plan_route(request)

    assert result.found is False
    assert result.metrics.ms == 6.0
