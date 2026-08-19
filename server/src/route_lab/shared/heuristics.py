"""The production heuristic used by the routing system.

A heuristic estimates the remaining cost from a node to the goal. A factory
binds that estimate to a graph, a goal, and a safe geometric cost scale so its
output uses the same units as the route cost.

The only registered production heuristic is ``haversine``: scaled great-circle
distance. It is an admissible lower bound for road cost. The registry remains in
place so future production heuristics can be added without changing A* or the
``SearchProblem`` interface.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from route_lab.contract.conditions import Conditions
from route_lab.shared.geo import haversine
from route_lab.shared.graph import Graph
from route_lab.shared.traffic import edge_cost, passable

# node id -> estimated remaining cost to the goal.
Heuristic = Callable[[str], float]
# (graph, goal, scale) -> a heuristic bound to that goal.
HeuristicFactory = Callable[[Graph, str, float], Heuristic]
# The registered names, so a lookup in HEURISTICS cannot miss.
HeuristicName = Literal["haversine"]


def geometric_cost_scale(graph: Graph, conditions: Conditions) -> float:
    """Return a safe cost per straight-line kilometre for Haversine bounds.

    For every passable edge ``e``, the returned value satisfies
    ``cost(e) >= scale * haversine(e.from, e.to)``. The triangle inequality
    therefore makes scaled straight-line distance a lower bound for every path,
    even when an imported edge's stored ``km`` is shorter than its endpoints'
    geometric distance. Turn restrictions need not enter this scan: ignoring
    them admits more edges and can only make the lower-bound scale smaller.
    """
    scale = float("inf")
    for edge in graph.edges:
        if not passable(edge, conditions.vehicle, conditions.period):
            continue
        source = graph.nodes.get(edge.from_)
        target = graph.nodes.get(edge.to)
        if source is None or target is None:
            # GraphPayload validates this invariant. Keep the helper total for
            # directly constructed Graph objects and fall back in the safe direction.
            return 0.0
        straight_km = haversine(source, target)
        if straight_km > 0:
            scale = min(scale, edge_cost(edge, conditions) / straight_km)
    return max(0.0, scale) if scale != float("inf") else 0.0


def haversine_heuristic(graph: Graph, goal: str, scale: float) -> Heuristic:
    """Return scaled great-circle distance to the goal."""
    goal_node = graph.nodes[goal]

    def estimate(node_id: str) -> float:
        return scale * haversine(graph.nodes[node_id], goal_node)

    return estimate


# Selected by name from route_lab.shared.problem.build_problem.
HEURISTICS: dict[HeuristicName, HeuristicFactory] = {
    "haversine": haversine_heuristic,
}

DEFAULT_HEURISTIC: HeuristicName = "haversine"
