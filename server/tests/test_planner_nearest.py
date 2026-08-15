"""Nearest Neighbor planner integration through one multi-goal A* per step."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace

import pytest

import route_lab.planner as planner
from route_lab.algorithms.registry import POINT_SEARCHES
from route_lab.contract.request import PlanRequest
from route_lab.shared.pairwise import PairwiseResult
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult

from .fixtures import trip_request


def _request(
    *,
    stops: Sequence[str] = ("A",),
    goal: str = "B",
    optimise_order: bool = False,
    return_to_start: bool = False,
    edges: Sequence[tuple[str, str, float]] | None = None,
) -> PlanRequest:
    return trip_request(
        "nearest",
        goal=goal,
        stops=stops,
        optimise_order=optimise_order,
        return_to_start=return_to_start,
        **({} if edges is None else {"edges": edges}),
    )


@pytest.mark.parametrize("optimise_order", [False, True])
def test_nearest_uses_one_multi_goal_astar_per_step_without_rerunning_legs(
    monkeypatch: pytest.MonkeyPatch,
    optimise_order: bool,
) -> None:
    calls: list[tuple[str, tuple[str, ...]]] = []
    real_search = planner.nearest_neighbor_multi_goal_search

    def search(problem: SearchProblem, goals: Sequence[str]) -> SearchLegResult:
        calls.append((problem.start, tuple(goals)))
        return real_search(problem, goals)

    monkeypatch.setattr(planner, "nearest_neighbor_multi_goal_search", search)
    result = planner.plan_route(_request(optimise_order=optimise_order, return_to_start=True))

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]
    assert result.path == ["W", "A", "B", "W"]
    assert result.metrics.optimal is False
    # One search chooses among both first-step candidates, one chooses the only
    # remaining candidate, and one closes the tour. No winning leg is rerun.
    assert calls == [("W", ("A", "B")), ("A", ("B",)), ("B", ("W",))]
    assert "nearest" not in POINT_SEARCHES


def test_nearest_respects_directed_astar_route_costs() -> None:
    request = _request(
        stops=["A"],
        goal="B",
        return_to_start=True,
        edges=[
            ("W", "A", 5.0),
            ("W", "B", 1.0),
            ("B", "A", 2.0),
            ("A", "W", 3.0),
        ],
    )

    result = planner.plan_route(request)

    assert result.found is True
    # B is the cheapest reachable route from W; directed reverse costs are not
    # substituted for the directed multi-goal A* route costs.
    assert result.order == ["W", "B", "A", "W"]
    assert result.path == ["W", "B", "A", "W"]


def test_nearest_preserves_input_order_for_astar_cost_ties() -> None:
    request = _request(
        stops=["B"],
        goal="A",
        return_to_start=True,
        edges=[
            ("W", "B", 1.0),
            ("W", "A", 1.0),
            ("B", "A", 1.0),
            ("A", "B", 1.0),
            ("A", "W", 1.0),
            ("B", "W", 1.0),
        ],
    )

    result = planner.plan_route(request)

    assert result.order == ["W", "B", "A", "W"]


def test_nearest_runtime_sums_one_multi_goal_search_per_step(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = iter((10.0, 10.00456))
    monkeypatch.setattr(planner, "perf_counter", lambda: next(clock))
    request = _request(
        stops=["A"],
        goal="B",
        return_to_start=True,
        edges=[
            ("W", "A", 1.0),
            ("W", "B", 2.0),
            ("A", "B", 1.0),
            ("B", "A", 1.0),
            ("B", "W", 1.0),
        ],
    )
    real_search = planner.nearest_neighbor_multi_goal_search
    durations: dict[tuple[str, tuple[str, ...]], float] = {
        ("W", ("A", "B")): 1.0,
        ("A", ("B",)): 2.0,
        ("B", ("W",)): 3.0,
    }

    def timed_search(problem: SearchProblem, goals: Sequence[str]) -> SearchLegResult:
        result = real_search(problem, goals)
        return replace(result, ms=durations[(problem.start, tuple(goals))])

    monkeypatch.setattr(planner, "nearest_neighbor_multi_goal_search", timed_search)

    result = planner.plan_route(request)

    assert result.path == ["W", "A", "B", "W"]
    assert result.metrics.ms == 6.0
    assert result.metrics.planning_ms == 4.6
    # Route-effort counters still describe only the selected, replayable legs.
    assert result.metrics.expanded == len(result.trace)


def test_nearest_explains_an_unreachable_leg_instead_of_naming_the_cache() -> None:
    # W reaches both stops but nothing leaves A, so the A -> B leg has no route.
    result = planner.plan_route(
        _request(stops=["A"], goal="B", edges=[("W", "A", 1.0), ("W", "B", 3.0)])
    )

    assert result.found is False
    assert result.problem is not None and "one-way" in result.problem
    assert result.metrics.cost == 1.0


def test_open_nearest_finishes_at_the_goal() -> None:
    # The dropoff is a destination, not a hint. It used to be discarded outright
    # whenever `returnToStart` was set, so this trip ended at whichever stop the
    # ordering happened to leave last.
    result = planner.plan_route(_request(stops=["A"], goal="B", return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    assert result.path == ["W", "A", "B"]
    assert result.metrics.optimal is False


def test_closed_nearest_orders_the_goal_like_any_other_stop() -> None:
    # A cycle has no last stop, so on a closed tour the dropoff is demoted to an
    # ordinary location and takes whatever position the ordering gives it.
    result = planner.plan_route(_request(stops=["A"], goal="B", return_to_start=True))

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]
    assert result.path == ["W", "A", "B", "W"]
    assert result.metrics.optimal is False


# W -> B is the cheapest first hop out of the pickup, so a greedy pass that is
# free to place the dropoff anywhere opens with it. The default TRIP_EDGES cannot
# show this: there W -> A is cheaper than W -> B, so greedy ends at the dropoff by
# luck and a planner that never pins it passes the two tests above regardless.
_EDGES_DROPOFF_IS_NEAREST: list[tuple[str, str, float]] = [
    ("W", "A", 5.0),
    ("W", "B", 1.0),
    ("A", "B", 1.0),
    ("B", "A", 1.0),
]

# The same graph with a way home, so a closed tour is possible at all.
_EDGES_DROPOFF_IS_NEAREST_WITH_RETURN: list[tuple[str, str, float]] = [
    *_EDGES_DROPOFF_IS_NEAREST,
    ("A", "W", 1.0),
    ("B", "W", 1.0),
]


def test_open_nearest_finishes_at_a_goal_it_would_rather_visit_first() -> None:
    result = planner.plan_route(
        _request(
            stops=["A"],
            goal="B",
            return_to_start=False,
            edges=_EDGES_DROPOFF_IS_NEAREST,
        )
    )

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    # Greedy would rather run W -> B -> A for 2.0, but that trip ends at a stop.
    # Finishing where the request asked costs 3.0, and is the trip that was asked
    # for; Nearest Neighbor is a heuristic over the order, not over the shape.
    assert result.metrics.cost == 3.0
    # The W -> A leg is routed through B, because A* prefers the two 1.0 hops to
    # the direct 5.0 edge. Passing through the dropoff is not visiting it: the
    # visit order above is what the trip promised, and B still ends it.
    assert result.path == ["W", "B", "A", "B"]


def test_closed_nearest_may_open_with_the_goal() -> None:
    # The counterpart to the test above, on the same costs: a cycle has no last
    # stop, so nothing is pinned and greedy is free to visit the dropoff first.
    # The two shapes must not be ordered by the same rule.
    result = planner.plan_route(
        _request(
            stops=["A"],
            goal="B",
            return_to_start=True,
            edges=_EDGES_DROPOFF_IS_NEAREST_WITH_RETURN,
        )
    )

    assert result.found is True
    assert result.order == ["W", "B", "A", "W"]


@pytest.mark.parametrize("return_to_start", [False, True])
def test_nearest_refuses_a_trip_with_nowhere_to_go(return_to_start: bool) -> None:
    # No stops and a dropoff already at the pickup. The point searches answer this
    # with the same sentence, so all six panes agree it is not a trip.
    result = planner.plan_route(_request(stops=[], goal="W", return_to_start=return_to_start))

    assert result.found is False
    assert result.problem is not None and "same intersection" in result.problem


@pytest.mark.parametrize(
    ("return_to_start", "expected_order", "expected_calls"),
    [(False, ["W", "A"], 1), (True, ["W", "A", "W"], 2)],
)
def test_nearest_does_not_rerun_a_selected_astar_leg(
    monkeypatch: pytest.MonkeyPatch,
    return_to_start: bool,
    expected_order: list[str],
    expected_calls: int,
) -> None:
    calls = 0
    real_search = planner.nearest_neighbor_multi_goal_search

    def search(problem: SearchProblem, goals: Sequence[str]) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return real_search(problem, goals)

    monkeypatch.setattr(planner, "nearest_neighbor_multi_goal_search", search)
    result = planner.plan_route(_request(stops=[], goal="A", return_to_start=return_to_start))

    assert result.found is True
    assert result.order == expected_order
    assert calls == expected_calls


def test_open_nearest_succeeds_without_a_return_leg() -> None:
    result = planner.plan_route(
        _request(stops=[], goal="A", return_to_start=False, edges=[("W", "A", 1.0)])
    )

    assert result.found is True
    assert result.order == ["W", "A"]


def test_closed_nearest_fails_without_a_return_leg() -> None:
    result = planner.plan_route(
        _request(stops=[], goal="A", return_to_start=True, edges=[("W", "A", 1.0)])
    )

    assert result.found is False
    assert result.problem is not None and "closed tour" in result.problem


def test_open_nearest_reports_a_missing_internal_leg() -> None:
    result = planner.plan_route(
        _request(stops=["A"], goal="B", return_to_start=False, edges=[("W", "A", 1.0)])
    )

    assert result.found is False
    assert result.problem is not None and "open route" in result.problem


def test_open_nearest_accepts_the_start_as_a_stop() -> None:
    # W is already where the trip begins, so revisiting it first is a zero-length
    # leg the planner drops rather than a route back to itself.
    result = planner.plan_route(_request(stops=["W", "A"], goal="A", return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "A"]


def test_open_nearest_orders_the_goal_among_the_stops() -> None:
    result = planner.plan_route(_request(stops=["B", "A"], goal="B"))

    assert result.found is True
    assert result.order == ["W", "A", "B"]


@pytest.mark.parametrize(
    ("stops", "goal", "expected_order"),
    [
        # A dropoff already at the pickup makes the trip a loop however the toggle
        # is set, so this one comes home. Nearest Neighbor used to be alone in
        # answering ["W", "A"] here: greedy took the zero-cost (W, W) pair first
        # and the leg home was then dropped as a consecutive duplicate. The other
        # five algorithms all closed it, and now so does this one.
        (["A"], "W", ["W", "A", "W"]),
        (["A", "B"], "B", ["W", "A", "B"]),
    ],
)
def test_nearest_uses_stable_unique_destinations_without_mutating_the_request(
    monkeypatch: pytest.MonkeyPatch,
    stops: list[str],
    goal: str,
    expected_order: list[str],
) -> None:
    def pairwise_must_not_run(**_kwargs: object) -> PairwiseResult:
        raise AssertionError("Nearest Neighbor must not build an all-pairs matrix")

    monkeypatch.setattr(planner, "build_pairwise", pairwise_must_not_run)
    request = _request(stops=stops, goal=goal)
    original_stops = list(request.stops)

    result = planner.plan_route(request)

    assert result.order == expected_order
    assert request.stops == original_stops


def test_nearest_trivial_duplicate_legs_run_no_astar(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def search_must_not_run(
        _problem: SearchProblem,
        _goals: Sequence[str],
    ) -> SearchLegResult:
        raise AssertionError("a degenerate trip must run no A* search")

    monkeypatch.setattr(planner, "nearest_neighbor_multi_goal_search", search_must_not_run)
    result = planner.plan_route(_request(stops=["W"], goal="W"))

    assert result.found is False
    assert result.order == []
    assert result.problem is not None and "same intersection" in result.problem
