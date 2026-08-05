"""Uniform Cost Search for one route leg.

UCS expands the state with the lowest accumulated cost first. Because Route Lab's
edge costs are non-negative, the first settled state at the goal is an optimal
path for the configured distance, time, congestion, and risk weights.

It is also the whole pattern in one file. Read it before writing a new algorithm:

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
and pass that estimate to ``record_expansion``. BFS/DFS swap the
``PriorityQueue`` for a ``Queue``/``Stack`` and count cost in hops. That is the
entire difference between the algorithms.
"""

from __future__ import annotations

from time import perf_counter

from route_lab.shared.heap import Heap
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import (
    SearchLegResult,
    complete_leg,
    create_search_memory,
    next_states,
    pop_fresh,
    record_expansion,
    remember,
)


def uniform_cost_search(problem: SearchProblem) -> SearchLegResult:
    """Return the cheapest reachable path from ``problem.start`` to its goal."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)
    frontier = Heap()
    frontier.push(memory.start_key, priority=0.0, cost=0.0)

    current = pop_fresh(frontier, memory)
    while current is not None:
        record_expansion(memory, current)
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        current_cost = memory.cost[current]
        for edge, successor in next_states(memory, current):
            candidate_cost = current_cost + problem.cost(edge)
            known_cost = memory.cost.get(successor)
            if known_cost is not None and candidate_cost >= known_cost:
                continue

            remember(memory, successor, current, edge, candidate_cost)
            frontier.push(successor, priority=candidate_cost, cost=candidate_cost)

        current = pop_fresh(frontier, memory)

    return complete_leg(memory, None, started_at)
