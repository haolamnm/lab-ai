"""A trip the planner cannot run fails gracefully, never as an HTTP 500.

A stale pin, a degenerate query, and a leg with no route are all things a user
can produce by clicking; each has to come back as a result whose ``problem``
says what to change.
"""

import pytest
from fastapi.testclient import TestClient

from route_lab.api import app
from route_lab.contract.request import PlanRequest
from route_lab.planner import plan_route

from .fixtures import diamond_json, trip_request

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


@pytest.mark.parametrize("algo", ["bfs", "dfs", "ucs", "astar"])
def test_a_point_search_from_a_node_to_itself_is_refused(algo: str) -> None:
    # Dropping the pin twice on one intersection is a click away in the app, and
    # a zero-leg trip has nothing to compare between algorithms.
    payload = diamond_json(algo)
    payload["goal"] = payload["start"]
    result = plan_route(PlanRequest.model_validate(payload))

    assert result.found is False
    assert result.problem is not None and "same intersection" in result.problem
    assert result.order == []


@pytest.mark.parametrize(
    ("edges", "expected_prefix", "expected_km"),
    [
        # Only the second half of the trip exists, so the first leg fails and
        # nothing has been travelled yet.
        ([("A", "B", 1.0)], "Leg 1/2", 0.0),
        # Only the first half exists: the completed leg's distance is still
        # reported, because it is work the trip really did.
        ([("W", "A", 1.0)], "Leg 2/2", 1.0),
    ],
)
def test_a_blocked_leg_is_numbered_within_the_trip(
    edges: list[tuple[str, str, float]],
    expected_prefix: str,
    expected_km: float,
) -> None:
    # "Unreachable" is useless on a multi-stop trip when the user cannot tell
    # which hop failed, so the reason is prefixed with the leg's position.
    result = plan_route(trip_request("ucs", start="W", stops=["A"], goal="B", edges=edges))

    assert result.found is False
    assert result.problem is not None
    assert result.problem.startswith(f"{expected_prefix} is blocked.")
    assert result.metrics.km == expected_km
    # The blocked leg's search effort is reported even though it arrived nowhere.
    assert result.metrics.expanded > 0


def test_unknown_point_stays_http_200() -> None:
    # The whole reason this is validated in the planner rather than left to raise:
    # a stale pin from a rebuilt graph must read as a message in the pane, not a
    # server crash.
    payload = diamond_json("ucs")
    payload["start"] = "GHOST"
    response = client.post("/plan", json=payload)
    assert response.status_code == 200
    assert response.json()["found"] is False
