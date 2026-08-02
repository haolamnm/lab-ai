"""Plug-n-play heuristics.

A heuristic answers one question: from this node, roughly what does it cost to
reach the goal? It is a plain ``Callable[[str], float]`` — a node id in, an
estimate out — so an algorithm never cares how the estimate is produced, and the
planner (or a test, or the team) can swap one in without touching the search.

A *factory* builds one bound to a graph, a goal, and a ``scale`` (the cheapest
cost-per-km in the network; see
:func:`route_lab.shared.traffic.min_cost_per_km`). Multiplying a distance by the
scale converts kilometres into the same units the cost function uses.

Four are provided, registered by name in :data:`HEURISTICS`:

* ``zero`` — estimate nothing. A* with this is exactly UCS; BFS/DFS carry it.
* ``haversine`` — great-circle distance. Exact spherical distance, and the
  admissible default: scaled, it can never overestimate real road cost.
* ``euclidean`` (alias ``gauss``) — straight-line distance on a local planar
  projection. Practically identical to haversine at city scale and also
  admissible; cheaper to compute.
* ``manhattan`` (alias ``hamilton``) — taxicab distance on that projection.
  **Not admissible** — it can overestimate the straight-line distance, so A* with
  it is no longer guaranteed optimal. Kept because seeing an inadmissible
  heuristic break the optimality guarantee is exactly the kind of thing this lab
  exists to show.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from route_lab.shared.geo import haversine
from route_lab.shared.graph import Graph

# node id -> estimated remaining cost to the goal.
Heuristic = Callable[[str], float]
# (graph, goal, scale) -> a heuristic bound to that goal.
HeuristicFactory = Callable[[Graph, str, float], Heuristic]

_EARTH_RADIUS_KM = 6371.0


def zero_heuristic(node_id: str) -> float:
    """Estimate nothing. A* with this is exactly UCS; BFS and DFS carry it too.

    The ``node_id`` argument is unused on purpose: the signature is the
    :data:`Heuristic` contract, so this drops in wherever a real heuristic would.
    """
    _ = node_id
    return 0.0


def _offsets_km(
    from_lat: float, from_lng: float, to_lat: float, to_lng: float
) -> tuple[float, float]:
    """East/north offset in km via an equirectangular projection about the midpoint.

    Good to a fraction of a percent over a city-sized area, and the shared basis
    for the Euclidean and Manhattan heuristics so they stay comparable.
    """
    mean_lat = math.radians((from_lat + to_lat) / 2)
    east = math.radians(to_lng - from_lng) * math.cos(mean_lat) * _EARTH_RADIUS_KM
    north = math.radians(to_lat - from_lat) * _EARTH_RADIUS_KM
    return east, north


def haversine_heuristic(graph: Graph, goal: str, scale: float) -> Heuristic:
    """Great-circle distance to the goal, scaled — the admissible default."""
    goal_node = graph.nodes[goal]

    def estimate(node_id: str) -> float:
        return scale * haversine(graph.nodes[node_id], goal_node)

    return estimate


def euclidean_heuristic(graph: Graph, goal: str, scale: float) -> Heuristic:
    """Planar straight-line distance to the goal, scaled. Admissible at city scale."""
    goal_node = graph.nodes[goal]

    def estimate(node_id: str) -> float:
        node = graph.nodes[node_id]
        east, north = _offsets_km(node.lat, node.lng, goal_node.lat, goal_node.lng)
        return scale * math.hypot(east, north)

    return estimate


def manhattan_heuristic(graph: Graph, goal: str, scale: float) -> Heuristic:
    """Taxicab distance to the goal, scaled. NOT admissible — see the module docs."""
    goal_node = graph.nodes[goal]

    def estimate(node_id: str) -> float:
        node = graph.nodes[node_id]
        east, north = _offsets_km(node.lat, node.lng, goal_node.lat, goal_node.lng)
        return scale * (abs(east) + abs(north))

    return estimate


# Selectable by name. The aliases record the names originally asked for; the
# primary keys are the standard ones. `zero` is handled separately by the planner
# (it needs no goal or scale), so it is not a factory here.
HEURISTICS: dict[str, HeuristicFactory] = {
    "haversine": haversine_heuristic,
    "euclidean": euclidean_heuristic,
    "gauss": euclidean_heuristic,
    "manhattan": manhattan_heuristic,
    "hamilton": manhattan_heuristic,
}

DEFAULT_HEURISTIC = "haversine"
