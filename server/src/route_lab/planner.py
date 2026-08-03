"""The planner — one algorithm run across every leg of one trip.

This is the Python side of ``planRoute`` in web/src/lib/search.ts. It orders the
stops (optionally), splits the trip into legs, dispatches each leg to the chosen
algorithm through the registry, joins the results, and aggregates the metrics.
The ``nearest`` algorithm is resolved here to a UCS point search plus the shared
nearest-neighbour ordering, so it works today even while the other four
algorithms are still stubs.
"""

from __future__ import annotations

from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.algorithms.nearest_neighbor import nearest_neighbor_order
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES, guided
from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.contract.result import Metrics, Reveal, RouteResult, TraceStep
from route_lab.diagnostics import why_blocked
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.problem import build_problem
from route_lab.shared.rounding import js_round
from route_lab.shared.search import node_ids
from route_lab.shared.traffic import cost_is_flat, edge_cost, edge_minutes


def _leg_sequence(request: PlanRequest, graph: Graph) -> list[str]:
    """The ordered list of points to visit, with consecutive duplicates removed."""
    stops = request.stops
    should_order = (request.algo == "nearest" or request.optimise_order) and len(stops) > 1
    ordered = (
        nearest_neighbor_order(graph, request.start, stops, request.conditions)
        if should_order
        else list(stops)
    )
    raw = [request.start, *ordered, request.goal]
    return [node for index, node in enumerate(raw) if index == 0 or node != raw[index - 1]]


def _zero_metrics(*, optimal: bool = False) -> Metrics:
    return Metrics(
        km=0,
        minutes=0,
        cost=0,
        hops=0,
        expanded=0,
        generated=0,
        reopened=0,
        max_frontier=0,
        ms=0,
        optimal=optimal,
        turns_blocked=0,
    )


def _edge_totals(edges: list[GraphEdge], conditions: Conditions) -> tuple[float, float, float]:
    """Distance, time, and cost summed over the exact edges the search traversed."""
    km = minutes = cost = 0.0
    for edge in edges:
        km += edge.km
        minutes += edge_minutes(edge, conditions)
        cost += edge_cost(edge, conditions)
    return km, minutes, cost


def _stopped(algo: AlgoKey, order: list[str], ids: list[str], problem: str) -> RouteResult:
    """A result that never ran a leg — a degenerate query or an unimplemented algorithm."""
    return RouteResult(
        algo=algo,
        problem=problem,
        order=order,
        path=[],
        trace=[],
        node_ids=ids,
        reveal=[],
        found=False,
        metrics=_zero_metrics(),
    )


def plan_route(request: PlanRequest) -> RouteResult:
    """Plan ``request.algo`` across the whole trip and return its full result."""
    graph = build_graph(request.graph)
    ids = node_ids(graph)
    algo = request.algo
    conditions = request.conditions

    # Every trip point must be an intersection in this graph. A stale pin — a
    # start/goal/stop id from a graph that has since been rebuilt — would otherwise
    # raise a KeyError on the first frontier expansion and surface as a bare 500;
    # here it becomes a normal result whose `problem` says what to fix, the same
    # way an unimplemented algorithm does below.
    trip_points = list(dict.fromkeys([request.start, request.goal, *request.stops]))
    unknown = [point for point in trip_points if point not in graph.nodes]
    if unknown:
        return _stopped(
            algo,
            [],
            ids,
            f"These points are not intersections in this graph: {', '.join(unknown)}. "
            "Rebuild the network or re-pin the trip.",
        )

    sequence = _leg_sequence(request, graph)
    if len(sequence) < 2:
        return _stopped(
            algo,
            sequence,
            ids,
            "The pickup and dropoff pin to the same intersection. Choose points farther apart.",
        )

    # Nearest Neighbor picks the order; UCS supplies each exact leg and its trace.
    point_algo = "ucs" if algo == "nearest" else algo
    search = POINT_SEARCHES[point_algo]
    is_guided = guided(point_algo)

    trace: list[TraceStep] = []
    reveal: list[Reveal] = []
    path: list[str] = []
    km = minutes = cost = ms = 0.0
    expanded = generated = reopened = max_frontier = turns_blocked = 0
    found = True
    problem: str | None = None
    reached = 1

    for index in range(len(sequence) - 1):
        leg_problem = build_problem(
            graph, sequence[index], sequence[index + 1], conditions, guided=is_guided
        )
        try:
            leg = search(leg_problem)
        except AlgorithmNotImplemented as exc:
            return _stopped(algo, sequence[:reached], ids, str(exc))

        ms += leg.ms
        expanded += leg.stats.expanded
        generated += leg.stats.generated
        reopened += leg.stats.reopened
        max_frontier = max(max_frontier, leg.stats.max_frontier)
        turns_blocked += leg.stats.turns_blocked
        trace.extend(leg.trace)

        if not leg.found:
            found = False
            problem = why_blocked(
                graph, sequence[index], sequence[index + 1], conditions, leg.stats.turns_blocked
            )
            if len(sequence) > 2:
                problem = f"Leg {index + 1}/{len(sequence) - 1} is blocked. {problem}"
            break

        leg_km, leg_minutes, leg_cost = _edge_totals(leg.edges, conditions)
        km += leg_km
        minutes += leg_minutes
        cost += leg_cost
        path.extend(leg.path if not path else leg.path[1:])
        reveal.append(Reveal(upto=len(trace), path=list(path)))
        reached = index + 2

    return RouteResult(
        algo=algo,
        problem=problem,
        order=sequence[:reached],
        path=path,
        trace=trace,
        node_ids=ids,
        reveal=reveal,
        found=found,
        metrics=Metrics(
            km=js_round(km, 2),
            minutes=js_round(minutes),
            cost=js_round(cost, 1),
            hops=max(0, len(path) - 1),
            expanded=expanded,
            generated=generated,
            reopened=reopened,
            max_frontier=max_frontier,
            ms=js_round(ms, 1),
            optimal=(
                found
                and ALGO_OPTIMAL[algo]
                and len(request.stops) == 0
                and not cost_is_flat(conditions.weights)
            ),
            turns_blocked=turns_blocked,
        ),
    )
