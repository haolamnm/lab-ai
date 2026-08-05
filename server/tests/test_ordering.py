"""Nearest-neighbour stop ordering: cheapest-first, and unreachable stops kept."""

import pytest

from route_lab.algorithms.nearest_neighbor import nearest_neighbor_order
from route_lab.contract.conditions import Conditions
from route_lab.contract.request import PlanRequest
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph

from .fixtures import diamond_json, diamond_payload, shortest_weights


def _conditions() -> Conditions:
    return Conditions(vehicle="bike", period="peak", weights=shortest_weights())


def test_order_visits_the_cheaper_stop_first() -> None:
    graph = build_graph(diamond_payload())
    # From A: B is 1.0 away, C is 1.5 away, so B is visited before C.
    order = nearest_neighbor_order(graph, "A", ["C", "B"], _conditions())
    assert order == ["B", "C"]


def test_unreachable_stop_is_kept_at_the_end_not_dropped() -> None:
    graph = build_graph(diamond_payload())
    # "GHOST" is not reachable (not even a node); it must still appear so the leg
    # planner can explain the failure rather than silently dropping a requested stop.
    order = nearest_neighbor_order(graph, "A", ["GHOST", "B"], _conditions())
    assert set(order) == {"B", "GHOST"}
    assert order[-1] == "GHOST"


def test_equal_cost_stops_keep_their_request_order() -> None:
    payload = diamond_payload()
    edges = [
        edge.model_copy(update={"km": 1.0}) if edge.from_ == "A" and edge.to == "C" else edge
        for edge in payload.edges
    ]
    graph = build_graph(payload.model_copy(update={"edges": edges}))

    # B and C now both cost 1.0 from A, so the first requested stop wins.
    order = nearest_neighbor_order(graph, "A", ["C", "B"], _conditions())
    assert order == ["C", "B"]


def test_current_location_is_selected_with_zero_cost() -> None:
    graph = build_graph(diamond_payload())
    order = nearest_neighbor_order(graph, "A", ["C", "A", "B"], _conditions())
    assert order[0] == "A"


def _multi_destination_request(algo: str, *, optimise_order: bool) -> PlanRequest:
    request = diamond_json(algo)
    # This integration fixture must allow both possible visit orders. The base
    # diamond intentionally contains one-way edges only, so add their reverses.
    edges = request["graph"]["edges"]
    request["graph"]["edges"] = [
        *edges,
        *[{**edge, "from": edge["to"], "to": edge["from"]} for edge in edges],
    ]
    request.update(
        {
            "start": "A",
            "stops": ["C"],
            "goal": "B",
            "optimiseOrder": optimise_order,
        }
    )
    return PlanRequest.model_validate(request)


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_searches_keep_the_requested_sequence_when_optimisation_is_off(
    algo: str,
) -> None:
    result = plan_route(_multi_destination_request(algo, optimise_order=False))

    assert result.found is True
    assert result.order == ["A", "C", "B"]


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_point_searches_reorder_all_destinations_when_optimisation_is_on(
    algo: str,
) -> None:
    result = plan_route(_multi_destination_request(algo, optimise_order=True))

    assert result.found is True
    assert result.order == ["A", "B", "C"]


def test_nearest_neighbor_reorders_even_when_optimisation_is_off() -> None:
    result = plan_route(_multi_destination_request("nearest", optimise_order=False))

    assert result.found is True
    assert result.order == ["A", "B", "C"]
