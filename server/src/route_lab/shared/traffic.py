"""The cost model — the Python side of web/src/lib/traffic.ts.

Vehicles, time periods, road-class speeds, and the weighted cost function the
search minimises. Every constant and its reasoning is kept identical to the
frontend so a route planned here matches one the browser would have planned; the
long comments explaining *why* a constant has its value live in traffic.ts and
are not repeated here, only pointed at.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from route_lab.contract.conditions import Conditions, PeriodKey, VehicleKey, Weights
from route_lab.contract.graph import GraphEdge, RoadClass, TurnRule, TurnTable


@dataclass(frozen=True)
class Curfew:
    """A time-based ban on a set of road classes — the inner-city truck curfew."""

    periods: tuple[PeriodKey, ...]
    classes: tuple[RoadClass, ...]
    note: str


@dataclass(frozen=True)
class Vehicle:
    """A delivery vehicle. See traffic.ts for the measurements behind each value."""

    key: VehicleKey
    name: str
    # Open-road speed multiplier. A motorbike is NOT faster than a car here; its
    # advantage is jam_sensitivity.
    speed: float
    # How much congestion slows it. Below 1 for a motorbike, which weaves through.
    jam_sensitivity: float
    # Multiplied against a segment's risk factor.
    risk_factor: float
    # Road classes never usable, regardless of time period.
    banned: tuple[RoadClass, ...]
    # OpenStreetMap keywords that exempt this vehicle from a turn restriction.
    osm_except: tuple[str, ...]
    # Road classes banned only during certain periods.
    curfew: Curfew | None = None


VEHICLES: tuple[Vehicle, ...] = (
    Vehicle(
        key="bike",
        name="Motorbike",
        speed=0.95,
        jam_sensitivity=0.55,
        risk_factor=1.3,
        banned=("motorway",),
        osm_except=("motorcycle", "moped", "mofa"),
    ),
    Vehicle(
        key="van",
        name="Van",
        speed=1.0,
        jam_sensitivity=1.0,
        risk_factor=1.0,
        banned=("alley",),
        osm_except=(),
    ),
    Vehicle(
        key="car",
        name="Car",
        speed=1.10,
        jam_sensitivity=1.15,
        risk_factor=0.8,
        banned=("alley",),
        osm_except=(),
    ),
    Vehicle(
        key="truck",
        name="Truck",
        speed=0.75,
        jam_sensitivity=1.25,
        risk_factor=1.6,
        banned=("residential", "alley"),
        osm_except=("hgv", "goods"),
        curfew=Curfew(
            periods=("peak",),
            classes=("tertiary", "secondary"),
            note=(
                "Truck curfew: not allowed on inner-city branch roads and major "
                "roads during peak hours"
            ),
        ),
    ),
)

_VEHICLE_BY_KEY: dict[VehicleKey, Vehicle] = {v.key: v for v in VEHICLES}


def vehicle_of(key: VehicleKey) -> Vehicle:
    return _VEHICLE_BY_KEY[key]


@dataclass(frozen=True)
class Period:
    key: PeriodKey
    name: str
    # Congestion multiplier. Time of day acts on congestion, not base speed —
    # see the long comment in traffic.ts for why.
    jam: float


PERIODS: tuple[Period, ...] = (
    Period(key="peak", name="Peak", jam=1.00),
    Period(key="offpeak", name="Off-peak", jam=0.55),
    Period(key="night", name="Night", jam=0.18),
)

_PERIOD_BY_KEY: dict[PeriodKey, Period] = {p.key: p for p in PERIODS}


def period_of(key: PeriodKey) -> Period:
    return _PERIOD_BY_KEY[key]


# Open-road speed by road class, km/h, before subtracting congestion.
CLASS_SPEED: dict[RoadClass, float] = {
    "motorway": 60,
    "trunk": 45,
    "primary": 32,
    "secondary": 26,
    "tertiary": 22,
    "residential": 16,
    "alley": 11,
}

# Display name per road class, so a blocked-route message reads naturally.
ROAD_LABEL: dict[RoadClass, str] = {
    "motorway": "expressway",
    "trunk": "national highway",
    "primary": "main road",
    "secondary": "major road",
    "tertiary": "branch road",
    "residential": "residential road",
    "alley": "alley",
}

# One representative clock time per period, minutes since midnight, so an
# OpenStreetMap time-conditional turn restriction resolves to a clear yes/no.
_PERIOD_CLOCK: dict[PeriodKey, int] = {
    "peak": 17 * 60 + 30,
    "offpeak": 13 * 60,
    "night": 22 * 60,
}


def clamp_congestion(n: float) -> float:
    """Clamp to 1-5. Below 1 makes ``edge_cost`` negative, which silently breaks
    the optimality guarantee UCS and A* rely on."""
    return min(5.0, max(1.0, n))


def clamp_risk(n: float) -> float:
    """Clamp to 0-1, for the same reason ``clamp_congestion`` exists."""
    return min(1.0, max(0.0, n))


def cost_is_flat(w: Weights) -> bool:
    """True when every weight is 0, so every route costs 0 and "optimal" would be
    a meaningless stamp. The planner withdraws the optimal claim in that case."""
    return w.distance == 0 and w.time == 0 and w.congestion == 0 and w.risk == 0


def _within(minute: int, window: tuple[int, int]) -> bool:
    start, end = window
    if start <= end:
        return start <= minute < end
    # A window that wraps past midnight, e.g. 22:00-06:00.
    return minute >= start or minute < end


def ban_reason(edge: GraphEdge, vehicle: VehicleKey, period: PeriodKey) -> str | None:
    """Why this vehicle cannot use this segment now, or None if it can."""
    v = vehicle_of(vehicle)
    if edge.road_class in v.banned:
        return f"{v.name} is banned from {ROAD_LABEL[edge.road_class]}s"
    if v.curfew and period in v.curfew.periods and edge.road_class in v.curfew.classes:
        return v.curfew.note
    return None


def passable(edge: GraphEdge, vehicle: VehicleKey, period: PeriodKey) -> bool:
    """Whether this vehicle can use this segment during this period."""
    return ban_reason(edge, vehicle, period) is None


def turn_allowed(
    turns: TurnTable | None,
    via: str,
    from_edge: GraphEdge,
    to_edge: GraphEdge,
    conditions: Conditions,
) -> bool:
    """Whether turning from one segment onto another is legal at an intersection.

    A turn restriction constrains a *pair* of segments, not a node, which is why
    it cannot fold into ``passable``.
    """
    if turns is None or from_edge.way_id is None or to_edge.way_id is None:
        return True
    clock = _PERIOD_CLOCK[conditions.period]
    mine = vehicle_of(conditions.vehicle).osm_except

    def active(rule: TurnRule) -> bool:
        in_window = not rule.hours or any(_within(clock, h) for h in rule.hours)
        exempt = any(x in mine for x in rule.except_)
        return in_window and not exempt

    banned = turns.no.get(f"{via}|{from_edge.way_id}|{to_edge.way_id}")
    if banned and any(active(r) for r in banned):
        return False

    # An "only direction X" rule bans every other outgoing direction.
    only = turns.only.get(f"{via}|{from_edge.way_id}")
    return not (only and any(active(r) and r.only_to != to_edge.way_id for r in only))


def edge_minutes(edge: GraphEdge, c: Conditions) -> float:
    """Time to traverse the segment, in minutes."""
    v = vehicle_of(c.vehicle)
    # Congestion pulls speed down; a motorbike is affected less because it weaves,
    # and the period sets whether the segment is congested right now.
    jam = 1 + (edge.congestion - 1) * 0.42 * v.jam_sensitivity * period_of(c.period).jam
    speed = (CLASS_SPEED[edge.road_class] * v.speed) / jam
    return (edge.km / speed) * 60


def edge_cost(edge: GraphEdge, c: Conditions) -> float:
    """The weighted cost of a segment.

    Congestion and risk are multiplied by length, not added as a flat lump, so a
    route across many short blocks is not penalised for its intersection count.
    """
    w = c.weights
    v = vehicle_of(c.vehicle)
    return (
        w.distance * edge.km
        + w.time * edge_minutes(edge, c)
        + w.congestion * edge.congestion * edge.km
        + w.risk * edge.risk * v.risk_factor * edge.km
    )


def min_cost_per_km(edges: Iterable[GraphEdge], conditions: Conditions) -> float:
    """The cheapest cost-per-km over any passable segment.

    A* scales its straight-line heuristic by this so it stays a lower
    bound (admissible) while remaining tight enough to prune real work. Using raw
    kilometres instead would make the heuristic far too weak and A* would
    degenerate into UCS.
    """
    cheapest = float("inf")
    for edge in edges:
        if not passable(edge, conditions.vehicle, conditions.period) or edge.km <= 0:
            continue
        cheapest = min(cheapest, edge_cost(edge, conditions) / edge.km)
    return cheapest if cheapest != float("inf") else 0.0
