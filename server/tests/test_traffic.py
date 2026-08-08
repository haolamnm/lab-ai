"""Cost-model spot checks — parity with the rules in web/src/lib/traffic.ts."""

import pytest

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge, RoadClass, TurnTable
from route_lab.shared.traffic import (
    edge_cost,
    edge_minutes,
    min_cost_per_km,
    passable,
    turn_allowed,
)

from .fixtures import shortest_weights


def _edge(
    road_class: RoadClass = "secondary", km: float = 1.0, way_id: int | None = None
) -> GraphEdge:
    return GraphEdge.model_validate(
        {
            "from": "A",
            "to": "B",
            "km": km,
            "roadClass": road_class,
            "congestion": 3,
            "risk": 0.2,
            "wayId": way_id,
        }
    )


def _no_turn(hours: list[tuple[int, int]]) -> TurnTable:
    """A ban on turning from way 1 onto way 2 at B, active only in ``hours``."""
    return TurnTable.model_validate(
        {
            "no": {"B|1|2": [{"kind": "no_left_turn", "hours": hours, "except": []}]},
            "only": {},
        }
    )


def _conditions(vehicle: str = "bike", period: str = "peak") -> Conditions:
    return Conditions.model_validate(
        {"vehicle": vehicle, "period": period, "weights": shortest_weights().model_dump()}
    )


def test_vehicle_bans_by_road_class() -> None:
    # A motorbike is the only vehicle allowed into an alley, and is off motorways.
    assert passable(_edge("alley"), "bike", "peak") is True
    assert passable(_edge("motorway"), "bike", "peak") is False
    # A truck cannot enter an alley at all.
    assert passable(_edge("alley"), "truck", "peak") is False


def test_truck_curfew_is_time_based() -> None:
    # The curfew closes major roads at peak, but lifts off-peak.
    assert passable(_edge("secondary"), "truck", "peak") is False
    assert passable(_edge("secondary"), "truck", "offpeak") is True


def test_distance_only_cost_equals_kilometres() -> None:
    conditions = _conditions()
    assert edge_cost(_edge(km=2.0), conditions) == 2.0
    assert edge_minutes(_edge(km=2.0), conditions) > 0


def test_min_cost_per_km_over_passable_edges() -> None:
    conditions = _conditions()
    # Distance-only, so cost/km is 1.0 for every edge.
    assert min_cost_per_km([_edge(km=1.0), _edge(km=2.0)], conditions) == 1.0
    # No passable edge -> a zero floor, never infinity.
    assert min_cost_per_km([_edge("motorway")], _conditions("bike")) == 0.0


def test_turn_allowed_without_a_turn_table() -> None:
    assert turn_allowed(None, "A", _edge(), _edge(), _conditions()) is True


@pytest.mark.parametrize(
    ("hours", "blocked_period", "allowed_period"),
    [
        # Measured on OpenStreetMap data for central HCMC, 491 of 757 turn
        # restrictions are `restriction:conditional` — restricted by time of day —
        # so the window is the common case, not the exception. Windows are in
        # minutes since midnight; each period resolves to one representative clock
        # (peak 17:30, off-peak 13:00, night 22:00).
        ([(16 * 60, 19 * 60)], "peak", "night"),
        # A window that runs past midnight, where start > end and the ordinary
        # `start <= minute < end` test is inverted.
        ([(22 * 60, 6 * 60)], "night", "peak"),
    ],
)
def test_a_time_conditional_turn_rule_applies_only_inside_its_window(
    hours: list[tuple[int, int]],
    blocked_period: str,
    allowed_period: str,
) -> None:
    turns = _no_turn(hours)
    arriving = _edge(way_id=1)
    leaving = _edge(way_id=2)

    assert turn_allowed(turns, "B", arriving, leaving, _conditions(period=blocked_period)) is False
    assert turn_allowed(turns, "B", arriving, leaving, _conditions(period=allowed_period)) is True
