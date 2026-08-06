"""The /plan request body — mirrors ``PlanInput`` in web/src/lib/search.ts."""

from typing import Literal

from pydantic import Field

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import Contract, GraphPayload

# `nearest` and `held_karp` are trip-ordering strategies, not point searches;
# the planner gives each a dedicated Pairwise A* branch.
AlgoKey = Literal["bfs", "dfs", "ucs", "astar", "nearest", "held_karp"]


class PlanRequest(Contract):
    """One algorithm, run across every leg of one trip, over one graph."""

    graph: GraphPayload
    algo: AlgoKey
    start: str
    goal: str
    stops: list[str] = Field(default_factory=list)
    # Applies only to point-search algorithms. Nearest Neighbor and Held-Karp
    # always apply their own trip-ordering strategies.
    optimise_order: bool = False
    # Explicit multi-location mode for Nearest Neighbor and Held-Karp: true
    # returns to start, false finishes at the selected final stop, and omitted
    # or null preserves the legacy goal-based behavior.
    return_to_start: bool | None = None
    conditions: Conditions
