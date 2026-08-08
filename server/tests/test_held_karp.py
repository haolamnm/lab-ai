"""Pure Held–Karp DP over deterministic directed cost mappings."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from itertools import pairwise, permutations

import pytest

from route_lab.algorithms.held_karp import HeldKarpResult, held_karp

SAMPLE_COSTS: dict[tuple[str, str], float] = {
    ("W", "A"): 4.0,
    ("W", "B"): 7.0,
    ("W", "C"): 3.0,
    ("A", "W"): 5.0,
    ("A", "B"): 2.0,
    ("A", "C"): 6.0,
    ("B", "W"): 7.0,
    ("B", "A"): 3.0,
    ("B", "C"): 2.0,
    ("C", "W"): 4.0,
    ("C", "A"): 5.0,
    ("C", "B"): 3.0,
}


def _brute_force(
    warehouse: str,
    stops: Sequence[str],
    costs: Mapping[tuple[str, str], float],
) -> HeldKarpResult:
    if not stops:
        return HeldKarpResult(True, (warehouse,))

    best_order: tuple[str, ...] = ()
    best_indices: tuple[int, ...] | None = None
    best_cost: float | None = None
    for indices in permutations(range(len(stops))):
        order = (warehouse, *(stops[index] for index in indices), warehouse)
        total = 0.0
        for source, target in pairwise(order):
            transition = costs.get((source, target))
            if transition is None:
                break
            total += transition
        else:
            if (
                best_cost is None
                or total < best_cost
                or (total == best_cost and best_indices is not None and indices < best_indices)
            ):
                best_order = order
                best_indices = indices
                best_cost = total

    if best_cost is None:
        return HeldKarpResult(False, ())
    return HeldKarpResult(True, best_order)


def test_held_karp_zero_stops() -> None:
    assert held_karp("W", [], {}) == HeldKarpResult(True, ("W",))


def test_held_karp_open_zero_stops() -> None:
    assert held_karp("W", [], {}, return_to_start=False) == HeldKarpResult(True, ("W",))


def test_held_karp_one_stop() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 2.5, ("A", "W"): 3.5})

    assert result == HeldKarpResult(True, ("W", "A", "W"))


def test_held_karp_open_one_stop_needs_only_outbound_cost() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 2.5}, return_to_start=False)

    assert result == HeldKarpResult(True, ("W", "A"))


def test_held_karp_three_stops() -> None:
    result = held_karp("W", ["A", "B", "C"], SAMPLE_COSTS)

    assert result == HeldKarpResult(True, ("W", "A", "B", "C", "W"))


def test_closing_the_tour_is_the_default() -> None:
    # `return_to_start` defaults to True, so an omitted flag must close the tour
    # on the warehouse rather than stop at the last stop.
    assert held_karp("W", ["A", "B", "C"], SAMPLE_COSTS) == HeldKarpResult(
        True, ("W", "A", "B", "C", "W")
    )


def test_held_karp_asymmetric_matrix() -> None:
    costs = {
        ("W", "A"): 1.0,
        ("A", "B"): 1.0,
        ("B", "W"): 1.0,
        ("W", "B"): 10.0,
        ("B", "A"): 10.0,
        ("A", "W"): 10.0,
    }

    assert held_karp("W", ["A", "B"], costs) == HeldKarpResult(True, ("W", "A", "B", "W"))


def test_held_karp_unreachable_pair_but_cycle_exists() -> None:
    costs = {("W", "A"): 1.0, ("A", "B"): 2.0, ("B", "W"): 3.0}

    assert held_karp("W", ["A", "B"], costs) == HeldKarpResult(True, ("W", "A", "B", "W"))


def test_held_karp_no_hamiltonian_cycle() -> None:
    result = held_karp("W", ["A", "B"], {("W", "A"): 1.0, ("A", "B"): 1.0})

    assert result == HeldKarpResult(False, ())


def test_held_karp_deterministic_tie_break() -> None:
    stops = ["B", "A", "C"]
    locations = ["W", *stops]
    costs = {
        (source, target): 1.0 for source in locations for target in locations if source != target
    }

    result = held_karp("W", stops, costs)

    assert result == HeldKarpResult(True, ("W", "B", "A", "C", "W"))


def test_open_held_karp_deterministic_tie_break() -> None:
    stops = ["B", "A", "C"]
    locations = ["W", *stops]
    costs = {
        (source, target): 1.0 for source in locations for target in locations if source != target
    }

    result = held_karp("W", stops, costs, return_to_start=False)

    assert result == HeldKarpResult(True, ("W", "B", "A", "C"))


@pytest.mark.parametrize(
    ("stops", "costs"),
    [
        (
            ["A", "B"],
            {
                ("W", "A"): 3.0,
                ("W", "B"): 1.0,
                ("A", "B"): 2.0,
                ("B", "A"): 4.0,
                ("A", "W"): 2.0,
                ("B", "W"): 3.0,
            },
        ),
        (["A", "B", "C"], SAMPLE_COSTS),
        (
            ["C", "A", "B"],
            {
                (source, target): 2.0
                for source in ("W", "C", "A", "B")
                for target in ("W", "C", "A", "B")
                if source != target
            },
        ),
    ],
)
def test_held_karp_matches_bruteforce(
    stops: list[str], costs: dict[tuple[str, str], float]
) -> None:
    assert held_karp("W", stops, costs) == _brute_force("W", stops, costs)


def test_held_karp_does_not_mutate_inputs() -> None:
    stops = ["A", "B", "C"]
    costs = dict(SAMPLE_COSTS)
    original_stops = list(stops)
    original_costs = dict(costs)

    held_karp("W", stops, costs, return_to_start=False)

    assert stops == original_stops
    assert costs == original_costs


def test_held_karp_rejects_warehouse_in_stops() -> None:
    with pytest.raises(ValueError, match="warehouse must not appear"):
        held_karp("W", ["A", "W"], {})


@pytest.mark.parametrize("value", [-1.0, math.nan, math.inf, -math.inf])
def test_held_karp_rejects_invalid_cost(value: float) -> None:
    # A nan loses every comparison in the recurrence and a negative cost makes a
    # longer tour look cheaper, so both are refused rather than propagated.
    costs = {("W", "A"): value, ("A", "W"): 1.0}

    with pytest.raises(ValueError, match="cost for"):
        held_karp("W", ["A"], costs)


def test_held_karp_ignores_invalid_cost_for_unrelated_locations() -> None:
    costs = {("W", "A"): 1.0, ("A", "W"): 1.0, ("X", "Y"): -1.0}

    assert held_karp("W", ["A"], costs).found is True


def test_held_karp_fails_when_return_to_warehouse_is_missing() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 1.0})

    assert result == HeldKarpResult(False, ())


def test_open_succeeds_when_return_to_warehouse_is_missing() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 1.0}, return_to_start=False)

    assert result == HeldKarpResult(True, ("W", "A"))


def test_open_fails_when_no_complete_path_exists() -> None:
    result = held_karp(
        "W",
        ["A", "B"],
        {("W", "A"): 1.0},
        return_to_start=False,
    )

    assert result == HeldKarpResult(False, ())


def test_held_karp_accepts_tuple_stops() -> None:
    result = held_karp("W", ("A",), {("W", "A"): 2.0, ("A", "W"): 3.0})

    assert result == HeldKarpResult(True, ("W", "A", "W"))


def _brute_force_open(
    warehouse: str,
    stops: Sequence[str],
    costs: Mapping[tuple[str, str], float],
    end: str | None = None,
) -> HeldKarpResult:
    """The cheapest open path by exhaustive search, optionally pinned to ``end``."""
    if not stops:
        return HeldKarpResult(True, (warehouse,))

    best_order: tuple[str, ...] = ()
    best_indices: tuple[int, ...] | None = None
    best_cost: float | None = None
    for indices in permutations(range(len(stops))):
        order = (warehouse, *(stops[index] for index in indices))
        if end is not None and order[-1] != end:
            continue
        total = 0.0
        for source, target in pairwise(order):
            transition = costs.get((source, target))
            if transition is None:
                break
            total += transition
        else:
            if (
                best_cost is None
                or total < best_cost
                or (total == best_cost and best_indices is not None and indices < best_indices)
            ):
                best_order = order
                best_indices = indices
                best_cost = total

    if best_cost is None:
        return HeldKarpResult(False, ())
    return HeldKarpResult(True, best_order)


@pytest.mark.parametrize("end", ["A", "B", "C"])
def test_end_matches_exhaustive_search_over_paths_that_finish_there(end: str) -> None:
    # The point of the parameter is that the answer stays *exactly* optimal over
    # the orders satisfying it, rather than becoming a heuristic once constrained.
    result = held_karp("W", ["A", "B", "C"], SAMPLE_COSTS, return_to_start=False, end=end)

    assert result == _brute_force_open("W", ["A", "B", "C"], SAMPLE_COSTS, end)
    assert result.order[-1] == end


def test_end_reorders_the_whole_path_not_just_its_tail() -> None:
    # Free, the cheapest open path is W-A-B-C. Requiring it to finish at A is not
    # that path with A moved to the end -- it is a different route through the
    # same stops, which is why this cannot be done by post-processing.
    free = held_karp("W", ["A", "B", "C"], SAMPLE_COSTS, return_to_start=False)
    pinned = held_karp("W", ["A", "B", "C"], SAMPLE_COSTS, return_to_start=False, end="A")

    assert free.order == ("W", "A", "B", "C")
    assert pinned.order == ("W", "C", "B", "A")


def test_end_agrees_with_free_choice_when_it_asks_for_the_same_stop() -> None:
    # Pinning the endpoint the free search would have chosen anyway must not
    # perturb the result: the constraint is inert, not merely cheap.
    free = held_karp("W", ["A", "B", "C"], SAMPLE_COSTS, return_to_start=False)
    pinned = held_karp(
        "W", ["A", "B", "C"], SAMPLE_COSTS, return_to_start=False, end=free.order[-1]
    )

    assert pinned == free


def test_end_reports_failure_rather_than_finishing_somewhere_else() -> None:
    # W-A-B is a complete open path, so an unpinned search succeeds here. Finishing
    # at A instead would need W-B-A, and there is no W->B transition. The pinned
    # search must therefore fail rather than quietly handing back W-A-B --
    # answering a different question is worse than answering none.
    costs = {("W", "A"): 1.0, ("A", "B"): 1.0}

    assert held_karp("W", ["A", "B"], costs, return_to_start=False).order == ("W", "A", "B")
    assert held_karp("W", ["A", "B"], costs, return_to_start=False, end="A") == HeldKarpResult(
        False, ()
    )


def test_end_on_the_only_stop_is_the_whole_path() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 2.5}, return_to_start=False, end="A")

    assert result == HeldKarpResult(True, ("W", "A"))


def test_end_is_refused_on_a_closed_tour() -> None:
    # A cycle has no last stop, so silently ignoring `end` here would hand back an
    # answer to a question the caller did not ask, indistinguishably.
    with pytest.raises(ValueError, match="cycle has no last stop"):
        held_karp("W", ["A", "B"], SAMPLE_COSTS, return_to_start=True, end="A")


def test_end_must_name_a_stop() -> None:
    with pytest.raises(ValueError, match="must be one of the stops"):
        held_karp("W", ["A", "B"], SAMPLE_COSTS, return_to_start=False, end="W")
