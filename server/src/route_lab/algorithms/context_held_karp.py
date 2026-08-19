"""Exact Held–Karp over trip locations and incoming-road contexts.

This optimiser is used only when the road graph carries turn restrictions.  Its
state retains the incoming OpenStreetMap way at the last trip location, and its
transition provider lazily supplies the cheapest road route for every distinct
arrival way at the next location.  The ordinary scalar Held–Karp implementation
remains separate and is still the fast path for context-independent graphs.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

from route_lab.algorithms.destination_labels import (
    ContextRouteKey,
    DestinationLabel,
    IncomingWay,
)


@dataclass(frozen=True)
class ContextState:
    mask: int
    last_index: int
    incoming_way: IncomingWay


@dataclass(frozen=True)
class ContextParent:
    previous: ContextState | None
    route_key: ContextRouteKey


@dataclass(frozen=True)
class ContextHeldKarpResult:
    found: bool
    order: tuple[str, ...]
    route_keys: tuple[ContextRouteKey, ...]
    cost: float | None
    state_count: int


class TransitionProvider(Protocol):
    def transitions(
        self, source: str, incoming_way: IncomingWay, target: str
    ) -> Mapping[IncomingWay, DestinationLabel]: ...


def _way_key(way: IncomingWay) -> tuple[int, int]:
    return (0, 0) if way is None else (1, way)


def context_held_karp(
    warehouse: str,
    stops: Sequence[str],
    transitions: TransitionProvider,
    *,
    return_to_start: bool = True,
    end: str | None = None,
) -> ContextHeldKarpResult:
    """Find an exact open path or closed tour while preserving arrival ways."""

    stop_ids = tuple(stops)
    if len(set(stop_ids)) != len(stop_ids):
        raise ValueError("stops must be distinct")
    if warehouse in stop_ids:
        raise ValueError("warehouse must not appear in stops")
    if end is not None:
        if return_to_start:
            raise ValueError("end is meaningless on a closed tour; a cycle has no last stop")
        if end not in stop_ids:
            raise ValueError(f"end {end!r} must be one of the stops")
    if not stop_ids:
        return ContextHeldKarpResult(True, (warehouse,), (), 0.0, 0)

    stop_count = len(stop_ids)
    full_mask = (1 << stop_count) - 1
    base = stop_count + 1
    dp: dict[ContextState, float] = {}
    parent: dict[ContextState, ContextParent] = {}
    lex_key: dict[ContextState, int] = {}

    for index, stop in enumerate(stop_ids):
        labels = transitions.transitions(warehouse, None, stop)
        for incoming_way, label in labels.items():
            state = ContextState(1 << index, index, incoming_way)
            route_key = ContextRouteKey(warehouse, None, stop, incoming_way)
            known = dp.get(state)
            if known is not None and label.cost >= known:
                continue
            dp[state] = label.cost
            parent[state] = ContextParent(None, route_key)
            lex_key[state] = index + 1

    for mask in range(1, full_mask + 1):
        states = sorted(
            (state for state in dp if state.mask == mask),
            key=lambda state: (state.last_index, _way_key(state.incoming_way)),
        )
        for state in states:
            current_cost = dp[state]
            source = stop_ids[state.last_index]
            for next_index, target in enumerate(stop_ids):
                bit = 1 << next_index
                if mask & bit:
                    continue
                labels = transitions.transitions(source, state.incoming_way, target)
                for next_way, label in labels.items():
                    next_state = ContextState(mask | bit, next_index, next_way)
                    candidate_cost = current_cost + label.cost
                    candidate_lex = lex_key[state] * base + next_index + 1
                    known_cost = dp.get(next_state)
                    if known_cost is not None and (
                        candidate_cost > known_cost
                        or (candidate_cost == known_cost and candidate_lex >= lex_key[next_state])
                    ):
                        continue
                    dp[next_state] = candidate_cost
                    parent[next_state] = ContextParent(
                        state,
                        ContextRouteKey(source, state.incoming_way, target, next_way),
                    )
                    lex_key[next_state] = candidate_lex

    final_states = [state for state in dp if state.mask == full_mask]
    if end is not None:
        end_index = stop_ids.index(end)
        final_states = [state for state in final_states if state.last_index == end_index]

    best_state: ContextState | None = None
    best_return: ContextRouteKey | None = None
    best_rank: tuple[float, int, int, tuple[int, int], tuple[int, int]] | None = None
    best_cost: float | None = None
    for state in sorted(
        final_states,
        key=lambda item: (item.last_index, _way_key(item.incoming_way)),
    ):
        if return_to_start:
            labels = transitions.transitions(
                stop_ids[state.last_index], state.incoming_way, warehouse
            )
            for warehouse_way, label in labels.items():
                total = dp[state] + label.cost
                rank = (
                    total,
                    lex_key[state],
                    state.last_index,
                    _way_key(state.incoming_way),
                    _way_key(warehouse_way),
                )
                if best_rank is None or rank < best_rank:
                    best_rank = rank
                    best_cost = total
                    best_state = state
                    best_return = ContextRouteKey(
                        stop_ids[state.last_index],
                        state.incoming_way,
                        warehouse,
                        warehouse_way,
                    )
        else:
            rank = (
                dp[state],
                lex_key[state],
                state.last_index,
                _way_key(state.incoming_way),
                (0, 0),
            )
            if best_rank is None or rank < best_rank:
                best_rank = rank
                best_cost = dp[state]
                best_state = state
                best_return = None

    if best_state is None or best_cost is None:
        return ContextHeldKarpResult(False, (), (), None, len(dp))

    reversed_keys: list[ContextRouteKey] = []
    state: ContextState | None = best_state
    while state is not None:
        link = parent[state]
        reversed_keys.append(link.route_key)
        state = link.previous
    reversed_keys.reverse()
    if best_return is not None:
        reversed_keys.append(best_return)

    route_keys = tuple(reversed_keys)
    order = (warehouse, *(key.target for key in route_keys))
    return ContextHeldKarpResult(True, order, route_keys, best_cost, len(dp))
