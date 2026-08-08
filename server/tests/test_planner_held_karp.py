from __future__ import annotations

from collections.abc import Sequence

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

from .fixtures import trip_request

# A three-node cycle W -> A -> B -> W at 1.0 a leg, with the reverse direction
# available but half again as expensive, so the closed tour has one clear winner.
_CYCLE_EDGES: list[tuple[str, str, float]] = [
    ("W", "A", 1.0),
    ("A", "B", 1.0),
    ("B", "W", 1.0),
    ("W", "B", 1.5),
    ("B", "A", 1.5),
    ("A", "W", 1.5),
]


def _request(
    *,
    start: str = "W",
    goal: str = "W",
    stops: Sequence[str] = (),
    optimise_order: bool = True,
    return_to_start: bool = False,
    edges: Sequence[tuple[str, str, float]] | None = None,
) -> PlanRequest:
    return trip_request(
        "held_karp",
        start=start,
        goal=goal,
        stops=stops,
        edges=_CYCLE_EDGES if edges is None else edges,
        optimise_order=optimise_order,
        return_to_start=return_to_start,
    )


def test_contract_and_registry_accept_held_karp_without_point_search_registration() -> None:
    request = _request()

    assert request.algo == "held_karp"
    assert ALGO_OPTIMAL["held_karp"] is True
    assert "held_karp" not in POINT_SEARCHES


def test_plan_endpoint_accepts_held_karp() -> None:
    request = _request(stops=["A", "B"])

    response = TestClient(app).post("/plan", json=request.model_dump(mode="json", by_alias=True))

    assert response.status_code == 200
    assert response.json()["algo"] == "held_karp"
    assert response.json()["found"] is True


@pytest.mark.parametrize("optimise_order", [False, True])
def test_held_karp_always_runs_dp(
    monkeypatch: pytest.MonkeyPatch,
    optimise_order: bool,
) -> None:
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return a_star_search(problem)

    monkeypatch.setattr(planner, "a_star_search", search)
    result = planner.plan_route(_request(stops=["B", "A"], optimise_order=optimise_order))

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


def test_flat_cost_withdraws_the_optimal_claim() -> None:
    # Every route costs 0 with no weights, so "optimal" would be true of any
    # answer. UCS already withdrew the claim here and Held-Karp did not, which
    # made one comparison grid disagree with itself.
    request = _request(stops=["B", "A"])
    request.conditions.weights.distance = 0.0

    result = planner.plan_route(request)

    assert result.found is True
    assert result.metrics.optimal is False


def test_open_held_karp_plans_a_trip_to_a_distinct_goal() -> None:
    # This used to be refused outright -- "Held-Karp requires start and goal to be
    # the same warehouse" -- so the exact optimiser was unavailable for the most
    # ordinary trip shape there is. The goal is now the fixed end of an open path.
    result = planner.plan_route(_request(goal="A", stops=["B"], return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "B", "A"]
    assert result.metrics.optimal is True


def test_open_held_karp_finishes_at_the_goal_rather_than_the_cheapest_stop() -> None:
    result = planner.plan_route(_request(goal="B", stops=["A"], return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "A", "B"]
    assert result.path == ["W", "A", "B"]
    assert result.metrics.optimal is True


def test_closed_held_karp_demotes_the_goal_to_an_ordinary_stop() -> None:
    result = planner.plan_route(_request(goal="B", stops=["A"], return_to_start=True))

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]
    assert result.path == ["W", "A", "B", "W"]
    assert result.metrics.optimal is True


def test_open_and_closed_held_karp_choose_different_orders() -> None:
    # One direction round the triangle is dear and the other cheap. Pinned to
    # finish at B the tour must go the expensive way; free to close the loop it
    # runs the other way instead -- so the closed tour is not the open one with a
    # return leg bolted on, and here it is the cheaper of the two despite driving
    # an extra leg.
    #
    # Every direct edge is also the cheapest route between its endpoints, so the
    # Pairwise A* costs are these numbers rather than some detour through the
    # third node. That has to be arranged deliberately: on a three-node graph a
    # dear edge is simply bypassed, and the DP would then be ordering costs the
    # test never wrote down.
    edges = [
        ("W", "A", 4.0),
        ("A", "B", 4.0),
        ("B", "W", 4.0),
        ("W", "B", 2.0),
        ("B", "A", 2.0),
        ("A", "W", 2.0),
    ]

    open_result = planner.plan_route(
        _request(goal="B", stops=["A"], return_to_start=False, edges=edges)
    )
    closed_result = planner.plan_route(
        _request(goal="B", stops=["A"], return_to_start=True, edges=edges)
    )

    assert open_result.order == ["W", "A", "B"]
    assert open_result.metrics.cost == 8.0
    assert closed_result.order == ["W", "B", "A", "W"]
    assert closed_result.metrics.cost == 6.0


def test_a_dropoff_at_the_pickup_is_a_closed_tour_however_the_toggle_is_set() -> None:
    # Every other algorithm plans this as a loop -- `_leg_sequence` closes it just
    # by appending a goal that equals the start -- so Held-Karp reads the request
    # the same way instead of being the one that answers a different question.
    result = planner.plan_route(_request(goal="W", stops=["A", "B"], return_to_start=False))

    assert result.found is True
    assert result.order == ["W", "A", "B", "W"]


@pytest.mark.parametrize("return_to_start", [False, True])
def test_held_karp_refuses_a_trip_with_nowhere_to_go(return_to_start: bool) -> None:
    result = planner.plan_route(_request(goal="W", stops=[], return_to_start=return_to_start))

    assert result.found is False
    assert result.problem is not None and "same intersection" in result.problem


def test_open_held_karp_needs_no_return_leg() -> None:
    result = planner.plan_route(
        _request(goal="A", stops=[], return_to_start=False, edges=[("W", "A", 1.0)])
    )

    assert result.found is True
    assert result.order == ["W", "A"]


def test_closed_held_karp_requires_a_return_leg() -> None:
    result = planner.plan_route(
        _request(goal="A", stops=[], return_to_start=True, edges=[("W", "A", 1.0)])
    )

    assert result.found is False
    assert result.problem is not None and "closed tour" in result.problem


def test_open_held_karp_reports_an_incomplete_route() -> None:
    result = planner.plan_route(
        _request(goal="B", stops=["A"], return_to_start=False, edges=[("W", "A", 1.0)])
    )

    assert result.found is False
    assert result.problem is not None and "open route" in result.problem


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


def test_held_karp_rejects_the_warehouse_as_a_stop() -> None:
    result = planner.plan_route(_request(stops=["W"]))

    assert result.found is False
    assert result.problem is not None and "warehouse" in result.problem


def test_held_karp_no_hamiltonian_cycle_is_finite_failure() -> None:
    result = planner.plan_route(_request(stops=["A"], edges=[("W", "A", 1.0)]))

    assert result.found is False
    assert result.problem is not None and "closed tour" in result.problem
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

    # There is nowhere to go, so the refusal has to come before the cost matrix:
    # building one over a single location is work with no possible answer.
    assert result.found is False
    assert result.problem is not None and "same intersection" in result.problem
