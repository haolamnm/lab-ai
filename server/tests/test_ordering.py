"""Pure Nearest Neighbor ordering over deterministic directed costs."""

from route_lab.algorithms.nearest_neighbor import nearest_neighbor_order


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
