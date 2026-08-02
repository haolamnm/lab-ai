"""A trip pinned to a node that isn't in the graph fails gracefully, never a 500."""

import pytest
from fastapi.testclient import TestClient

from route_lab.api import app
from route_lab.contract.request import PlanRequest
from route_lab.planner import plan_route

from .fixtures import diamond_json

client = TestClient(app)


@pytest.mark.parametrize("field", ["start", "goal"])
def test_unknown_point_returns_a_problem_not_an_exception(field: str) -> None:
    payload = diamond_json("ucs")
    payload[field] = "GHOST"
    result = plan_route(PlanRequest.model_validate(payload))

    assert result.found is False
    assert result.problem is not None
    assert "GHOST" in result.problem
    # Still a well-formed result: the node lookup is present, there is just no route.
    assert result.path == []
    assert result.node_ids == ["A", "B", "C", "D"]


def test_unknown_stop_is_reported() -> None:
    payload = diamond_json("ucs")
    payload["stops"] = ["GHOST"]
    result = plan_route(PlanRequest.model_validate(payload))

    assert result.found is False
    assert result.problem is not None and "GHOST" in result.problem


def test_unknown_point_stays_http_200() -> None:
    # The whole reason this is validated in the planner rather than left to raise:
    # a stale pin from a rebuilt graph must read as a message in the pane, not a
    # server crash.
    payload = diamond_json("ucs")
    payload["start"] = "GHOST"
    response = client.post("/plan", json=payload)
    assert response.status_code == 200
    assert response.json()["found"] is False
