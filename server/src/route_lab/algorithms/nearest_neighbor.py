"""Nearest Neighbor helpers.

The planner implements the greedy loop because it owns trip assembly.  This
module owns the two pieces that make that loop *Nearest Neighbor backed by A**:
the deterministic nearest-candidate choice and NN's own admissible ``h(n)``.
The A* implementation itself remains generic and unchanged.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from route_lab.algorithms.multi_goal import multi_goal_search
from route_lab.contract.conditions import Conditions
from route_lab.shared.geo import haversine
from route_lab.shared.graph import Graph
from route_lab.shared.heuristics import Heuristic
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult
from route_lab.shared.traffic import edge_cost, passable


def nearest_neighbor_heuristic_scale(graph: Graph, conditions: Conditions) -> float:
    """Return the largest safe straight-line cost scale for NN's A* searches.

    For every passable edge ``e`` we require
    ``cost(e) >= scale * straight_distance(e.from, e.to)``.  Taking the minimum
    ratio makes that true for every edge; the triangle inequality then makes
    ``h(n) = scale * haversine(n, goal)`` admissible for every possible path.
    This endpoint-based ratio remains safe when a stored road length was rounded
    slightly below its straight-line length.
    """
    scale = float("inf")
    for edge in graph.edges:
        if not passable(edge, conditions.vehicle, conditions.period):
            continue
        source = graph.nodes.get(edge.from_)
        target = graph.nodes.get(edge.to)
        if source is None or target is None:
            # A malformed passable edge prevents a geometric lower-bound proof.
            return 0.0
        straight_km = haversine(source, target)
        if straight_km > 0:
            scale = min(scale, edge_cost(edge, conditions) / straight_km)
    return scale if scale != float("inf") else 0.0


def nearest_neighbor_heuristic(graph: Graph, goal: str, scale: float) -> Heuristic:
    """Build NN's explicit ``h(n)`` for a single candidate target.

    No greedy step uses this: a step searches the whole remaining goal set at
    once and takes :func:`nearest_neighbor_multi_goal_heuristic` instead. This is
    the one-goal bound that one is defined as the minimum of, kept so the
    relationship can be stated and tested directly rather than assumed.
    """
    goal_node = graph.nodes.get(goal)

    def h(node_id: str) -> float:
        node = graph.nodes.get(node_id)
        return (
            scale * haversine(node, goal_node)
            if node is not None and goal_node is not None
            else 0.0
        )

    return h


def nearest_neighbor_multi_goal_heuristic(
    graph: Graph,
    goals: Sequence[str],
    scale: float,
) -> Heuristic:
    """Build NN's lower bound to the nearest member of ``goals``.

    Each per-goal straight-line estimate is admissible. Their minimum is the
    lower bound to the goal set that a multi-goal A* search needs.
    """
    targets = [graph.nodes[goal] for goal in dict.fromkeys(goals) if goal in graph.nodes]

    def h(node_id: str) -> float:
        node = graph.nodes.get(node_id)
        if node is None or not targets:
            return 0.0
        return scale * min(haversine(node, target) for target in targets)

    return h


def nearest_neighbor_multi_goal_search(
    problem: SearchProblem,
    goals: Sequence[str],
) -> SearchLegResult:
    """Return the cheapest reachable goal through one NN-guided A* search.

    The old planner ran one complete A* search per remaining destination and
    discarded every losing trace. Searching the goal set once shares the common
    frontier work and creates only the trace of the leg NN actually selects.
    ``problem.heuristic`` must be the matching
    :func:`nearest_neighbor_multi_goal_heuristic` bound over ``goals``.
    """
    return multi_goal_search(problem, goals, guided=True)


def nearest_neighbor_order(
    start: str,
    stops: Sequence[str],
    costs: Mapping[tuple[str, str], float],
) -> tuple[str, ...]:
    """Return stops in deterministic directed-cost greedy order.

    Missing ``(current, stop)`` entries are unreachable. If no remaining stop
    is reachable, all remaining stops are appended in their current input order
    so no requested destination is silently dropped. Equal-cost candidates are
    resolved by their order in ``stops``. Inputs are never mutated.
    """
    remaining = list(stops)
    ordered: list[str] = []
    current = start

    while remaining:
        nearest_index: int | None = None
        nearest_cost: float | None = None

        for index, stop in enumerate(remaining):
            candidate_cost = costs.get((current, stop))
            if candidate_cost is None:
                continue
            if nearest_cost is None or candidate_cost < nearest_cost:
                nearest_index = index
                nearest_cost = candidate_cost

        if nearest_index is None:
            ordered.extend(remaining)
            break

        current = remaining.pop(nearest_index)
        ordered.append(current)

    return tuple(ordered)
