"""One best-first search that answers for a whole set of goals at once.

A greedy trip planner asks the same question at every step: *which of the
remaining destinations is nearest, and by what route?* Answering it with one
search per candidate repeats the shared work around the origin once per
candidate and then discards every losing trace. This loop expands a single
frontier instead, so a greedy pass costs one search per step rather than one per
remaining destination — and because the step's only search is the leg the
planner keeps, ``ms`` and the effort counters describe the same work.

The loop is the frontier and the priority, nothing else. Run it ``guided`` and it
is A* over a goal set; run it blind and it is UCS over a goal set.
``nearest_neighbor.py`` and ``ucs.py`` each expose it under their own name;
:func:`route_lab.algorithms.astar.a_star_search` and
:func:`route_lab.algorithms.ucs.uniform_cost_search` are untouched.
"""

from __future__ import annotations

from collections.abc import Sequence
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


def multi_goal_search(
    problem: SearchProblem,
    goals: Sequence[str],
    *,
    guided: bool,
) -> SearchLegResult:
    """Return the cheapest reachable member of ``goals`` through one search.

    ``goals`` is the goal set; ``problem.goal`` is never read. When ``guided`` is
    false the bound is zero and the trace records ``h: null``, so a blind step
    draws exactly like the single-goal UCS beside it in the timeline.

    A guided ``problem.heuristic`` must be *consistent*, not merely admissible:
    this loop never reopens a closed state, which is what keeps it identical to
    the browser's ``multiGoalSearch``. NN's bound qualifies — it is the minimum
    of ``scale``-Lipschitz haversine terms over a graph where every passable edge
    satisfies ``cost(e) >= scale * straight(e)``, and the minimum of functions
    sharing a Lipschitz constant keeps it.

    Equal-cost goals retain their order in ``goals``. The search therefore keeps
    settling states with ``f <= best_cost`` after finding a goal; consistency
    guarantees that no unexpanded equal-or-cheaper goal can sit above that bound.
    """
    started_at = perf_counter()
    memory = create_search_memory(
        problem.graph,
        problem.start,
        problem.conditions,
        problem.incoming,
    )
    goal_rank = {goal: rank for rank, goal in enumerate(dict.fromkeys(goals))}
    if not goal_rank:
        return complete_leg(memory, None, started_at)

    def estimate(node: str) -> float:
        return problem.heuristic(node) if guided else 0.0

    frontier = Heap()
    frontier.push(memory.start_key, estimate(problem.start), 0.0)
    best_key: str | None = None
    best_cost = float("inf")
    best_rank = len(goal_rank)

    while (current := pop_fresh(frontier, memory)) is not None:
        current_node = memory.node_at[current]
        current_h = estimate(current_node)
        current_cost = memory.cost[current]
        if best_key is not None and current_cost + current_h > best_cost:
            break

        record_expansion(memory, current, current_h if guided else None)
        rank = goal_rank.get(current_node)
        if rank is not None and (
            current_cost < best_cost or (current_cost == best_cost and rank < best_rank)
        ):
            best_key = current
            best_cost = current_cost
            best_rank = rank

        # A zero-cost edge may connect two equal-cost goals, so goal states still
        # expand until the f-bound above proves that tie resolution is complete.
        for edge, key in next_states(memory, current):
            candidate_cost = current_cost + problem.cost(edge)
            if key in memory.cost and candidate_cost >= memory.cost[key]:
                continue
            remember(memory, key, current, edge, candidate_cost)
            priority = candidate_cost + estimate(memory.node_at[key])
            frontier.push(key, priority, candidate_cost)

    return complete_leg(memory, best_key, started_at)
