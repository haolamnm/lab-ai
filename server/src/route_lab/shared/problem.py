"""What one leg of the delivery problem looks like to an algorithm.

A :class:`SearchProblem` is the complete, self-contained thing an algorithm is
handed: the graph, where it starts, where it must reach, the run conditions, and
the two functions it is free to plug different implementations into — the **cost**
of taking an edge and the **heuristic** estimate to the goal. Bundling them means
the algorithm signature never grows, and swapping the cost model or the heuristic
is a one-line change at the call site, not an edit to every algorithm.

How the delivery problem maps onto this:

* An **intersection** is a node; a **road segment** is a directed edge (one-way
  streets are simply edges that exist in one direction).
* A **trip** is split into **legs** — pickup->stop, stop->stop, stop->dropoff —
  and each leg is one ``SearchProblem``. The planner runs them in turn and joins
  the paths.
* The **cost** of an edge is the weighted objective the search minimises
  (distance, time, congestion, risk); the default is
  :func:`route_lab.shared.traffic.edge_cost`, but any ``CostFn`` works.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.shared.graph import Graph
from route_lab.shared.heuristics import (
    DEFAULT_HEURISTIC,
    HEURISTICS,
    Heuristic,
    HeuristicName,
    geometric_cost_scale,
)
from route_lab.shared.search import SearchLegResult
from route_lab.shared.traffic import edge_cost

# The cost of traversing one edge, already bound to the run conditions, so an
# algorithm calls it as `problem.cost(edge)` with nothing else to thread through.
CostFn = Callable[[GraphEdge], float]


@dataclass(frozen=True)
class SearchProblem:
    """One leg to solve, plus the swappable cost and heuristic it is solved with."""

    graph: Graph
    start: str
    goal: str
    conditions: Conditions
    cost: CostFn
    heuristic: Heuristic
    # The edge used to arrive at the first node of a later trip leg.  It is not
    # part of this leg's reconstructed path, but turn restrictions at the first
    # intersection must still see it.
    incoming: GraphEdge | None = None


# Solving one leg: a problem in, a leg result out. The alias lives here rather
# than in ``algorithms`` because ``shared`` may not import an algorithm and
# ``shared/pairwise.py`` takes one as a parameter;
# :data:`route_lab.algorithms.base.Algorithm` is the same type under the name
# the algorithm docs use.
PointSearch = Callable[[SearchProblem], SearchLegResult]


def build_problem(
    graph: Graph,
    start: str,
    goal: str,
    conditions: Conditions,
    *,
    heuristic_name: HeuristicName = DEFAULT_HEURISTIC,
    heuristic: Heuristic | None = None,
    incoming: GraphEdge | None = None,
) -> SearchProblem:
    """Assemble the default problem for a leg.

    ``cost`` defaults to the traffic cost model, and the heuristic to the named
    distance estimate (``haversine`` by default; see
    :data:`route_lab.shared.heuristics.HEURISTICS`) scaled to be an admissible
    lower bound. Every leg gets one, including the blind searches: BFS, DFS and
    UCS never call ``problem.heuristic``, so building it for them costs one
    geometric-scale scan and removes the standing risk of a per-algorithm
    "is this one guided?" table drifting away from the algorithms themselves.

    Pass ``heuristic`` when the caller already owns a better-suited bound — the
    multi-goal searches do — and the default scan is skipped rather than run to
    build an estimate that is then thrown away.
    """

    def cost(edge: GraphEdge) -> float:
        return edge_cost(edge, conditions)

    if heuristic is None:
        scale = geometric_cost_scale(graph, conditions)
        heuristic = HEURISTICS[heuristic_name](graph, goal, scale)

    return SearchProblem(
        graph=graph,
        start=start,
        goal=goal,
        conditions=conditions,
        cost=cost,
        heuristic=heuristic,
        incoming=incoming,
    )
