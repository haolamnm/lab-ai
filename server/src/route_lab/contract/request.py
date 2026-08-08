"""The /plan request body — mirrors ``PlanInput`` in web/src/lib/search.ts."""

from typing import Literal

from pydantic import Field, field_validator

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

    @field_validator("stops")
    @classmethod
    def _stops_are_distinct(cls, stops: list[str]) -> list[str]:
        """Reject a repeated stop rather than letting each algorithm guess.

        Held-Karp cannot express one location twice — its bitmask has one bit per
        stop — while Nearest Neighbor used to drop the repeat as a side effect of
        deduplicating consecutive legs. Two algorithms answering the same request
        differently is worse than neither answering it, and asking to visit one
        intersection twice is a client bug either way.
        """
        duplicates = sorted({stop for stop in stops if stops.count(stop) > 1})
        if duplicates:
            raise ValueError(f"stops must be distinct; repeated: {', '.join(duplicates)}")
        return stops
