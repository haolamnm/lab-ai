"""The one place that knows the full set of algorithms.

To add an algorithm: write its module, then register it here. ``nearest`` is
deliberately absent — it is not a point-to-point search but a stop-ordering
strategy the planner layers on top of UCS, exactly as the frontend does.
"""

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.base import Algorithm
from route_lab.algorithms.bfs import breadth_first_search
from route_lab.algorithms.dfs import depth_first_search
from route_lab.algorithms.ucs import uniform_cost_search
from route_lab.contract.request import AlgoKey

# The point-to-point searches, keyed by the wire name the frontend sends.
POINT_SEARCHES: dict[str, Algorithm] = {
    "bfs": breadth_first_search,
    "dfs": depth_first_search,
    "ucs": uniform_cost_search,
    "astar": a_star_search,
}

# Whether an algorithm is optimal over the cost function. UCS and A* are; the
# rest are not. The planner only stamps a result "optimal" when the algorithm is,
# the route was found, there were no intermediate stops, and the cost is not flat.
ALGO_OPTIMAL: dict[AlgoKey, bool] = {
    "bfs": False,
    "dfs": False,
    "ucs": True,
    "astar": True,
    "nearest": False,
    "held_karp": True,
}


def guided(algo: str) -> bool:
    """Whether the algorithm consults a heuristic."""
    return algo == "astar"
