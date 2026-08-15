"""Nearest Neighbor ordering and its private A* heuristic."""

from dataclasses import replace

import pytest

from route_lab.algorithms.nearest_neighbor import (
    nearest_neighbor_heuristic,
    nearest_neighbor_heuristic_scale,
    nearest_neighbor_multi_goal_heuristic,
    nearest_neighbor_multi_goal_search,
    nearest_neighbor_order,
)
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import build_problem
from route_lab.shared.traffic import edge_cost

from .fixtures import trip_request


def test_empty_stops() -> None:
    assert nearest_neighbor_order("W", [], {}) == ()


def test_one_reachable_stop() -> None:
    assert nearest_neighbor_order("W", ["A"], {("W", "A"): 2.0}) == ("A",)


def test_one_unreachable_stop_is_retained() -> None:
    assert nearest_neighbor_order("W", ["A"], {}) == ("A",)


def test_lowest_directed_cost_is_selected() -> None:
    costs = {("W", "A"): 4.0, ("W", "B"): 1.0, ("B", "A"): 2.0}

    assert nearest_neighbor_order("W", ["A", "B"], costs) == ("B", "A")


def test_asymmetric_directed_costs_are_respected() -> None:
    costs = {
        ("W", "A"): 5.0,
        ("W", "B"): 1.0,
        ("A", "B"): 0.1,
        ("B", "A"): 2.0,
    }

    assert nearest_neighbor_order("W", ["A", "B"], costs) == ("B", "A")


def test_equal_cost_stops_keep_input_order() -> None:
    costs = {("W", "A"): 1.0, ("W", "B"): 1.0, ("A", "B"): 1.0}

    assert nearest_neighbor_order("W", ["A", "B"], costs) == ("A", "B")


def test_tie_break_is_preserved_after_multiple_iterations() -> None:
    costs = {
        ("W", "A"): 1.0,
        ("W", "B"): 2.0,
        ("W", "C"): 3.0,
        ("A", "B"): 5.0,
        ("A", "C"): 5.0,
        ("B", "C"): 1.0,
    }

    assert nearest_neighbor_order("W", ["A", "B", "C"], costs) == ("A", "B", "C")


def test_multiple_greedy_iterations_use_the_new_current_stop() -> None:
    costs = {
        ("W", "A"): 3.0,
        ("W", "B"): 1.0,
        ("W", "C"): 2.0,
        ("B", "A"): 4.0,
        ("B", "C"): 1.0,
        ("C", "A"): 1.0,
    }

    assert nearest_neighbor_order("W", ["A", "B", "C"], costs) == ("B", "C", "A")


def test_partially_unreachable_stops_are_not_dropped() -> None:
    costs = {("W", "B"): 1.0, ("B", "C"): 2.0}

    assert nearest_neighbor_order("W", ["A", "B", "C"], costs) == ("B", "C", "A")


def test_no_reachable_remaining_candidate_keeps_all_stops() -> None:
    assert nearest_neighbor_order("W", ["C", "A", "B"], {}) == ("C", "A", "B")


def test_unreachable_stops_retain_their_relative_input_order() -> None:
    costs = {("W", "B"): 1.0}

    assert nearest_neighbor_order("W", ["C", "B", "A"], costs) == ("B", "C", "A")


def test_tuple_stops_are_accepted() -> None:
    assert nearest_neighbor_order("W", ("A", "B"), {("W", "B"): 1.0}) == ("B", "A")


def test_stops_are_not_mutated() -> None:
    stops = ["A", "B", "C"]
    original = list(stops)

    nearest_neighbor_order("W", stops, {("W", "B"): 1.0})

    assert stops == original


def test_costs_are_not_mutated() -> None:
    costs = {("W", "A"): 2.0, ("W", "B"): 1.0, ("B", "A"): 3.0}
    original = dict(costs)

    nearest_neighbor_order("W", ["A", "B"], costs)

    assert costs == original


def test_nn_heuristic_is_explicit_positive_and_admissible_on_a_rounded_edge() -> None:
    request = trip_request(
        "nearest",
        start="W",
        goal="A",
        stops=[],
        edges=[("W", "A", 0.0001)],
    )
    graph = build_graph(request.graph)
    scale = nearest_neighbor_heuristic_scale(graph, request.conditions)
    h = nearest_neighbor_heuristic(graph, "A", scale)

    direct_cost = edge_cost(graph.edges[0], request.conditions)
    assert h("W") > 0
    assert h("W") == pytest.approx(direct_cost)
    assert h("A") == 0


def test_multi_goal_heuristic_is_the_nearest_candidate_lower_bound() -> None:
    request = trip_request("nearest", stops=["A"], goal="B")
    graph = build_graph(request.graph)
    scale = nearest_neighbor_heuristic_scale(graph, request.conditions)
    to_a = nearest_neighbor_heuristic(graph, "A", scale)
    to_b = nearest_neighbor_heuristic(graph, "B", scale)
    to_either = nearest_neighbor_multi_goal_heuristic(graph, ["A", "B"], scale)

    assert to_either("W") == min(to_a("W"), to_b("W"))
    assert to_either("A") == 0
    assert to_either("B") == 0


def test_multi_goal_astar_keeps_input_order_when_equal_cost_goals_settle_out_of_order() -> None:
    request = trip_request(
        "nearest",
        stops=["B"],
        goal="A",
        edges=[("W", "A", 1.0), ("W", "B", 1.0)],
    )
    graph = build_graph(request.graph)
    goals = ["B", "A"]
    scale = nearest_neighbor_heuristic_scale(graph, request.conditions)
    problem = replace(
        build_problem(graph, "W", "A", request.conditions),
        heuristic=nearest_neighbor_multi_goal_heuristic(graph, goals, scale),
    )

    result = nearest_neighbor_multi_goal_search(problem, goals)

    # A is inserted first into the frontier, but B is first in the requested
    # candidate order. The search must finish the equal-f tie before deciding.
    assert result.found is True
    assert result.path == ["W", "B"]
    assert result.stats.expanded == len(result.trace)
