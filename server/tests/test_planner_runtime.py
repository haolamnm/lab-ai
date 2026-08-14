"""The public runtime covers the complete post-validation planner pipeline.

Every exit from ``_plan_measured`` is inside the clock by construction, so the
tests below walk the ones that return early — a degenerate trip and an
unimplemented algorithm — as well as the ones that plan a route. They are what
would catch the placeholder ``ms=0`` in ``_route_from_legs`` escaping as though
it were a measurement.
"""

from collections.abc import Iterator

import pytest

import route_lab.planner as planner
from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.algorithms.registry import POINT_SEARCHES
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult

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


def test_degenerate_trip_reports_elapsed_planning_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The pickup and dropoff pinning together still costs the work of finding out."""
    _clock(monkeypatch, 50.0, 50.0021)
    request = trip_request("ucs", start="W", goal="W")

    result = planner.plan_route(request)

    assert result.found is False
    assert result.problem is not None
    assert "same intersection" in result.problem
    assert result.metrics.ms == 2.1


def test_unimplemented_algorithm_reports_elapsed_planning_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The stub's message is a result like any other, and a timed one.

    This is the return path furthest from the measurement — raised inside a leg
    search, caught mid-loop, and turned into a stopped result — so it is the one
    a future refactor is likeliest to let out of the clock.
    """

    def unimplemented(problem: SearchProblem) -> SearchLegResult:
        _ = problem
        raise AlgorithmNotImplemented("bfs")

    monkeypatch.setitem(POINT_SEARCHES, "bfs", unimplemented)
    # Well clear of a rounding tie: 8.15 would ride on `js_round` breaking ties
    # upward and on the subtraction landing above the midpoint rather than below.
    _clock(monkeypatch, 70.0, 70.00824)
    request = PlanRequest.model_validate(diamond_json("bfs"))

    result = planner.plan_route(request)

    assert result.found is False
    assert result.metrics.ms == 8.2


def test_every_planned_result_reports_a_measured_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No planned result may hand back the `_route_from_legs` placeholder.

    A sweep rather than a guarantee: `plan_route` overwrites `ms` at its single
    exit, so a branch added inside `_plan_measured` is measured by construction
    and this cannot catch one. What it does catch is the placeholder reaching a
    caller by some other route — a second public entry point, or `finish`-style
    wrapping creeping back in — which would surface in a pane as a genuine
    looking `0.0 ms` rather than as an error.
    """
    # A clock that advances a full second per read, so every case is measured
    # without this test pinning a per-case figure.
    ticks: Iterator[float] = iter(range(1000))
    monkeypatch.setattr(planner, "perf_counter", lambda: float(next(ticks)))

    requests = [PlanRequest.model_validate(diamond_json(algo)) for algo in POINT_SEARCHES]
    requests.append(PlanRequest.model_validate(diamond_json("nearest")))
    requests.append(PlanRequest.model_validate(diamond_json("held_karp")))
    requests.append(trip_request("ucs", start="W", goal="W"))

    for request in requests:
        assert planner.plan_route(request).metrics.ms > 0.0, request.algo


def test_request_preparation_stays_outside_the_measured_span() -> None:
    """Only work after validation is timed, and the clock is read exactly twice.

    The regression the refactor left possible: `plan_route` still has one return
    ahead of `started_at`, and a second one added there would report `ms: 0.0`
    the same way a missed `finish` used to. Counting the reads pins the boundary
    from the other side — a clock started earlier, or a stray `perf_counter` put
    back inside the pipeline, breaks this without needing a timing assertion.
    """
    reads = 0

    def counted() -> float:
        nonlocal reads
        reads += 1
        return float(reads)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(planner, "perf_counter", counted)
        result = planner.plan_route(PlanRequest.model_validate(diamond_json("astar")))

    assert result.found is True
    assert reads == 2
