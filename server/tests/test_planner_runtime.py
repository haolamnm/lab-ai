"""The planner reports two times, and they answer two different questions.

``ms`` is the summed leg-search time. ``planRoute`` in web/src/lib/search.ts sums
exactly the same thing, so it is the figure a pane may show and rank without
knowing which planner answered — one trip, one number, either way.

``planning_ms`` is wall clock over the whole post-validation pipeline, ordering
search included. Only this planner can measure it: the browser computes its
ordering behind a memo, so the same span there would time the pane order rather
than the work. It is absent from a browser result and from a request rejected
before the clock starts.

Keeping them apart is the point. Widening ``ms`` to cover the pipeline is what
made a local and a remote run of one trip disagree.
"""

from collections.abc import Callable, Iterator
from dataclasses import replace

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


def _legs_taking(ms: float) -> Callable[[SearchProblem], SearchLegResult]:
    """A real search whose leg reports a fixed elapsed time.

    Only the number is faked. The route, the trace and the effort counts stay
    the ones the search really produced, so a test can add up a figure it chose
    without also having to hand-build a plausible leg.
    """
    real = POINT_SEARCHES["ucs"]

    def search(problem: SearchProblem) -> SearchLegResult:
        return replace(real(problem), ms=ms)

    return search


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar", "nearest", "held_karp"])
def test_planning_time_is_planner_wall_clock_for_every_algorithm(
    monkeypatch: pytest.MonkeyPatch,
    algo: AlgoKey,
) -> None:
    _clock(monkeypatch, 10.0, 10.01234)
    request = PlanRequest.model_validate(diamond_json(algo))

    result = planner.plan_route(request)

    assert result.found is True
    assert result.metrics.planning_ms == 12.3


def test_runtime_is_the_leg_sum_and_not_the_wall_clock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`ms` adds up the legs, which is the browser planner's measurement too.

    The planner's own clock is stubbed to a figure nothing could sum to, so a
    regression that pipes wall-clock time back into `ms` — the shape the two
    planners disagreed over — cannot pass by coincidence.
    """
    monkeypatch.setitem(POINT_SEARCHES, "ucs", _legs_taking(4.0))
    _clock(monkeypatch, 0.0, 99.0)
    request = trip_request("ucs", start="W", goal="B", stops=["A"])

    result = planner.plan_route(request)

    assert result.found is True
    # Two legs, W -> A and A -> B, at the 4.0 ms each the stub reports.
    assert result.metrics.ms == 8.0
    assert result.metrics.planning_ms == 99000.0


def test_a_route_that_ran_no_leg_reports_no_leg_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`ms` is zero because nothing was searched, not as a placeholder.

    `planning_ms` is not zero: finding out that the trip was degenerate is work
    the backend did, and the two numbers part company here by design.
    """
    _clock(monkeypatch, 50.0, 50.0021)
    request = trip_request("ucs", start="W", goal="W")

    result = planner.plan_route(request)

    assert result.found is False
    assert result.problem is not None
    assert "same intersection" in result.problem
    assert result.metrics.ms == 0.0
    assert result.metrics.planning_ms == 2.1


def test_unknown_point_is_rejected_before_the_clock_starts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Validation is request preparation, so it is timed by neither figure.

    `planning_ms` is left unset rather than zero. A browser result has no such
    number at all, and `None` is how the app tells "not measured here" apart
    from "measured, and it was instant".
    """

    def fail_clock() -> float:
        raise AssertionError("the planner timer must not start before validation")

    monkeypatch.setattr(planner, "perf_counter", fail_clock)
    request = PlanRequest.model_validate(diamond_json("astar"))
    request.start = "GHOST"

    result = planner.plan_route(request)

    assert result.found is False
    assert result.metrics.ms == 0.0
    assert result.metrics.planning_ms is None


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
    assert result.metrics.planning_ms == 6.0


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
    assert result.metrics.planning_ms == 8.2


def test_every_result_off_the_planner_carries_a_planning_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Past validation, no exit may return `planning_ms` unset.

    A sweep rather than a guarantee: `plan_route` sets it at its single exit, so
    a branch added inside `_plan_measured` is measured by construction and this
    cannot catch one. What it does catch is a result reaching a caller by some
    other route — a second public entry point, or `finish`-style wrapping
    creeping back in — which would leave the field `None` on the wire and read
    in the app as "the browser planned this".
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
        planning_ms = planner.plan_route(request).metrics.planning_ms
        assert planning_ms is not None and planning_ms > 0.0, request.algo


def test_request_preparation_stays_outside_the_measured_span() -> None:
    """Only work after validation is timed, and the clock is read exactly twice.

    The regression the single exit left possible: `plan_route` still has one
    return ahead of `started_at`, and a second one added there would report no
    planning time at all. Counting the reads pins the boundary from the other
    side — a clock started earlier, or a stray `perf_counter` put back inside
    the pipeline, breaks this without needing a timing assertion.
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
