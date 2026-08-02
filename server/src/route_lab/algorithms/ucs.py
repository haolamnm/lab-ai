"""Uniform Cost Search — the worked reference every other algorithm copies.

This is the whole pattern in one file. Read it before writing a stub:

1.  Start the clock and build a :class:`SearchMemory` from the problem.
2.  Pick a frontier. UCS orders by ``g`` (cost so far), so a ``PriorityQueue``.
3.  Loop: pop the next state; skip it if it is already closed (a stale entry left
    behind by an improvement); otherwise :func:`record_expansion` and test the
    goal.
4.  For each :func:`next_states` successor, compute its cost with
    ``problem.cost``; if that beats the best known cost, :func:`remember` it and
    push it onto the frontier.
5.  Return :func:`complete_leg` — with the goal state on success, or ``None`` when
    the frontier empties without reaching it.

To write A*, change one line: push with ``candidate + problem.heuristic(...)``
and pass that estimate to ``record_expansion``. Greedy pushes with the heuristic
alone. BFS/DFS swap the ``PriorityQueue`` for a ``Queue``/``Stack`` and count
cost in hops. That is the entire difference between the algorithms.
"""

from __future__ import annotations

from time import perf_counter

from route_lab.shared.frontier import PriorityQueue
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import (
    SearchLegResult,
    complete_leg,
    create_search_memory,
    next_states,
    record_expansion,
    remember,
)


def uniform_cost_search(problem: SearchProblem) -> SearchLegResult:
    """Expand states cheapest-first; the first time the goal is popped is optimal."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)

    frontier = PriorityQueue()
    frontier.push(memory.start_key, 0.0)

    while frontier:
        current = frontier.pop()
        # A cheaper route to `current` was found after this entry was queued, so
        # this one is stale — the fresh expansion already closed the state.
        if current in memory.closed:
            continue

        record_expansion(memory, current)
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        g = memory.cost[current]
        for edge, key in next_states(memory, current):
            candidate = g + problem.cost(edge)
            if key in memory.cost and candidate >= memory.cost[key]:
                continue
            remember(memory, key, current, edge, candidate)
            frontier.push(key, candidate)

    return complete_leg(memory, None, started_at)
