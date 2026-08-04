"""Depth-First Search — one branch to its end before anything else is tried.

DFS is neither shortest nor cheapest. It is in the grid to show how much worse an
uninformed expansion order can be: on a road network it commits to whichever
street it happened to discover last and follows it away from the goal for as long
as that street continues.

The only difference from ``bfs.py`` is one line — a LIFO :class:`Stack` in place
of the FIFO :class:`Queue`. That single swap is the whole distance between the
best uninformed route and one of the worst, which is easier to believe when the
two files are otherwise identical.
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
    """Expand the most recently discovered state; backtrack only when it dead-ends."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)

    frontier = Stack()
    frontier.push(memory.start_key)

    while frontier:
        current = frontier.pop()

        record_expansion(memory, current)
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        # DFS minimises nothing, but the trace still wants a `g` per expansion,
        # and depth in hops is the one number that describes where the search is.
        depth = memory.cost[current] + 1

        for edge, key in next_states(memory, current):
            # As in BFS, a state is recorded the moment it is pushed, so it is
            # never queued twice and no stale entry survives to be popped.
            if key in memory.cost:
                continue
            remember(memory, key, current, edge, depth)
            frontier.push(key)

    return complete_leg(memory, None, started_at)
