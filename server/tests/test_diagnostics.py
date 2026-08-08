"""why_blocked names the real cause of a failed leg, not a plausible-looking one.

Every branch of the diagnostic ends in a different instruction to the user —
change the period, change the vehicle, rebuild the network — so naming the wrong
cause is worse than saying nothing: it sends them to fix something that is not
broken.
"""

from typing import Any

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphPayload
from route_lab.contract.request import PlanRequest
from route_lab.diagnostics import why_blocked
from route_lab.planner import plan_route
from route_lab.shared.graph import Graph, build_graph

from .fixtures import diamond_payload, diamond_request, turn_blocked_json


def _conditions(vehicle: str = "bike") -> Conditions:
    return Conditions.model_validate(
        {
            "vehicle": vehicle,
            "period": "peak",
            "weights": diamond_request().conditions.weights.model_dump(),
        }
    )


def _chain(*classes: str) -> Graph:
    """A straight line of one-way segments, one per road class named."""
    node_ids = [chr(ord("A") + index) for index in range(len(classes) + 1)]
    edges: list[dict[str, Any]] = [
        {"from": node_ids[index], "to": node_ids[index + 1], "km": 1.0, "roadClass": road_class}
        for index, road_class in enumerate(classes)
    ]
    return build_graph(
        GraphPayload.model_validate(
            {
                "nodes": {
                    node_id: {"id": node_id, "lat": 10.0, "lng": 106.0 + index * 0.001}
                    for index, node_id in enumerate(node_ids)
                },
                "edges": [{"congestion": 1, "risk": 0.0, **edge} for edge in edges],
            }
        )
    )


def test_turn_restriction_blocks_the_only_route_and_is_counted() -> None:
    result = plan_route(PlanRequest.model_validate(turn_blocked_json()))

    assert result.found is False
    assert result.metrics.turns_blocked == 1


def test_why_blocked_reports_a_turn_restriction_not_a_vehicle_ban() -> None:
    result = plan_route(PlanRequest.model_validate(turn_blocked_json()))

    assert result.problem is not None
    assert "turn restriction" in result.problem
    # The old bug blamed a road class and told the user to switch vehicles, which
    # fixes nothing when an all-day, no-exemption turn rule is the real cause.
    assert "Switch to" not in result.problem


def test_a_point_absent_from_the_graph_reads_as_disconnected() -> None:
    # "X" is not a node in the diamond at all, so nothing can reach it. The
    # diagnostic has no way to tell that apart from a node in its own severed
    # component, and both want the same fix, so both get the same sentence.
    message = why_blocked(build_graph(diamond_payload()), "A", "X", _conditions(), 0)

    assert "disconnected" in message


def test_a_route_that_exists_only_backwards_is_named_as_one_way() -> None:
    # The most common real failure on OpenStreetMap data: 73% of the ways fetched
    # for central HCMC are one-way, so a dropoff one block "behind" the pickup is
    # routinely connected on the map and unreachable in the direction asked for.
    message = why_blocked(build_graph(diamond_payload()), "D", "A", _conditions(), 0)

    assert "one-way" in message
    assert "disconnected" not in message


def test_a_truck_curfew_names_the_period_not_the_vehicle() -> None:
    # The diamond is all major roads, which a truck may use — but not at peak.
    # The fix is a different time period, so the message must offer one; telling
    # the driver to switch to a motorbike would not deliver the load.
    message = why_blocked(build_graph(diamond_payload()), "A", "D", _conditions("truck"), 0)

    assert "Truck curfew" in message
    assert "off-peak or night period" in message


def test_a_vehicle_ban_offers_a_vehicle_that_gets_through() -> None:
    message = why_blocked(_chain("alley"), "A", "B", _conditions("van"), 0)

    assert "Van cannot get through" in message
    assert "alley" in message
    assert "Switch to motorbike" in message


def test_a_route_no_vehicle_can_take_says_so_instead_of_naming_one() -> None:
    # An alley then an expressway: the motorbike is the only vehicle allowed in
    # the first and the only one banned from the second, so the answer is not
    # "switch" but "rebuild the network".
    message = why_blocked(_chain("alley", "motorway"), "A", "C", _conditions("van"), 0)

    assert "no listed vehicle can get through" in message
