"""Pure Held–Karp dynamic programming for directed open paths and closed tours.

This trip-level algorithm is intentionally independent of the road-search stack.
It consumes already-computed pair costs and orders stops; it does not build a
graph, route a leg, or belong to ``POINT_SEARCHES``.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class HeldKarpResult:
    """The optimal visit order for the requested mode, or a finite failure result."""

    found: bool
    order: tuple[str, ...]
    cost: float | None


def _validated_cost(value: object, source: str, target: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"cost for {source!r} -> {target!r} must be numeric")
    numeric = float(value)
    if not math.isfinite(numeric) or numeric < 0:
        raise ValueError(f"cost for {source!r} -> {target!r} must be finite and non-negative")
    return numeric


def held_karp(
    warehouse: str,
    stops: Sequence[str],
    costs: Mapping[tuple[str, str], float],
    *,
    return_to_start: bool = True,
) -> HeldKarpResult:
    """Find a minimum-cost directed path or cycle through every stop exactly once.

    ``costs`` is a directed mapping: a missing ``(u, v)`` transition is
    unreachable and no reverse edge is inferred. The warehouse is excluded from
    the bitmask. For stop index ``last``, ``dp[(mask, last)]`` is the cheapest
    cost from the warehouse that visits exactly ``mask`` and ends at ``last``.
    A parent table reconstructs the result without storing paths per state. The
    DP recurrence is shared: closed mode adds the final directed return cost,
    while open mode stops at the best full-mask state.

    Equal-cost tours are resolved lexicographically by stop index, hence by the
    order supplied in ``stops``. The algorithm runs in ``O(n² * 2ⁿ)`` time and
    ``O(n * 2ⁿ)`` space for ``n`` stops.

    Args:
        warehouse: Start location, and end location when closing the tour.
        stops: Ordered location identifiers to visit exactly once.
        costs: Finite, non-negative costs for available directed transitions.
        return_to_start: Whether to close the route at ``warehouse``.

    Returns:
        The optimal full path or cycle and its cost, or ``found=False`` when no
        complete route exists.

    Raises:
        ValueError: If stops are duplicated, include the warehouse, or a relevant
        transition has a non-numeric, non-finite, or negative cost.
    """
    stop_ids = tuple(stops)
    seen = {warehouse}
    for stop in stop_ids:
        if stop == warehouse:
            raise ValueError("warehouse must not appear in stops")
        if stop in seen:
            raise ValueError(f"duplicate stop: {stop}")
        seen.add(stop)

    if not stop_ids:
        return HeldKarpResult(found=True, order=(warehouse,), cost=0.0)

    locations = (warehouse, *stop_ids)
    raw_costs: Mapping[tuple[str, str], object] = costs
    available: dict[tuple[str, str], float] = {}
    for source in locations:
        for target in locations:
            if source == target or (source, target) not in raw_costs:
                continue
            value = raw_costs[(source, target)]
            available[(source, target)] = _validated_cost(value, source, target)

    stop_count = len(stop_ids)
    full_mask = (1 << stop_count) - 1
    base = stop_count + 1
    dp: dict[tuple[int, int], float] = {}
    parent: dict[tuple[int, int], int | None] = {}
    # A base-(n+1) scalar encodes the stop-index prefix for deterministic ties.
    # It is not used for reconstruction; the parent table remains authoritative.
    lex_key: dict[tuple[int, int], int] = {}

    for index, stop in enumerate(stop_ids):
        initial = available.get((warehouse, stop))
        if initial is None:
            continue
        state = (1 << index, index)
        dp[state] = initial
        parent[state] = None
        lex_key[state] = index + 1

    for mask in range(1, full_mask + 1):
        for last in range(stop_count):
            state = (mask, last)
            current_cost = dp.get(state)
            if current_cost is None:
                continue

            for next_index in range(stop_count):
                next_bit = 1 << next_index
                if mask & next_bit:
                    continue
                transition = available.get((stop_ids[last], stop_ids[next_index]))
                if transition is None:
                    continue

                next_state = (mask | next_bit, next_index)
                candidate_cost = current_cost + transition
                candidate_lex = lex_key[state] * base + next_index + 1
                known_cost = dp.get(next_state)
                if known_cost is not None and (
                    candidate_cost > known_cost
                    or (candidate_cost == known_cost and candidate_lex >= lex_key[next_state])
                ):
                    continue

                dp[next_state] = candidate_cost
                parent[next_state] = last
                lex_key[next_state] = candidate_lex

    best_last: int | None = None
    best_cost: float | None = None
    best_lex: int | None = None
    for last in range(stop_count):
        state = (full_mask, last)
        route_cost = dp.get(state)
        if route_cost is None:
            continue
        if return_to_start:
            return_cost = available.get((stop_ids[last], warehouse))
            if return_cost is None:
                continue
            total = route_cost + return_cost
        else:
            total = route_cost
        state_lex = lex_key[state]
        if best_cost is not None and (
            total > best_cost
            or (total == best_cost and best_lex is not None and state_lex >= best_lex)
        ):
            continue
        best_last = last
        best_cost = total
        best_lex = state_lex

    if best_last is None or best_cost is None:
        return HeldKarpResult(found=False, order=(), cost=None)

    reverse_indices: list[int] = []
    mask = full_mask
    last = best_last
    while True:
        reverse_indices.append(last)
        previous = parent[(mask, last)]
        if previous is None:
            break
        mask ^= 1 << last
        last = previous
    reverse_indices.reverse()

    ordered_stops = tuple(stop_ids[index] for index in reverse_indices)
    order = (
        (warehouse, *ordered_stops, warehouse) if return_to_start else (warehouse, *ordered_stops)
    )
    return HeldKarpResult(found=True, order=order, cost=best_cost)
