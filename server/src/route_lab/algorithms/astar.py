"""A* graph search over the backend's shared state and result harness.

The route cost remains the accumulated edge cost ``g``. The heuristic is used
only to order the frontier by ``f = g + h`` and to enrich expansion traces.
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


def a_star_search(problem: SearchProblem) -> SearchLegResult:
    """Return a minimum-cost leg when ``problem.heuristic`` is admissible."""
    started_at = perf_counter()
    memory = create_search_memory(problem.graph, problem.start, problem.conditions)

    # Heap entries retain both f (ordering) and g (freshness), so a superseded
    # entry can never expand using a newer g-score that did not create it.
    frontier = Heap()
    frontier.push(memory.start_key, problem.heuristic(problem.start), 0.0)

    while (current := pop_fresh(frontier, memory)) is not None:
        current_h = problem.heuristic(memory.node_at[current])
        record_expansion(memory, current, current_h)
        if memory.node_at[current] == problem.goal:
            return complete_leg(memory, current, started_at)

        g = memory.cost[current]
        for edge, key in next_states(memory, current, include_closed=True):
            candidate_g = g + problem.cost(edge)
            if key in memory.cost and candidate_g >= memory.cost[key]:
                continue

            # Reopening is necessary for admissible but inconsistent heuristics.
            # `remember` then restores the state to the ordered open-set view.
            memory.closed.discard(key)
            remember(memory, key, current, edge, candidate_g)
            priority = candidate_g + problem.heuristic(memory.node_at[key])
            frontier.push(key, priority, candidate_g)

    return complete_leg(memory, None, started_at)
