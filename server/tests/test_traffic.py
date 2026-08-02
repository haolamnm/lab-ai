"""Cost-model spot checks — parity with the rules in web/src/lib/traffic.ts."""

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge, RoadClass
from route_lab.shared.traffic import (
    edge_cost,
    edge_minutes,
    min_cost_per_km,
    passable,
    turn_allowed,
)

from .fixtures import shortest_weights


def _edge(road_class: RoadClass = "secondary", km: float = 1.0) -> GraphEdge:
    return GraphEdge.model_validate(
        {"from": "A", "to": "B", "km": km, "roadClass": road_class, "congestion": 3, "risk": 0.2}
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
