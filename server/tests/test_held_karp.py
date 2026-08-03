"""Pure Held–Karp DP over deterministic directed cost mappings."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from itertools import pairwise, permutations
from typing import cast

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
        return HeldKarpResult(True, (warehouse,), 0.0)

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
        return HeldKarpResult(False, (), None)
    return HeldKarpResult(True, best_order, best_cost)


def test_held_karp_zero_stops() -> None:
    assert held_karp("W", [], {}) == HeldKarpResult(True, ("W",), 0.0)


def test_held_karp_one_stop() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 2.5, ("A", "W"): 3.5})

    assert result == HeldKarpResult(True, ("W", "A", "W"), 6.0)


def test_held_karp_three_stops() -> None:
    result = held_karp("W", ["A", "B", "C"], SAMPLE_COSTS)

    assert result == HeldKarpResult(True, ("W", "A", "B", "C", "W"), 12.0)


def test_held_karp_asymmetric_matrix() -> None:
    costs = {
        ("W", "A"): 1.0,
        ("A", "B"): 1.0,
        ("B", "W"): 1.0,
        ("W", "B"): 10.0,
        ("B", "A"): 10.0,
        ("A", "W"): 10.0,
    }

    assert held_karp("W", ["A", "B"], costs) == HeldKarpResult(True, ("W", "A", "B", "W"), 3.0)


def test_held_karp_unreachable_pair_but_cycle_exists() -> None:
    costs = {("W", "A"): 1.0, ("A", "B"): 2.0, ("B", "W"): 3.0}

    assert held_karp("W", ["A", "B"], costs) == HeldKarpResult(True, ("W", "A", "B", "W"), 6.0)


def test_held_karp_no_hamiltonian_cycle() -> None:
    result = held_karp("W", ["A", "B"], {("W", "A"): 1.0, ("A", "B"): 1.0})

    assert result == HeldKarpResult(False, (), None)


def test_held_karp_deterministic_tie_break() -> None:
    stops = ["B", "A", "C"]
    locations = ["W", *stops]
    costs = {
        (source, target): 1.0 for source in locations for target in locations if source != target
    }

    result = held_karp("W", stops, costs)

    assert result == HeldKarpResult(True, ("W", "B", "A", "C", "W"), 4.0)


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

    held_karp("W", stops, costs)

    assert stops == original_stops
    assert costs == original_costs


def test_held_karp_rejects_duplicate_stops() -> None:
    with pytest.raises(ValueError, match="duplicate stop"):
        held_karp("W", ["A", "A"], {})


def test_held_karp_rejects_warehouse_in_stops() -> None:
    with pytest.raises(ValueError, match="warehouse must not appear"):
        held_karp("W", ["A", "W"], {})


@pytest.mark.parametrize("value", [-1.0, math.nan, math.inf, -math.inf, "invalid", True])
def test_held_karp_rejects_invalid_cost(value: object) -> None:
    costs: dict[tuple[str, str], float] = {
        ("W", "A"): cast(float, value),
        ("A", "W"): 1.0,
    }

    with pytest.raises(ValueError, match="cost for"):
        held_karp("W", ["A"], costs)


def test_held_karp_ignores_invalid_cost_for_unrelated_locations() -> None:
    costs: dict[tuple[str, str], float] = {
        ("W", "A"): 1.0,
        ("A", "W"): 1.0,
        ("X", "Y"): cast(float, "invalid"),
    }

    assert held_karp("W", ["A"], costs).found is True


def test_held_karp_fails_when_return_to_warehouse_is_missing() -> None:
    result = held_karp("W", ["A"], {("W", "A"): 1.0})

    assert result == HeldKarpResult(False, (), None)


def test_held_karp_accepts_tuple_stops() -> None:
    result = held_karp("W", ("A",), {("W", "A"): 2.0, ("A", "W"): 3.0})

    assert result == HeldKarpResult(True, ("W", "A", "W"), 5.0)
