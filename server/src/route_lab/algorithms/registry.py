"""The one place that knows the full set of algorithms.

To add an algorithm: write its module, then register it here. ``nearest`` and
``held_karp`` are deliberately absent from ``POINT_SEARCHES`` for the same
reason — neither is a point-to-point search. Both are trip-level ordering
strategies the planner layers on top of directed Pairwise A* routes, so they
appear in ``ALGO_OPTIMAL`` and nowhere else here.
"""

from typing import Literal

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.base import Algorithm
from route_lab.algorithms.bfs import breadth_first_search
from route_lab.algorithms.dfs import depth_first_search
from route_lab.algorithms.ucs import uniform_cost_search
from route_lab.contract.request import AlgoKey

# The subset of :data:`~route_lab.contract.request.AlgoKey` that names a
# point-to-point search, so the planner cannot hand a leg to an algorithm that
# orders trips. Spelled out rather than derived: Python has no Literal
# subtraction, unlike the frontend's ``Exclude<AlgoKey, 'nearest'|'held_karp'>``.
#
# Neither table below is checked for totality by the type system — a
# ``dict[SomeLiteral, V]`` accepts any subset of that Literal's members — so
# ``tests/test_registry.py`` is what fails when an algorithm is added to one
# table and forgotten in the other.
PointSearchKey = Literal["bfs", "dfs", "ucs", "astar"]

# The point-to-point searches, keyed by the wire name the frontend sends.
POINT_SEARCHES: dict[PointSearchKey, Algorithm] = {
    "bfs": breadth_first_search,
    "dfs": depth_first_search,
    "ucs": uniform_cost_search,
    "astar": a_star_search,
}

# Whether an algorithm is optimal over the cost function. UCS, A*, and Held-Karp
# are; the rest are not. This says only what the algorithm guarantees in
# principle — the planner decides whether a particular run earns the stamp.
ALGO_OPTIMAL: dict[AlgoKey, bool] = {
    "bfs": False,
    "dfs": False,
    "ucs": True,
    "astar": True,
    "nearest": False,
    "held_karp": True,
}
