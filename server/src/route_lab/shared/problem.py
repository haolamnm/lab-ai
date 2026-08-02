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
from route_lab.shared.heuristics import DEFAULT_HEURISTIC, HEURISTICS, Heuristic, zero_heuristic
from route_lab.shared.traffic import edge_cost, min_cost_per_km

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


def build_problem(
    graph: Graph,
    start: str,
    goal: str,
    conditions: Conditions,
    *,
    guided: bool,
    heuristic_name: str = DEFAULT_HEURISTIC,
) -> SearchProblem:
    """Assemble the default problem for a leg.

    ``cost`` defaults to the traffic cost model. ``guided`` decides the
    heuristic: a guided search (A*, Greedy) gets the named distance heuristic
    (``haversine`` by default; see :data:`route_lab.shared.heuristics.HEURISTICS`),
    scaled to be an admissible lower bound; a blind one (BFS, DFS, UCS) gets the
    zero heuristic, so it is handed a valid function it simply never consults.
    """

    def cost(edge: GraphEdge) -> float:
        return edge_cost(edge, conditions)

    heuristic: Heuristic
    if guided:
        scale = min_cost_per_km(graph.edges, conditions)
        heuristic = HEURISTICS[heuristic_name](graph, goal, scale)
    else:
        heuristic = zero_heuristic

    return SearchProblem(
        graph=graph,
        start=start,
        goal=goal,
        conditions=conditions,
        cost=cost,
        heuristic=heuristic,
    )
