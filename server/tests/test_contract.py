"""The HTTP contract: /plan round-trips camelCase JSON into a RouteResult."""

from fastapi.testclient import TestClient

from route_lab.api import app
from route_lab.contract.request import PlanRequest

from .fixtures import diamond_json

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_plan_returns_a_route_result_in_camelcase() -> None:
    response = client.post("/plan", json=diamond_json("ucs"))
    assert response.status_code == 200

    body = response.json()
    assert body["found"] is True
    assert body["algo"] == "ucs"
    assert body["path"] == ["A", "B", "D"]
    # nodeIds is the index-to-id lookup the trace's node indices point back into.
    assert body["nodeIds"] == ["A", "B", "C", "D"]

    # The response uses the same camelCase keys the frontend's types.ts declares.
    metrics = body["metrics"]
    for key in ("km", "minutes", "cost", "hops", "expanded", "maxFrontier", "turnsBlocked"):
        assert key in metrics, key


def test_plan_accepts_a_graph_that_still_carries_adj() -> None:
    # The client is meant to strip the derived `adj` index, but a payload that
    # forgets to must still be accepted (extra fields are ignored, not rejected).
    payload = diamond_json("ucs")
    payload["graph"]["adj"] = {"A": []}
    response = client.post("/plan", json=payload)
    assert response.status_code == 200
    assert response.json()["found"] is True


def test_optimise_order_defaults_to_false() -> None:
    payload = diamond_json("ucs")
    payload.pop("optimiseOrder")

    assert PlanRequest.model_validate(payload).optimise_order is False


def test_greedy_algorithm_is_rejected() -> None:
    assert client.post("/plan", json=diamond_json("greedy")).status_code == 422


def test_negative_weight_is_rejected_at_the_boundary() -> None:
    # A negative weight can drive an edge cost below zero and silently break the
    # optimality UCS/A* rely on, so it is a 422 here, not an accepted request.
    payload = diamond_json("ucs")
    payload["conditions"]["weights"]["distance"] = -1.0
    response = client.post("/plan", json=payload)
    assert response.status_code == 422


def test_unknown_enum_values_are_rejected() -> None:
    # algo, vehicle, and roadClass are closed sets; a value outside them is a
    # malformed request, caught by the contract rather than reaching the planner.
    bad_algo = diamond_json("dijkstra")  # not an AlgoKey
    assert client.post("/plan", json=bad_algo).status_code == 422

    bad_vehicle = diamond_json("ucs")
    bad_vehicle["conditions"]["vehicle"] = "spaceship"
    assert client.post("/plan", json=bad_vehicle).status_code == 422

    bad_road = diamond_json("ucs")
    bad_road["graph"]["edges"][0]["roadClass"] = "runway"
    assert client.post("/plan", json=bad_road).status_code == 422
