"""Traffic-aware stop ordering — the port of the nearest-neighbour helpers in
web/src/lib/search.ts.

Used both by the selectable ``nearest`` algorithm and by the planner's
"optimise visit order" option. Every choice picks the unvisited stop with the
lowest exact UCS route cost from the current location, so the decision is locally
cheapest; the full order stays a heuristic with no global optimality guarantee
(solving it exactly is the travelling-salesman problem, out of scope).
"""

from __future__ import annotations

from collections.abc import Collection

from route_lab.contract.conditions import Conditions
from route_lab.shared.graph import Graph
from route_lab.shared.heap import Heap
from route_lab.shared.search import (
    create_search_memory,
    next_states,
    pop_fresh,
    remember,
)
from route_lab.shared.traffic import edge_cost


def ucs_cost_to_targets(
    graph: Graph, start: str, targets: Collection[str], conditions: Conditions
) -> dict[str, float]:
    """One UCS sweep giving the exact cost from ``start`` to each target.

    Stops as soon as every target is settled. No trace is recorded — this feeds
    stop ordering, not a pane's timeline.
    """
    result: dict[str, float] = {}
    if not targets:
        return result

    remaining = set(targets)
    memory = create_search_memory(graph, start, conditions)
    frontier = Heap()
    frontier.push(memory.start_key, 0.0, 0.0)

    current = pop_fresh(frontier, memory)
    while current is not None:
        memory.closed.add(current)
        at = memory.node_at[current]
        if at in remaining and at not in result:
            result[at] = memory.cost[current]
            if len(result) == len(remaining):
                break

        for edge, key in next_states(memory, current):
            candidate = memory.cost[current] + edge_cost(edge, conditions)
            if key in memory.cost and candidate >= memory.cost[key]:
                continue
            remember(memory, key, current, edge, candidate)
            frontier.push(key, candidate, candidate)

        current = pop_fresh(frontier, memory)
    return result


def nearest_neighbor_order(
    graph: Graph, start: str, stops: list[str], conditions: Conditions
) -> list[str]:
    """A nearest-neighbour visit order over ``stops``, measured in real UCS cost."""
    remaining = list(stops)
    order: list[str] = []
    current = start

    while remaining:
        costs = ucs_cost_to_targets(graph, current, remaining, conditions)
        nearest_index = -1
        nearest_cost = float("inf")
        for index, stop in enumerate(remaining):
            cost = costs.get(stop, float("inf"))
            if cost < nearest_cost:
                nearest_cost = cost
                nearest_index = index

        # Keep unreachable stops in the request so the leg planner can explain the
        # failure rather than silently dropping a location the user asked for.
        if nearest_index < 0:
            order.extend(remaining)
            break
        current = remaining[nearest_index]
        order.append(current)
        remaining.pop(nearest_index)
    return order
