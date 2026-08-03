"""The planner — one algorithm run across every leg of one trip.

This is the Python side of ``planRoute`` in web/src/lib/search.ts. It orders the
stops (optionally), splits the trip into legs, dispatches each leg to the chosen
algorithm through the registry, joins the results, and aggregates the metrics.
Two of the seven keys are not point searches and are resolved here rather than in
the registry: ``nearest`` becomes a UCS point search plus the shared
nearest-neighbour ordering, and ``held_karp`` takes its own branch entirely,
because it needs a directed cost matrix over the trip points before any leg can
be routed.
"""

from __future__ import annotations

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.algorithms.held_karp import held_karp
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES, guided
from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.contract.result import Metrics, Reveal, RouteResult, TraceStep
from route_lab.diagnostics import why_blocked
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.ordering import nearest_neighbor_order
from route_lab.shared.pairwise import build_pairwise
from route_lab.shared.problem import build_problem
from route_lab.shared.rounding import js_round
from route_lab.shared.search import SearchLegResult, node_ids
from route_lab.shared.traffic import cost_is_flat, edge_cost, edge_minutes

MAX_HELD_KARP_STOPS = 12


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


def _plan_held_karp(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Plan a closed warehouse tour using Pairwise A* and Held-Karp ordering."""
    warehouse = request.start
    stops = request.stops

    if request.goal != warehouse:
        return _stopped(
            request.algo,
            [warehouse],
            ids,
            "Held-Karp requires start and goal to be the same warehouse.",
        )
    if len(stops) > MAX_HELD_KARP_STOPS:
        return _stopped(
            request.algo,
            [warehouse],
            ids,
            f"Held-Karp supports at most {MAX_HELD_KARP_STOPS} stops; received {len(stops)}.",
        )
    if warehouse in stops:
        return _stopped(
            request.algo,
            [warehouse],
            ids,
            "The Held-Karp warehouse must not appear in stops.",
        )
    if len(set(stops)) != len(stops):
        return _stopped(
            request.algo,
            [warehouse],
            ids,
            "Held-Karp stops must not contain duplicates.",
        )

    if not stops:
        return RouteResult(
            algo=request.algo,
            problem=None,
            order=[warehouse],
            path=[warehouse],
            trace=[],
            node_ids=ids,
            reveal=[],
            found=True,
            metrics=_zero_metrics(optimal=True),
        )

    pairwise = build_pairwise(
        graph=graph,
        locations=[warehouse, *stops],
        conditions=request.conditions,
        search=a_star_search,
    )
    try:
        tour = held_karp(
            warehouse=warehouse,
            stops=stops,
            costs=pairwise.costs,
        )
    except ValueError as exc:
        return _stopped(request.algo, [warehouse], ids, f"Held-Karp input is invalid: {exc}")

    if not tour.found:
        return _stopped(
            request.algo,
            [warehouse],
            ids,
            "No directed route can visit every Held-Karp stop and return to the warehouse.",
        )

    selected_legs: list[SearchLegResult] = []
    for source, target in zip(tour.order, tour.order[1:], strict=False):
        leg = pairwise.paths.get((source, target))
        if leg is None:
            return _stopped(
                request.algo,
                [warehouse],
                ids,
                f"The cached Pairwise route for {source} -> {target} is missing.",
            )
        selected_legs.append(leg)

    trace: list[TraceStep] = []
    reveal: list[Reveal] = []
    path: list[str] = []
    km = minutes = cost = ms = 0.0
    expanded = generated = reopened = max_frontier = turns_blocked = 0

    for leg in selected_legs:
        ms += leg.ms
        expanded += leg.stats.expanded
        generated += leg.stats.generated
        reopened += leg.stats.reopened
        max_frontier = max(max_frontier, leg.stats.max_frontier)
        turns_blocked += leg.stats.turns_blocked
        trace.extend(leg.trace)

        leg_km, leg_minutes, leg_cost = _edge_totals(leg.edges, request.conditions)
        km += leg_km
        minutes += leg_minutes
        cost += leg_cost
        path.extend(leg.path if not path else leg.path[1:])
        reveal.append(Reveal(upto=len(trace), path=list(path)))

    return RouteResult(
        algo=request.algo,
        problem=None,
        order=list(tour.order),
        path=path,
        trace=trace,
        node_ids=ids,
        reveal=reveal,
        found=True,
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
            optimal=ALGO_OPTIMAL[request.algo],
            turns_blocked=turns_blocked,
        ),
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

    if algo == "held_karp":
        return _plan_held_karp(request, graph, ids)

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
