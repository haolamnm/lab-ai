"""Nearest-neighbour stop ordering: cheapest-first, and unreachable stops kept."""

from route_lab.algorithms.nearest_neighbor import nearest_neighbor_order
from route_lab.contract.conditions import Conditions
from route_lab.shared.graph import build_graph

from .fixtures import diamond_payload, shortest_weights


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
