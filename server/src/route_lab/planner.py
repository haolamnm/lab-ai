"""The planner — one algorithm run across every leg of one trip.

This is the Python side of ``planRoute`` in web/src/lib/search.ts. It orders the
stops (optionally), splits the trip into legs, dispatches each leg to the chosen
algorithm through the registry, joins the results, and aggregates the metrics.
Two keys are not point searches and are resolved here rather than in the
registry: ``nearest`` and ``held_karp`` both consume directed Pairwise A* costs
and cached legs, then apply their own trip-level ordering strategy.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from itertools import pairwise
from typing import Literal

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.algorithms.held_karp import held_karp
from route_lab.algorithms.nearest_neighbor import nearest_neighbor_order
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES
from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.contract.result import Metrics, Reveal, RouteResult, TraceStep
from route_lab.diagnostics import why_blocked
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.pairwise import build_pairwise
from route_lab.shared.problem import build_problem
from route_lab.shared.rounding import js_round
from route_lab.shared.search import SearchLegResult, node_ids
from route_lab.shared.traffic import cost_is_flat, edge_cost, edge_minutes

# Held-Karp explores 2^n subsets for each of n end stops, so 12 stops is roughly
# 12² * 2¹² ≈ 590,000 transitions plus 13*12 Pairwise A* searches to fill the
# matrix. The number is a chosen ceiling, not a measured one: it is the point at
# which the next stop doubles the work, and a trip planned in this app has a
# handful of drops rather than a depot's worth.
MAX_HELD_KARP_STOPS = 12

# Which shape of multi-location trip an explicit request asked for. ``None`` is
# the legacy mode, where the trip runs to ``goal`` and the label does not apply.
RouteKind = Literal["closed tour", "open route"]


def _optimal(request: PlanRequest, *, found: bool) -> bool:
    """Whether this particular run earns the ``optimal`` stamp.

    The one place the claim is decided, because it is a claim about a whole trip
    and every branch below used to answer it separately — which is how an
    all-zero weight set could have UCS reporting False and Held-Karp True in the
    same comparison.

    Three things have to hold beyond the algorithm's own guarantee. The route has
    to exist; a flat cost function makes every route cost 0, so "optimal" would
    be true of any answer and worth nothing; and a point search optimises one leg
    at a time, so once there are intermediate stops the trip is only as good as
    the order it was handed. The trip-level algorithms are exempt from that last
    one — choosing the order is what they do.
    """
    if not found or not ALGO_OPTIMAL[request.algo]:
        return False
    if cost_is_flat(request.conditions.weights):
        return False
    return request.algo not in POINT_SEARCHES or not request.stops


def _leg_sequence(request: PlanRequest, graph: Graph) -> list[str]:
    """The ordered list of points to visit, with consecutive duplicates removed."""
    # The dropoff is a destination just like every intermediate stop. When
    # ordering is enabled it may therefore be visited before another stop.
    destinations = [*request.stops, request.goal]
    uses_optional_ordering = request.algo in POINT_SEARCHES and request.optimise_order
    if uses_optional_ordering and len(destinations) > 1:
        matrix = build_pairwise(
            graph=graph,
            locations=_pairwise_locations(request.start, destinations),
            conditions=request.conditions,
            search=a_star_search,
        )
        ordered = list(nearest_neighbor_order(request.start, destinations, matrix.costs))
    else:
        ordered = destinations
    raw = [request.start, *ordered]
    return _without_consecutive_duplicates(raw)


def _pairwise_locations(start: str, destinations: Sequence[str]) -> list[str]:
    """Return stable, duplicate-free Pairwise inputs without changing destinations."""
    return list(dict.fromkeys([start, *destinations]))


def _without_consecutive_duplicates(locations: Sequence[str]) -> list[str]:
    """Remove zero-length consecutive legs while preserving all other order."""
    return [
        location
        for index, location in enumerate(locations)
        if index == 0 or location != locations[index - 1]
    ]


def _edge_totals(edges: Sequence[GraphEdge], conditions: Conditions) -> tuple[float, float, float]:
    """Distance, time, and cost summed over the exact edges the search traversed."""
    km = minutes = cost = 0.0
    for edge in edges:
        km += edge.km
        minutes += edge_minutes(edge, conditions)
        cost += edge_cost(edge, conditions)
    return km, minutes, cost


def _zero_metrics(*, optimal: bool) -> Metrics:
    """Every measurement at zero, for a route that ran no leg."""
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


def _stopped(algo: AlgoKey, ids: list[str], problem: str) -> RouteResult:
    """A result that never ran a leg — a degenerate query or an unimplemented algorithm."""
    return RouteResult(
        algo=algo,
        problem=problem,
        order=[],
        path=[],
        trace=[],
        node_ids=ids,
        reveal=[],
        found=False,
        metrics=_zero_metrics(optimal=False),
    )


def _route_from_legs(
    request: PlanRequest,
    ids: list[str],
    order: list[str],
    legs: Sequence[SearchLegResult],
    *,
    found: bool,
    problem: str | None = None,
) -> RouteResult:
    """Join the legs into one route and sum every metric across them.

    Both planning paths end here — the point searches, which run their legs, and
    the trip-level algorithms, which pick theirs out of the Pairwise cache — so
    every number in ``Metrics`` is assembled once and the two cannot drift apart.

    A final blocked leg still contributes its search effort: the expansions,
    trace, and frontier peak are work the algorithm really did, and hiding them
    would make a failed run look cheaper than a successful one. It contributes no
    distance and no path, because it arrived nowhere.
    """
    trace: list[TraceStep] = []
    reveal: list[Reveal] = []
    path: list[str] = []
    km = minutes = cost = ms = 0.0
    expanded = generated = reopened = max_frontier = turns_blocked = 0

    for leg in legs:
        ms += leg.ms
        expanded += leg.stats.expanded
        generated += leg.stats.generated
        reopened += leg.stats.reopened
        max_frontier = max(max_frontier, leg.stats.max_frontier)
        turns_blocked += leg.stats.turns_blocked
        trace.extend(leg.trace)
        if not leg.found:
            continue

        leg_km, leg_minutes, leg_cost = _edge_totals(leg.edges, request.conditions)
        km += leg_km
        minutes += leg_minutes
        cost += leg_cost
        path.extend(leg.path if not path else leg.path[1:])
        reveal.append(Reveal(upto=len(trace), path=list(path)))

    return RouteResult(
        algo=request.algo,
        problem=problem,
        order=order,
        path=path,
        trace=trace,
        node_ids=ids,
        reveal=reveal,
        found=found,
        # The rounding precisions are the ones the frontend footer displays, so a
        # pane shows the same figure whichever planner produced it: two decimals
        # for kilometres, whole minutes, one decimal for cost and elapsed time.
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
            optimal=_optimal(request, found=found),
            turns_blocked=turns_blocked,
        ),
    )


def _trivial_route(request: PlanRequest, ids: list[str]) -> RouteResult:
    """Return the valid zero-leg route at the request start."""
    return RouteResult(
        algo=request.algo,
        problem=None,
        order=[request.start],
        path=[request.start],
        trace=[],
        node_ids=ids,
        reveal=[],
        found=True,
        metrics=_zero_metrics(optimal=_optimal(request, found=True)),
    )


def _assemble_cached_legs(
    request: PlanRequest,
    graph: Graph,
    ids: list[str],
    order: list[str],
    paths: Mapping[tuple[str, str], SearchLegResult],
    *,
    route_kind: RouteKind | None = None,
) -> RouteResult:
    """Assemble one route from selected cached legs only.

    Pairwise searches that are not selected contribute neither search effort nor
    runtime. Reported metrics describe only the cached legs in ``order``.
    """
    selected_legs: list[SearchLegResult] = []
    for source, target in pairwise(order):
        leg = paths.get((source, target))
        if leg is None:
            # A pair missing from the cache means Pairwise A* found no route for
            # it, so the user gets the same actionable sentence a point search
            # would have given them rather than a note about a cache.
            problem = why_blocked(graph, source, target, request.conditions, 0)
            if route_kind is not None:
                problem = f"No complete {route_kind} exists. {problem}"
            return _stopped(request.algo, ids, problem)
        selected_legs.append(leg)

    return _route_from_legs(request, ids, order, selected_legs, found=True)


def _plan_nearest(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Plan legacy or explicit destinations with Pairwise A* and Nearest Neighbor."""
    explicit = request.return_to_start is not None
    route_kind: RouteKind | None = None
    if explicit:
        route_kind = "closed tour" if request.return_to_start else "open route"

    destinations = list(request.stops) if explicit else [*request.stops, request.goal]
    if explicit and not destinations:
        return _trivial_route(request, ids)

    matrix = build_pairwise(
        graph=graph,
        locations=_pairwise_locations(request.start, destinations),
        conditions=request.conditions,
        search=a_star_search,
    )
    ordered = nearest_neighbor_order(request.start, destinations, matrix.costs)
    raw_order = [request.start, *ordered]
    if request.return_to_start is True:
        raw_order.append(request.start)
    order = _without_consecutive_duplicates(raw_order)
    if len(order) < 2:
        if explicit:
            return _trivial_route(request, ids)
        return _stopped(
            request.algo,
            ids,
            "The pickup and dropoff pin to the same intersection. Choose points farther apart.",
        )
    return _assemble_cached_legs(
        request,
        graph,
        ids,
        order,
        matrix.paths,
        route_kind=route_kind,
    )


def _plan_held_karp(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Plan a legacy cycle or explicit path/tour using Pairwise A* and Held-Karp."""
    warehouse = request.start
    stops = request.stops
    explicit = request.return_to_start is not None
    route_kind: RouteKind | None = None
    if explicit:
        route_kind = "closed tour" if request.return_to_start else "open route"

    if not explicit and request.goal != warehouse:
        return _stopped(
            request.algo,
            ids,
            "Held-Karp requires start and goal to be the same warehouse.",
        )
    if len(stops) > MAX_HELD_KARP_STOPS:
        return _stopped(
            request.algo,
            ids,
            f"Held-Karp supports at most {MAX_HELD_KARP_STOPS} stops; received {len(stops)}.",
        )
    if warehouse in stops:
        return _stopped(
            request.algo,
            ids,
            "The Held-Karp warehouse must not appear in stops.",
        )

    if not stops:
        return _trivial_route(request, ids)

    matrix = build_pairwise(
        graph=graph,
        locations=[warehouse, *stops],
        conditions=request.conditions,
        search=a_star_search,
    )
    tour = held_karp(
        warehouse=warehouse,
        stops=stops,
        costs=matrix.costs,
        return_to_start=True if request.return_to_start is None else request.return_to_start,
    )

    if not tour.found:
        if route_kind is not None:
            return _stopped(
                request.algo,
                ids,
                f"No complete {route_kind} exists for all Held-Karp stops.",
            )
        return _stopped(
            request.algo,
            ids,
            "No directed route can visit every Held-Karp stop and return to the warehouse.",
        )

    return _assemble_cached_legs(
        request,
        graph,
        ids,
        list(tour.order),
        matrix.paths,
        route_kind=route_kind,
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
    explicit_trip = algo not in POINT_SEARCHES and request.return_to_start is not None
    raw_trip_points = (
        [request.start, *request.stops]
        if explicit_trip
        else [request.start, request.goal, *request.stops]
    )
    trip_points = list(dict.fromkeys(raw_trip_points))
    unknown = [point for point in trip_points if point not in graph.nodes]
    if unknown:
        return _stopped(
            algo,
            ids,
            f"These points are not intersections in this graph: {', '.join(unknown)}. "
            "Rebuild the network or re-pin the trip.",
        )

    # Held-Karp is a trip-level optimiser; the point-search ordering toggle does
    # not disable its Pairwise A* matrix or dynamic-programming branch.
    if algo == "held_karp":
        return _plan_held_karp(request, graph, ids)
    if algo == "nearest":
        return _plan_nearest(request, graph, ids)

    sequence = _leg_sequence(request, graph)
    if len(sequence) < 2:
        return _stopped(
            algo,
            ids,
            "The pickup and dropoff pin to the same intersection. Choose points farther apart.",
        )

    search = POINT_SEARCHES[algo]
    legs: list[SearchLegResult] = []
    found = True
    problem: str | None = None
    reached = 1

    for index in range(len(sequence) - 1):
        leg_problem = build_problem(graph, sequence[index], sequence[index + 1], conditions)
        try:
            leg = search(leg_problem)
        except AlgorithmNotImplemented as exc:
            return _stopped(algo, ids, str(exc))
        legs.append(leg)

        if not leg.found:
            found = False
            problem = why_blocked(
                graph, sequence[index], sequence[index + 1], conditions, leg.stats.turns_blocked
            )
            if len(sequence) > 2:
                problem = f"Leg {index + 1}/{len(sequence) - 1} is blocked. {problem}"
            break
        reached = index + 2

    return _route_from_legs(request, ids, sequence[:reached], legs, found=found, problem=problem)
