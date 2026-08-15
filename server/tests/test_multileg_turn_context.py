"""A stop boundary must not erase the incoming road used by UCS or NN."""

import pytest

from route_lab.contract.request import PlanRequest
from route_lab.planner import plan_route


def _request(algo: str, *, optimise_order: bool = False) -> PlanRequest:
    edge_defaults = {"roadClass": "secondary", "congestion": 1, "risk": 0.0}
    return PlanRequest.model_validate(
        {
            "graph": {
                "nodes": {
                    "S": {"id": "S", "lat": 10.000, "lng": 106.000},
                    "A": {"id": "A", "lat": 10.001, "lng": 106.001},
                    "C": {"id": "C", "lat": 10.002, "lng": 106.002},
                    "B": {"id": "B", "lat": 10.003, "lng": 106.003},
                    "G": {"id": "G", "lat": 10.004, "lng": 106.004},
                },
                "edges": [
                    {"from": "S", "to": "A", "km": 1, "wayId": 1, **edge_defaults},
                    {"from": "A", "to": "B", "km": 1, "wayId": 2, **edge_defaults},
                    {"from": "A", "to": "C", "km": 2, "wayId": 3, **edge_defaults},
                    {"from": "C", "to": "B", "km": 1, "wayId": 4, **edge_defaults},
                    {"from": "B", "to": "G", "km": 1, "wayId": 5, **edge_defaults},
                ],
                "turns": {
                    "no": {"A|1|2": [{"kind": "no_left_turn", "hours": [], "except": []}]},
                    "only": {},
                },
            },
            "algo": algo,
            "start": "S",
            "stops": ["A", "B", "C"] if optimise_order else ["A"],
            "goal": "G" if optimise_order else "B",
            "optimiseOrder": optimise_order,
            "returnToStart": False,
            "conditions": {
                "vehicle": "van",
                "period": "peak",
                "weights": {"distance": 1, "time": 0, "congestion": 0, "risk": 0},
            },
        }
    )


@pytest.mark.parametrize("algo", ["ucs", "nearest"])
def test_multileg_search_carries_turn_context(algo: str) -> None:
    result = plan_route(_request(algo))

    assert result.found is True
    assert result.order == ["S", "A", "B"]
    assert result.path == ["S", "A", "C", "B"]
    assert result.metrics.turns_blocked >= 1


def test_optimised_ucs_interleaves_ordering_with_real_turn_context() -> None:
    result = plan_route(_request("ucs", optimise_order=True))

    assert result.found is True
    assert result.order == ["S", "A", "C", "B", "G"]
    assert result.path == ["S", "A", "C", "B", "G"]
