"""why_blocked names the real cause of a failed leg, not a plausible-looking one."""

from route_lab.contract.request import PlanRequest
from route_lab.diagnostics import why_blocked
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph

from .fixtures import diamond_payload, turn_blocked_json


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


def test_disconnected_points_are_named_as_disconnected() -> None:
    # A and D are not linked at all once C -> D is the only way in and it is absent:
    # build a request the planner never routes, and ask the diagnostic directly.
    graph = build_graph(diamond_payload())
    conditions = PlanRequest.model_validate(
        {
            "graph": {"nodes": {}, "edges": [], "bounds": [[0, 0], [0, 0]], "detail": "coarse"},
            "algo": "ucs",
            "start": "A",
            "goal": "D",
            "stops": [],
            "optimiseOrder": False,
            "conditions": {
                "vehicle": "bike",
                "period": "peak",
                "weights": {"distance": 1, "time": 0, "congestion": 0, "risk": 0},
            },
        }
    ).conditions

    # "X" is isolated: no edges touch it, so no route can reach D from it.
    message = why_blocked(graph, "A", "X", conditions, turns_blocked=0)
    assert "disconnected" in message
