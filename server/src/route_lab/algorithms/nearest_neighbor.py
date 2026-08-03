"""Nearest Neighbor stop ordering.

This is a multi-stop heuristic, not a point-to-point path search. At each step it
chooses the unvisited stop with the lowest exact, traffic-aware UCS cost from the
current stop. The planner then uses UCS to build and visualize each selected leg.

The next choice is locally cheapest, but the complete multi-stop route is not
guaranteed to be globally optimal.
"""

from __future__ import annotations

from collections.abc import Collection

from route_lab.contract.conditions import Conditions
from route_lab.shared.graph import Graph
from route_lab.shared.heap import Heap
from route_lab.shared.search import create_search_memory, next_states, pop_fresh, remember
from route_lab.shared.traffic import edge_cost


def _costs_to_targets(
    graph: Graph,
    start: str,
    targets: Collection[str],
    conditions: Conditions,
) -> dict[str, float]:
    """Settle one UCS sweep and return the cheapest cost to reachable targets."""
    unsettled = set(targets)
    if not unsettled:
        return {}

    costs: dict[str, float] = {}
    memory = create_search_memory(graph, start, conditions)
    frontier = Heap()
    frontier.push(memory.start_key, priority=0.0, cost=0.0)

    current = pop_fresh(frontier, memory)
    while current is not None:
        memory.closed.add(current)
        node = memory.node_at[current]

        if node in unsettled:
            costs[node] = memory.cost[current]
            unsettled.remove(node)
            if not unsettled:
                break

        current_cost = memory.cost[current]
        for edge, successor in next_states(memory, current):
            candidate_cost = current_cost + edge_cost(edge, conditions)
            known_cost = memory.cost.get(successor)
            if known_cost is not None and candidate_cost >= known_cost:
                continue

            remember(memory, successor, current, edge, candidate_cost)
            frontier.push(successor, priority=candidate_cost, cost=candidate_cost)

        current = pop_fresh(frontier, memory)

    return costs


def nearest_neighbor_order(
    graph: Graph,
    start: str,
    stops: list[str],
    conditions: Conditions,
) -> list[str]:
    """Order stops by repeatedly choosing the cheapest reachable next stop.

    Equal-cost stops retain their request order. Unreachable stops are retained
    at the end so the planner can report the blocked leg instead of silently
    dropping a requested destination.
    """
    remaining = list(stops)
    ordered: list[str] = []
    current = start

    while remaining:
        costs = _costs_to_targets(graph, current, remaining, conditions)
        reachable = [(costs[stop], index) for index, stop in enumerate(remaining) if stop in costs]
        if not reachable:
            ordered.extend(remaining)
            break

        _, nearest_index = min(reachable)
        current = remaining.pop(nearest_index)
        ordered.append(current)

    return ordered
