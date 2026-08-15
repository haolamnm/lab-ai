"""The planner — one algorithm run across every leg of one trip.

This is the Python side of ``planRoute`` in web/src/lib/search.ts. It orders the
stops (optionally), splits the trip into legs, dispatches each leg to the chosen
algorithm through the registry, joins the results, and aggregates the metrics.
Two keys are not point searches and are resolved here rather than in the
registry: ``nearest`` performs one multi-goal A* search at each greedy step,
while ``held_karp`` consumes a complete directed Pairwise A* matrix.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from itertools import pairwise
from time import perf_counter
from typing import Literal

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.algorithms.held_karp import held_karp
from route_lab.algorithms.nearest_neighbor import (
    nearest_neighbor_heuristic_scale,
    nearest_neighbor_multi_goal_heuristic,
    nearest_neighbor_multi_goal_search,
    nearest_neighbor_order,
)
from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES
from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.contract.request import AlgoKey, PlanRequest
from route_lab.contract.result import Metrics, Reveal, RouteResult, TraceStep
from route_lab.diagnostics import why_blocked
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.pairwise import build_pairwise
from route_lab.shared.problem import SearchProblem, build_problem
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


def _greedy_order(
    request: PlanRequest,
    destinations: Sequence[str],
    costs: Mapping[tuple[str, str], float],
) -> list[str]:
    """Greedily order ``destinations`` for the trip shape ``request`` asked for.

    The one place the dropoff's position is decided, because both callers below
    were deciding it separately and neither was deciding it at all: they handed
    the whole list to the greedy pass and took whatever came back.

    A closed tour has no last stop, so the dropoff is an ordinary location and is
    ordered with everything else. An open route is required to finish at the
    dropoff, so it is held out of the greedy pool and appended — the same rule
    Held-Karp applies through its ``end`` argument, rather than the two
    trip-level algorithms reading one request differently.
    """
    if request.return_to_start:
        return list(nearest_neighbor_order(request.start, destinations, costs))
    pool = [location for location in destinations if location != request.goal]
    return [*nearest_neighbor_order(request.start, pool, costs), request.goal]


def _leg_sequence(request: PlanRequest, graph: Graph) -> list[str]:
    """The ordered list of points to visit, with consecutive duplicates removed."""
    # The dropoff is a destination just like every intermediate stop, and on a
    # round trip the ordering may put it before another stop.
    destinations = [*request.stops, request.goal]
    uses_optional_ordering = request.algo in POINT_SEARCHES and request.optimise_order
    if uses_optional_ordering and len(destinations) > 1:
        matrix = build_pairwise(
            graph=graph,
            locations=_pairwise_locations(request.start, destinations),
            conditions=request.conditions,
            search=a_star_search,
        )
        ordered = _greedy_order(request, destinations, matrix.costs)
    else:
        ordered = destinations
    raw = [request.start, *ordered]
    # A point search reads `return_to_start` too. It does not get to choose the
    # order -- that is what the trip-level algorithms are for -- but it plans the
    # same shape, so all six panes answer the question the toggle asked.
    if request.return_to_start:
        raw.append(request.start)
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
    runtime_ms: float | None = None,
) -> RouteResult:
    """Join the legs into one route and sum every metric across them.

    Every planning path ends here with its selected route legs: point searches
    run them directly, NN retains winning candidate legs, and Held-Karp picks
    them from its Pairwise cache. Metrics are therefore assembled in one place.

    A final blocked leg still contributes its search effort: the expansions,
    trace, and frontier peak are work the algorithm really did, and hiding them
    would make a failed run look cheaper than a successful one. It contributes no
    distance and no path, because it arrived nowhere.
    """
    trace: list[TraceStep] = []
    reveal: list[Reveal] = []
    path: list[str] = []
    km = minutes = cost = leg_ms = 0.0
    expanded = generated = reopened = max_frontier = turns_blocked = 0

    for leg in legs:
        # Summed here rather than at the planner boundary, and summed over the
        # legs this route is actually made of: `planRoute` in search.ts adds
        # `leg.ms` over the same legs, which is what lets the two planners agree.
        leg_ms += leg.ms
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
            ms=js_round(leg_ms if runtime_ms is None else runtime_ms, 1),
            optimal=_optimal(request, found=found),
            turns_blocked=turns_blocked,
        ),
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

    Pairwise searches that are not selected contribute no search-effort metrics.
    Planner runtime is measured separately around the complete Pairwise,
    ordering, and assembly pipeline.
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


CandidateSearch = Callable[[str, str, GraphEdge | None], SearchLegResult]
MultiGoalSearch = Callable[[str, Sequence[str], GraphEdge | None], SearchLegResult]


def _plan_greedy_route(
    request: PlanRequest,
    graph: Graph,
    ids: list[str],
    *,
    candidate_search: CandidateSearch | None = None,
    multi_goal_search: MultiGoalSearch | None = None,
) -> RouteResult:
    """Choose each next destination through the supplied greedy search strategy."""
    if (candidate_search is None) == (multi_goal_search is None):
        raise ValueError("provide exactly one greedy search strategy")
    route_kind: RouteKind = "closed tour" if request.return_to_start else "open route"
    destinations = [
        location
        for location in dict.fromkeys([*request.stops, request.goal])
        if location != request.start
    ]
    remaining = (
        list(destinations)
        if request.return_to_start
        else [location for location in destinations if location != request.goal]
    )
    forced_tail = request.start if request.return_to_start else request.goal

    if not remaining and forced_tail == request.start:
        return _stopped(
            request.algo,
            ids,
            "The pickup and dropoff pin to the same intersection. Choose points farther apart.",
        )

    order = [request.start]
    selected_legs: list[SearchLegResult] = []
    current = request.start
    incoming: GraphEdge | None = None
    runtime_ms = 0.0

    while remaining:
        best_index: int | None = None
        best_cost = float("inf")
        best_leg: SearchLegResult | None = None
        failed_turns = 0

        if multi_goal_search is not None:
            leg = multi_goal_search(current, remaining, incoming)
            runtime_ms += leg.ms
            if not leg.found:
                failed_turns += leg.stats.turns_blocked
            elif leg.path and leg.path[-1] in remaining:
                best_index = remaining.index(leg.path[-1])
                best_leg = leg
        elif candidate_search is not None:
            for index, candidate in enumerate(remaining):
                leg = candidate_search(current, candidate, incoming)
                runtime_ms += leg.ms
                if not leg.found:
                    failed_turns += leg.stats.turns_blocked
                    continue
                candidate_cost = sum(edge_cost(edge, request.conditions) for edge in leg.edges)
                if candidate_cost < best_cost:
                    best_index = index
                    best_cost = candidate_cost
                    best_leg = leg

        if best_index is None or best_leg is None:
            target = remaining[0]
            reason = why_blocked(graph, current, target, request.conditions, failed_turns)
            return _route_from_legs(
                request,
                ids,
                order,
                selected_legs,
                found=False,
                problem=f"No complete {route_kind} exists. {reason}",
                runtime_ms=runtime_ms,
            )

        current = remaining.pop(best_index)
        selected_legs.append(best_leg)
        order.append(current)
        if best_leg.edges:
            incoming = best_leg.edges[-1]

    if current != forced_tail:
        if multi_goal_search is not None:
            tail_leg = multi_goal_search(current, [forced_tail], incoming)
        elif candidate_search is not None:
            tail_leg = candidate_search(current, forced_tail, incoming)
        else:
            raise AssertionError("the greedy search strategy was validated above")
        runtime_ms += tail_leg.ms
        if not tail_leg.found:
            reason = why_blocked(
                graph,
                current,
                forced_tail,
                request.conditions,
                tail_leg.stats.turns_blocked,
            )
            return _route_from_legs(
                request,
                ids,
                order,
                [*selected_legs, tail_leg],
                found=False,
                problem=f"No complete {route_kind} exists. {reason}",
                runtime_ms=runtime_ms,
            )
        selected_legs.append(tail_leg)
        order.append(forced_tail)

    return _route_from_legs(
        request,
        ids,
        order,
        selected_legs,
        found=True,
        runtime_ms=runtime_ms,
    )


def _plan_nearest(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Run canonical Nearest Neighbor with one multi-goal A* per greedy step."""
    scale = nearest_neighbor_heuristic_scale(graph, request.conditions)

    def search_goals(
        current: str,
        goals: Sequence[str],
        incoming: GraphEdge | None,
    ) -> SearchLegResult:
        def cost(edge: GraphEdge) -> float:
            return edge_cost(edge, request.conditions)

        problem = SearchProblem(
            graph=graph,
            start=current,
            # The NN search owns its goal set. SearchProblem keeps one member so
            # its common point-search contract does not need to change.
            goal=goals[0],
            conditions=request.conditions,
            cost=cost,
            heuristic=nearest_neighbor_multi_goal_heuristic(graph, goals, scale),
            incoming=incoming,
        )
        return nearest_neighbor_multi_goal_search(problem, goals)

    return _plan_greedy_route(request, graph, ids, multi_goal_search=search_goals)


def _plan_ordered_ucs(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Apply NN ordering with live UCS candidates, preserving turn context."""
    search = POINT_SEARCHES["ucs"]

    def candidate_search(current: str, target: str, incoming: GraphEdge | None) -> SearchLegResult:
        problem = build_problem(
            graph,
            current,
            target,
            request.conditions,
            incoming=incoming,
        )
        return search(problem)

    return _plan_greedy_route(request, graph, ids, candidate_search=candidate_search)


def _plan_held_karp(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Plan an exact open or closed tour from Pairwise A* costs and Held-Karp."""
    warehouse = request.start
    # A trip whose dropoff is already the pickup is a loop however the toggle is
    # set, and every other algorithm plans it as one -- `_leg_sequence` closes it
    # simply by appending a `goal` that equals `start`. Held-Karp agrees rather
    # than being the one algorithm that reads the same request differently.
    closed = request.return_to_start or request.goal == warehouse
    route_kind: RouteKind = "closed tour" if closed else "open route"

    # The dropoff joins the stops. On a closed tour it is an ordinary location
    # whose position is chosen like any other; on an open tour it is the location
    # the path is required to finish at. Deduplicated because a dropoff that
    # repeats a stop is one place to visit, and the bitmask carries one bit per
    # entry -- a repeat would be planned as two unrelated visits.
    destinations = [
        location
        for location in dict.fromkeys([*request.stops, request.goal])
        if location != warehouse
    ]

    if len(destinations) > MAX_HELD_KARP_STOPS:
        return _stopped(
            request.algo,
            ids,
            f"Held-Karp supports at most {MAX_HELD_KARP_STOPS} stops; "
            f"received {len(destinations)}.",
        )
    if warehouse in request.stops:
        return _stopped(
            request.algo,
            ids,
            "The Held-Karp warehouse must not appear in stops.",
        )

    if not destinations:
        # Nowhere to go: no stops, and a dropoff that is already the pickup. The
        # four point searches answer this with the sentence below, so Held-Karp
        # does too rather than being the one algorithm that calls it a valid trip.
        return _stopped(
            request.algo,
            ids,
            "The pickup and dropoff pin to the same intersection. Choose points farther apart.",
        )

    matrix = build_pairwise(
        graph=graph,
        locations=[warehouse, *destinations],
        conditions=request.conditions,
        search=a_star_search,
    )
    tour = held_karp(
        warehouse=warehouse,
        stops=destinations,
        costs=matrix.costs,
        return_to_start=closed,
        end=None if closed else request.goal,
    )

    if not tour.found:
        return _stopped(
            request.algo,
            ids,
            f"No complete {route_kind} exists for all Held-Karp stops.",
        )

    return _assemble_cached_legs(
        request,
        graph,
        ids,
        list(tour.order),
        matrix.paths,
        route_kind=route_kind,
    )


def _plan_measured(request: PlanRequest, graph: Graph, ids: list[str]) -> RouteResult:
    """Everything the runtime figure covers, on an already-validated request.

    Split out of :func:`plan_route` so the measurement cannot be forgotten. Every
    exit here is inside the clock by construction, which is what makes the
    ``ms=0`` placeholder in :func:`_route_from_legs` safe: no return path can
    reach a caller without ``plan_route`` overwriting it.
    """
    algo = request.algo
    conditions = request.conditions

    # Held-Karp is a trip-level optimiser; the point-search ordering toggle does
    # not disable its Pairwise A* matrix or dynamic-programming branch.
    if algo == "held_karp":
        return _plan_held_karp(request, graph, ids)
    if algo == "nearest":
        return _plan_nearest(request, graph, ids)
    if algo == "ucs" and request.optimise_order:
        return _plan_ordered_ucs(request, graph, ids)

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
    incoming: GraphEdge | None = None

    for index in range(len(sequence) - 1):
        leg_problem = build_problem(
            graph,
            sequence[index],
            sequence[index + 1],
            conditions,
            incoming=incoming,
        )
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
        if leg.edges:
            incoming = leg.edges[-1]

    return _route_from_legs(request, ids, sequence[:reached], legs, found=found, problem=problem)


def plan_route(request: PlanRequest) -> RouteResult:
    """Plan ``request.algo`` across the whole trip and return its full result."""
    graph = build_graph(request.graph)
    ids = node_ids(graph)

    # Every trip point must be an intersection in this graph. A stale pin — a
    # start/goal/stop id from a graph that has since been rebuilt — would otherwise
    # raise a KeyError on the first frontier expansion and surface as a bare 500;
    # here it becomes a normal result whose `problem` says what to fix, the same
    # way an unimplemented algorithm does below.
    trip_points = list(dict.fromkeys([request.start, request.goal, *request.stops]))
    unknown = [point for point in trip_points if point not in graph.nodes]
    if unknown:
        return _stopped(
            request.algo,
            ids,
            f"These points are not intersections in this graph: {', '.join(unknown)}. "
            "Rebuild the network or re-pin the trip.",
        )

    # Complete backend planning time, reported alongside `ms` rather than in
    # place of it. Graph construction and trip-point validation are common
    # request preparation, so the clock starts only after both have succeeded;
    # everything algorithm-specific—including Pairwise searches and ordering—is
    # inside the boundary, and the single exit below is why that stays true as
    # the planner grows. `ms` keeps the narrower algorithm-search sum the browser
    # also reports (multi-goal steps for NN; all candidate calls for greedy UCS).
    started_at = perf_counter()
    result = _plan_measured(request, graph, ids)
    planning_ms = js_round((perf_counter() - started_at) * 1000, 1)

    metrics = result.metrics.model_copy(update={"planning_ms": planning_ms})
    return result.model_copy(update={"metrics": metrics})
