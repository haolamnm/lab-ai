"""The /plan request body — mirrors ``PlanInput`` in web/src/lib/search.ts."""

from typing import Literal

from pydantic import Field

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import Contract, GraphPayload

# `nearest` is not a search algorithm but a stop-ordering strategy layered on
# UCS; the planner resolves it to a UCS point search, exactly as search.ts does.
AlgoKey = Literal["bfs", "dfs", "ucs", "astar", "nearest", "held_karp"]


class PlanRequest(Contract):
    """One algorithm, run across every leg of one trip, over one graph."""

    graph: GraphPayload
    algo: AlgoKey
    start: str
    goal: str
    stops: list[str] = Field(default_factory=list)
    optimise_order: bool = True
    conditions: Conditions
