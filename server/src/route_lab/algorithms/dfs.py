"""Depth-First Search for the route-planning graph.

DFS plunges down one branch to its end before backtracking. It is neither
shortest nor cheapest; it is here to show how much worse an uninformed order can
be.

Recipe (follow ``ucs.py`` for the surrounding shape):
* Frontier: :class:`route_lab.shared.frontier.Stack` (LIFO) — the most recently
  discovered state is expanded next.
* Cost: as with BFS, count hops (``memory.cost[current] + 1``); DFS does not
  minimise it, but the harness still wants a ``g`` for the trace.
* Successor rule: skip any ``key`` already in ``memory.cost``.
* Do NOT pass a heuristic to ``record_expansion`` — DFS is blind.

"""

from __future__ import annotations

from time import perf_counter

from route_lab.shared.frontier import Stack
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import (
    SearchLegResult,
    complete_leg,
    create_search_memory,
    next_states,
    record_expansion,
    remember,
)


def depth_first_search(problem: SearchProblem) -> SearchLegResult:
    """Return the first route found by following the newest branch first."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)

    frontier = Stack()
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
