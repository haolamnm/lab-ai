"""Planner ownership of optional and algorithm-intrinsic stop ordering."""

from collections.abc import Sequence
from typing import Any, cast

import pytest

from route_lab import planner
from route_lab.algorithms.registry import PointSearchKey
from route_lab.contract.conditions import Conditions
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.shared.graph import Graph
from route_lab.shared.pairwise import PairwiseResult
from route_lab.shared.problem import PointSearch, SearchProblem
from route_lab.shared.search import SearchLegResult, SearchStats

from .fixtures import trip_request

# W -> B direct is four times the W -> A -> B route, so an ordering pass that
# actually consults the cost matrix visits A first and one that does not cannot.
_EDGES: list[tuple[str, str, float]] = [
    ("W", "A", 1.0),
    ("W", "B", 4.0),
    ("A", "B", 1.0),
    ("B", "A", 1.0),
]


def _request(
    algo: AlgoKey,
    *,
    optimise_order: bool,
    return_to_start: bool = False,
    edges: Sequence[tuple[str, str, float]] = tuple(_EDGES),
) -> PlanRequest:
    return trip_request(
        algo,
        goal="B",
        stops=["B", "A"],
        edges=edges,
        optimise_order=optimise_order,
        return_to_start=return_to_start,
    )


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_search_without_optimisation_preserves_entered_order(algo: AlgoKey) -> None:
    result = planner.plan_route(_request(algo, optimise_order=False))

    assert result.found is True
    assert result.order == ["W", "B", "A", "B"]


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_search_without_optimisation_skips_pairwise(
    monkeypatch: pytest.MonkeyPatch,
    algo: AlgoKey,
) -> None:
    def fail_pairwise(**kwargs: object) -> PairwiseResult:
        raise AssertionError(f"Pairwise must not run: {kwargs}")

    monkeypatch.setattr(planner, "build_pairwise", fail_pairwise)

    result = planner.plan_route(_request(algo, optimise_order=False))

    assert result.found is True


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_search_with_optimisation_uses_nearest_order(algo: AlgoKey) -> None:
    result = planner.plan_route(_request(algo, optimise_order=True))

    assert result.found is True
    assert result.order == ["W", "A", "B"]


def test_optional_ordering_uses_pairwise_astar(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0
    original = planner.build_pairwise

    def pairwise(
        graph: Graph,
        locations: Sequence[str],
        conditions: Conditions,
        search: PointSearch,
    ) -> PairwiseResult:
        nonlocal calls
        calls += 1
        assert search is planner.a_star_search
        return original(graph, locations, conditions, search)

    monkeypatch.setattr(planner, "build_pairwise", pairwise)

    result = planner.plan_route(_request("bfs", optimise_order=True))

    assert result.found is True
    assert calls == 1


def test_optional_ordering_excludes_pairwise_metrics(monkeypatch: pytest.MonkeyPatch) -> None:
    expensive_preprocessing = SearchLegResult(
        path=["W", "B"],
        edges=[],
        trace=[],
        found=True,
        ms=10_000.0,
        stats=SearchStats(expanded=10_000, generated=10_000, max_frontier=10_000),
    )
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
        lambda **_kwargs: PairwiseResult(
            costs=costs,
            paths={("W", "B"): expensive_preprocessing},
        ),
    )

    result = planner.plan_route(_request("ucs", optimise_order=True))

    assert result.found is True
    assert result.metrics.expanded < 10_000
    assert result.metrics.generated < 10_000
    assert result.metrics.ms < 10_000.0


# UCS is absent here because it no longer orders through the pairwise matrix;
# `test_optional_ordering_keeps_ucs_legs_on_dijkstra` below pins the same
# guarantee for it against the search it does use.
@pytest.mark.parametrize(
    ("algo", "search_name"),
    [
        ("bfs", "breadth_first_search"),
        ("dfs", "depth_first_search"),
        ("astar", "a_star_search"),
    ],
)
def test_optional_ordering_does_not_change_leg_search(
    monkeypatch: pytest.MonkeyPatch,
    algo: PointSearchKey,
    search_name: str,
) -> None:
    selected_search = planner.POINT_SEARCHES[algo]
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return selected_search(problem)

    assert cast(Any, selected_search).__name__ == search_name
    monkeypatch.setitem(planner.POINT_SEARCHES, algo, search)

    result = planner.plan_route(_request(algo, optimise_order=True))

    assert result.found is True
    assert calls == 2


def test_optional_ordering_keeps_ucs_legs_on_dijkstra(monkeypatch: pytest.MonkeyPatch) -> None:
    # The invariant the parametrized test above states -- asking for an order
    # must not quietly route the legs with some other algorithm -- still holds
    # for UCS. What changed is that ordering and routing became the same search:
    # `uniform_cost_multi_goal_search` is Dijkstra asked for a set of goals
    # instead of one, so it settles the nearest and the legs stay UCS legs. That
    # is also why the count is one call per leg rather than one per candidate.
    real_search = planner.uniform_cost_multi_goal_search
    calls: list[tuple[str, tuple[str, ...]]] = []

    def search(problem: SearchProblem, goals: Sequence[str]) -> SearchLegResult:
        calls.append((problem.start, tuple(goals)))
        return real_search(problem, goals)

    monkeypatch.setattr(planner, "uniform_cost_multi_goal_search", search)

    result = planner.plan_route(_request("ucs", optimise_order=True))

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    # One step over both destinations, then the pinned dropoff. A search per
    # candidate would have made three calls to reach the same two legs.
    assert calls == [("W", ("A",)), ("A", ("B",))]


# The same graph with a way home, so a closed tour is possible at all.
_EDGES_WITH_RETURN: list[tuple[str, str, float]] = [*_EDGES, ("B", "W", 1.0), ("A", "W", 1.0)]


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_return_to_start_closes_the_loop_for_point_searches(algo: AlgoKey) -> None:
    # A point search reads the flag too. It does not get to choose the order --
    # that is what the trip-level algorithms are for -- but it plans the same
    # shape, so all six panes answer the question the toggle asked. This used to
    # be the opposite rule, and four panes could show an open route beside two
    # closed tours with nothing on screen saying why they disagreed.
    open_tour = planner.plan_route(_request(algo, optimise_order=False, edges=_EDGES_WITH_RETURN))
    closed_tour = planner.plan_route(
        _request(algo, optimise_order=False, return_to_start=True, edges=_EDGES_WITH_RETURN)
    )

    assert open_tour.order == ["W", "B", "A", "B"]
    assert closed_tour.order == ["W", "B", "A", "B", "W"]
    assert closed_tour.metrics.cost > open_tour.metrics.cost


# W -> B is the cheapest first hop out of the pickup, so an ordering pass free to
# place the dropoff anywhere opens with it and leaves the trip ending at a stop.
_EDGES_DROPOFF_IS_NEAREST: list[tuple[str, str, float]] = [
    ("W", "A", 5.0),
    ("W", "B", 1.0),
    ("A", "B", 1.0),
    ("B", "A", 1.0),
]


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_an_optimised_open_point_search_still_finishes_at_the_dropoff(algo: AlgoKey) -> None:
    # Optimising reorders the stops; it does not move the dropoff off the end.
    # Only a round trip demotes the dropoff, and this request is not one.
    result = planner.plan_route(
        trip_request(
            algo,
            goal="B",
            stops=["A"],
            edges=_EDGES_DROPOFF_IS_NEAREST,
            optimise_order=True,
            return_to_start=False,
        )
    )

    assert result.found is True
    assert result.order == ["W", "A", "B"]


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_a_closed_point_search_still_orders_by_the_toggle(algo: AlgoKey) -> None:
    # Ordering and shape are independent controls: closing the loop must not
    # quietly turn the ordering pass on, nor suppress it.
    result = planner.plan_route(
        _request(algo, optimise_order=True, return_to_start=True, edges=_EDGES_WITH_RETURN)
    )

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]
