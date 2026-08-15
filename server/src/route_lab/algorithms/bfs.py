"""Breadth-First Search — the fewest-segment route, blind to cost.

BFS is the control in this comparison. It ignores distance, time, congestion and
risk entirely, so what it returns is the route with the fewest road segments
rather than the cheapest — on a network where one long highway replaces six short
streets that is exactly the wrong answer, and seeing it beside UCS is the point.

Only the frontier differs from ``ucs.py``: a FIFO :class:`Queue` expands states
in the order they were discovered, which is what makes the first arrival at the
goal the shallowest one.
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
    """Expand in discovery order; the first route to the goal has the fewest hops."""
    started_at = perf_counter()
    memory = create_search_memory(
        problem.graph, problem.start, problem.conditions, problem.incoming
    )

    frontier = Queue()
    frontier.push(memory.start_key)

    while frontier:
        current = frontier.pop()

        record_expansion(memory, current)
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        # Depth in hops, not cost. The trace wants a `g` for every expansion, and
        # this is the quantity BFS actually minimises, so it is the honest one to
        # show: a pane playing BFS back watches g climb 1, 2, 3 by ring.
        depth = memory.cost[current] + 1

        for edge, key in next_states(memory, current):
            # A state seen once is never improved on: every edge costs one hop, so
            # the first arrival is already the shallowest. `remember` records the
            # state at push time, which is also why — unlike UCS — no stale
            # frontier entry can exist here and none has to be skipped on pop.
            if key in memory.cost:
                continue
            remember(memory, key, current, edge, depth)
            frontier.push(key)

    return complete_leg(memory, None, started_at)
