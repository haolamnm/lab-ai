"""Why a leg has no route — the port of the ``whyBlocked`` logic in search.ts.

When a leg fails, "unreachable" is not a useful answer, because the reasons it can
happen need different fixes: a genuinely disconnected network, a one-way trap, a
vehicle ban, a time-based curfew, or a turn restriction. These extra traversals
tell them apart and return a sentence the user can act on.
"""

from __future__ import annotations

from collections.abc import Callable

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.shared.graph import Graph
from route_lab.shared.traffic import PERIODS, ROAD_LABEL, VEHICLES, passable, vehicle_of


def reaches(graph: Graph, start: str, goal: str, allow: Callable[[GraphEdge], bool]) -> bool:
    """Whether ``goal`` is reachable from ``start`` using only allowed edges."""
    seen = {start}
    queue = [start]
    head = 0
    while head < len(queue):
        current = queue[head]
        head += 1
        if current == goal:
            return True
        for edge in graph.adj.get(current, []):
            if allow(edge) and edge.to not in seen:
                seen.add(edge.to)
                queue.append(edge.to)
    return False


def _connected_ignoring_direction(graph: Graph, source: str, target: str) -> bool:
    """Whether the two points are linked at all if one-way direction is ignored."""
    reverse: dict[str, list[str]] = {}
    for edge in graph.edges:
        reverse.setdefault(edge.to, []).append(edge.from_)

    seen = {source}
    queue = [source]
    head = 0
    while head < len(queue):
        current = queue[head]
        head += 1
        for edge in graph.adj.get(current, []):
            if edge.to not in seen:
                seen.add(edge.to)
                queue.append(edge.to)
        for previous in reverse.get(current, []):
            if previous not in seen:
                seen.add(previous)
                queue.append(previous)
    return target in seen


def why_blocked(
    graph: Graph, source: str, target: str, conditions: Conditions, turns_blocked: int = 0
) -> str:
    """A one-sentence, actionable reason the leg from ``source`` to ``target`` fails.

    ``turns_blocked`` is how many directions the search dropped to a turn rule on
    this leg; it lets a purely turn-restricted failure be named as such instead of
    being misattributed to a vehicle ban on a road the route never used.
    """
    if not reaches(graph, source, target, lambda _edge: True):
        if _connected_ignoring_direction(graph, source, target):
            return (
                "The two points are connected, but only by one-way streets running the wrong "
                "direction. Rebuild the network at a higher detail level to get more alternate "
                "routes."
            )
        return (
            "The road network is disconnected between the two points. Rebuild the network at a "
            "different detail level, or choose two points closer together."
        )

    # Reachable when turn rules are ignored but the vehicle and period are honoured,
    # yet the real search (which also honours turn rules) still failed and dropped a
    # direction to one: the turn restrictions are the cause, not a vehicle ban.
    if turns_blocked > 0 and reaches(
        graph,
        source,
        target,
        lambda edge: passable(edge, conditions.vehicle, conditions.period),
    ):
        return (
            "Every route this vehicle could take is closed by a turn restriction (a no-turn or "
            "only-turn sign) in the current time period. Try a different time period, or rebuild "
            "the network at a higher detail level for alternate routes."
        )

    vehicle = vehicle_of(conditions.vehicle)
    available_periods = [
        period
        for period in PERIODS
        if period.key != conditions.period
        and reaches(
            graph,
            source,
            target,
            lambda edge, key=period.key: passable(edge, conditions.vehicle, key),
        )
    ]
    if available_periods and vehicle.curfew:
        names = " or ".join(period.name.lower() for period in available_periods)
        return f"{vehicle.curfew.note}. Switch to the {names} period."

    other_vehicles = [
        candidate
        for candidate in VEHICLES
        if candidate.key != conditions.vehicle
        and reaches(
            graph,
            source,
            target,
            lambda edge, key=candidate.key: passable(edge, key, conditions.period),
        )
    ]
    banned = " and ".join(ROAD_LABEL[road_class] for road_class in vehicle.banned) or (
        "a restricted road"
    )
    if not other_vehicles:
        return (
            f"Every connecting route passes through {banned}, and no listed vehicle can get "
            "through. Rebuild the network at a higher detail level."
        )
    names = " or ".join(candidate.name.lower() for candidate in other_vehicles)
    return (
        f"{vehicle.name} cannot get through because every connecting route passes through "
        f"{banned}. Switch to {names}."
    )
