"""Greedy Best-First Search — all estimate, no accounting.

Greedy orders the frontier by ``h`` alone and never by ``g``, so it races at the
goal and expands very few states. What it gives up is the guarantee: having
ignored what the route has cost so far, it will commit to a direction that points
the right way and turns out long. Beside A* — same heuristic, same graph, one
extra term — it is the clearest demonstration of what that ``g`` term buys.

The true accumulated cost is still tracked in memory, so the route's reported
distance, time and cost are real. It is only the *ordering* that discards it.
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


def greedy_best_first_search(problem: SearchProblem) -> SearchLegResult:
    """Expand whichever open state the heuristic thinks is closest to the goal."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)

    frontier = PriorityQueue()
    frontier.push(memory.start_key, problem.heuristic(problem.start))

    while frontier:
        current = frontier.pop()
        # A cheaper route to `current` was found after this entry was queued, so
        # this one is stale — the fresh expansion already closed the state.
        if current in memory.closed:
            continue

        record_expansion(memory, current, problem.heuristic(memory.node_at[current]))
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        g = memory.cost[current]
        for edge, key in next_states(memory, current):
            candidate = g + problem.cost(edge)
            if key in memory.cost and candidate >= memory.cost[key]:
                continue
            remember(memory, key, current, edge, candidate)
            # The estimate alone. Adding `candidate` here would make this A*.
            frontier.push(key, problem.heuristic(memory.node_at[key]))

    return complete_leg(memory, None, started_at)
