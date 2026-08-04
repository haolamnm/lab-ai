"""Breadth-First Search for the route-planning graph.

BFS returns the route with the fewest road segments, ignoring cost entirely.

Recipe (follow ``ucs.py`` for the surrounding shape):
* Frontier: :class:`route_lab.shared.frontier.Queue` (FIFO) — first seen, first
  expanded, which is what makes the first path to the goal the shortest in hops.
* Cost: count hops, i.e. push each successor at ``memory.cost[current] + 1``.
* Successor rule: a state seen once is never improved, so skip any ``key`` already
  in ``memory.cost``.
* Do NOT pass a heuristic to ``record_expansion`` — BFS is blind.

"""

from __future__ import annotations

from time import perf_counter

from route_lab.shared.frontier import Queue
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import (
    SearchLegResult,
    complete_leg,
    create_search_memory,
    next_states,
    record_expansion,
    remember,
)


def breadth_first_search(problem: SearchProblem) -> SearchLegResult:
    """Return a fewest-road-segments route using a FIFO frontier."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)

    frontier = Queue()
    frontier.push(memory.start_key)

    while frontier:
        current = frontier.pop()
        if current in memory.closed:
            continue

        record_expansion(memory, current)
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        for edge, key in next_states(memory, current):
            if key in memory.cost:
                continue
            remember(memory, key, current, edge, memory.cost[current] + 1)
            frontier.push(key)

    return complete_leg(memory, None, started_at)
