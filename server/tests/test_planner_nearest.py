"""Nearest Neighbor planner integration through directed Pairwise A*."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import pytest

import route_lab.planner as planner
from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.registry import POINT_SEARCHES
from route_lab.contract.conditions import Conditions
from route_lab.contract.request import PlanRequest
from route_lab.contract.result import TraceStep
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.pairwise import PairwiseResult
from route_lab.shared.problem import PointSearch, SearchProblem
from route_lab.shared.search import SearchLegResult, SearchStats

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


def _stub_pairwise(
    monkeypatch: pytest.MonkeyPatch,
    costs: Mapping[tuple[str, str], float],
    paths: Mapping[tuple[str, str], SearchLegResult],
) -> None:
    """Hand the planner a matrix instead of letting Pairwise A* compute one.

    What is under test in these cases is which pairs the planner selects and what
    it does with them, so the matrix is written by hand — a real search over the
    fixture graph could only produce matrices that agree with the fixture.
    """
    monkeypatch.setattr(
        planner,
        "build_pairwise",
        lambda **_kwargs: PairwiseResult(costs=costs, paths=paths),
    )


def _capture_pairwise(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record the locations Pairwise is asked for, while still running it."""
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
    return captured


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
    # Three locations means six directed pairs, and the two selected legs are
    # taken from that cache rather than searched a second time.
    assert calls == 6
    assert "nearest" not in POINT_SEARCHES


def test_nearest_respects_directed_pairwise_costs(monkeypatch: pytest.MonkeyPatch) -> None:
    # A closed tour, because that is the shape where the ordering has a free hand
    # over every destination. On an open route the dropoff is pinned last, so a
    # one-stop trip has no ordering decision left for the matrix to influence.
    request = _request(stops=["A"], goal="B", return_to_start=True)
    graph = build_graph(request.graph)
    _stub_pairwise(
        monkeypatch,
        costs={
            ("W", "W"): 0.0,
            ("A", "A"): 0.0,
            ("B", "B"): 0.0,
            ("W", "A"): 5.0,
            ("W", "B"): 1.0,
            ("A", "B"): 0.1,
            ("B", "A"): 2.0,
            ("A", "W"): 3.0,
            ("B", "W"): 4.0,
        },
        paths={
            ("W", "B"): _leg(graph, "W", "B", 1),
            ("B", "A"): _leg(graph, "B", "A", 2),
            ("A", "W"): _leg(graph, "A", "W", 3),
        },
    )

    result = planner.plan_route(request)

    assert result.found is True
    # B before A: reading the pair (A, B) = 0.1 as if it were (B, A) would put A
    # first, so the order proves the matrix is consulted in the right direction.
    assert result.order == ["W", "B", "A", "W"]
    assert result.path == ["W", "B", "A", "W"]


def test_nearest_preserves_input_order_for_pairwise_cost_ties(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request(stops=["B"], goal="A")
    graph = build_graph(request.graph)
    _stub_pairwise(
        monkeypatch,
        costs={
            ("W", "W"): 0.0,
            ("A", "A"): 0.0,
            ("B", "B"): 0.0,
            ("W", "A"): 1.0,
            ("W", "B"): 1.0,
            ("B", "A"): 1.0,
        },
        paths={
            ("W", "B"): _leg(graph, "W", "B", 1),
            ("B", "A"): _leg(graph, "B", "A", 2),
        },
    )

    result = planner.plan_route(request)

    assert result.order == ["W", "B", "A"]


def test_nearest_search_effort_includes_only_selected_cached_legs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = iter((10.0, 10.00456))
    monkeypatch.setattr(planner, "perf_counter", lambda: next(clock))
    request = _request()
    graph = build_graph(request.graph)
    unused = _leg(graph, "W", "B", 99)
    _stub_pairwise(
        monkeypatch,
        costs={
            ("W", "W"): 0.0,
            ("A", "A"): 0.0,
            ("B", "B"): 0.0,
            ("W", "A"): 1.0,
            ("W", "B"): 2.0,
            ("A", "B"): 1.0,
        },
        paths={
            ("W", "A"): _leg(graph, "W", "A", 1),
            ("A", "B"): _leg(graph, "A", "B", 2),
            ("W", "B"): unused,
        },
    )

    result = planner.plan_route(request)

    assert result.path == ["W", "A", "B"]
    assert result.metrics.ms == 4.6
    assert result.metrics.expanded == 3
    assert result.metrics.generated == 5
    assert result.metrics.reopened == 1
    assert result.metrics.max_frontier == 4
    assert result.metrics.turns_blocked == 1


def test_nearest_explains_an_unreachable_leg_instead_of_naming_the_cache() -> None:
    # W reaches both stops but nothing leaves A, so the A -> B leg has no route.
    result = planner.plan_route(
        _request(stops=["A"], goal="B", edges=[("W", "A", 1.0), ("W", "B", 3.0)])
    )

    assert result.found is False
    assert result.problem is not None and "one-way" in result.problem
    assert result.metrics.cost == 0.0


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
    ("return_to_start", "expected_order"),
    [(False, ["W", "A"]), (True, ["W", "A", "W"])],
)
def test_nearest_reuses_pairwise_astar_legs(
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
    result = planner.plan_route(_request(stops=[], goal="A", return_to_start=return_to_start))

    assert result.found is True
    assert result.order == expected_order
    # Two locations, two directed pairs, and the return leg is taken from the
    # same cache rather than searched again.
    assert calls == 2


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
    ("stops", "goal", "expected_order", "expected_locations"),
    [
        # A dropoff already at the pickup makes the trip a loop however the toggle
        # is set, so this one comes home. Nearest Neighbor used to be alone in
        # answering ["W", "A"] here: greedy took the zero-cost (W, W) pair first
        # and the leg home was then dropped as a consecutive duplicate. The other
        # five algorithms all closed it, and now so does this one.
        (["A"], "W", ["W", "A", "W"], ["W", "A"]),
        (["A", "B"], "B", ["W", "A", "B"], ["W", "A", "B"]),
    ],
)
def test_nearest_uses_stable_unique_pairwise_locations_without_dropping_destinations(
    monkeypatch: pytest.MonkeyPatch,
    stops: list[str],
    goal: str,
    expected_order: list[str],
    expected_locations: list[str],
) -> None:
    captured = _capture_pairwise(monkeypatch)
    request = _request(stops=stops, goal=goal)
    original_stops = list(request.stops)

    result = planner.plan_route(request)

    assert captured == expected_locations
    assert result.order == expected_order
    assert request.stops == original_stops


def test_nearest_trivial_duplicate_legs_need_no_diagonal_cached_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _capture_pairwise(monkeypatch)
    result = planner.plan_route(_request(stops=["W"], goal="W"))

    assert captured == ["W"]
    assert result.found is False
    assert result.order == []
    assert result.problem is not None and "same intersection" in result.problem
