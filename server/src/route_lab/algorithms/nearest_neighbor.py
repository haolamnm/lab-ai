"""Pure Nearest Neighbor ordering over directed pairwise costs.

This trip-level heuristic chooses the cheapest reachable unvisited stop from
the current location. It only orders location identifiers; graph search and
route-leg assembly belong to the planner and Pairwise search layer.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence


def nearest_neighbor_order(
    start: str,
    stops: Sequence[str],
    costs: Mapping[tuple[str, str], float],
) -> tuple[str, ...]:
    """Return stops in deterministic directed-cost greedy order.

    Missing ``(current, stop)`` entries are unreachable. If no remaining stop
    is reachable, all remaining stops are appended in their current input order
    so no requested destination is silently dropped. Equal-cost candidates are
    resolved by their order in ``stops``. Inputs are never mutated.
    """
    remaining = list(stops)
    ordered: list[str] = []
    current = start

    while remaining:
        nearest_index: int | None = None
        nearest_cost: float | None = None

        for index, stop in enumerate(remaining):
            candidate_cost = costs.get((current, stop))
            if candidate_cost is None:
                continue
            if nearest_cost is None or candidate_cost < nearest_cost:
                nearest_index = index
                nearest_cost = candidate_cost

        if nearest_index is None:
            ordered.extend(remaining)
            break

        current = remaining.pop(nearest_index)
        ordered.append(current)

    return tuple(ordered)
