"""The production heuristic used by the routing system.

A heuristic estimates the remaining cost from a node to the goal. A factory
binds that estimate to a graph, a goal, and the network's cheapest cost per
kilometre so its output uses the same units as the route cost.

The only registered production heuristic is ``haversine``: scaled great-circle
distance. It is an admissible lower bound for road cost. The registry remains in
place so future production heuristics can be added without changing A* or the
``SearchProblem`` interface.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from route_lab.shared.geo import haversine
from route_lab.shared.graph import Graph

# node id -> estimated remaining cost to the goal.
Heuristic = Callable[[str], float]
# (graph, goal, scale) -> a heuristic bound to that goal.
HeuristicFactory = Callable[[Graph, str, float], Heuristic]
# The registered names, so a lookup in HEURISTICS cannot miss.
HeuristicName = Literal["haversine"]


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
