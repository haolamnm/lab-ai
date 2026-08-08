"""The HTTP surface: /plan round-trips camelCase JSON into a RouteResult.

This endpoint is public and unauthenticated, so everything the cost model and the
search assume about their inputs is enforced here rather than trusted, and every
rejection is a 422 naming the field instead of a 500 further in.
"""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from route_lab.api import app, cors_origins
from route_lab.contract.graph import GraphPayload
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


@pytest.mark.parametrize(
    ("wire_value", "model_value"),
    [(True, True), (False, False), (None, None)],
)
def test_return_to_start_uses_camelcase_alias(
    wire_value: bool | None,
    model_value: bool | None,
) -> None:
    payload = diamond_json("ucs")
    payload["returnToStart"] = wire_value

    request = PlanRequest.model_validate(payload)

    assert request.return_to_start is model_value
    dumped = request.model_dump(mode="json", by_alias=True)
    assert dumped["returnToStart"] is model_value
    assert "optimiseOrder" in dumped


def test_return_to_start_defaults_to_legacy_none() -> None:
    assert PlanRequest.model_validate(diamond_json("ucs")).return_to_start is None


def test_invalid_return_to_start_is_rejected() -> None:
    payload = diamond_json("ucs")
    payload["returnToStart"] = [True]

    assert client.post("/plan", json=payload).status_code == 422


def test_goal_remains_required() -> None:
    payload = diamond_json("ucs")
    del payload["goal"]

    assert client.post("/plan", json=payload).status_code == 422


def test_greedy_algorithm_is_rejected() -> None:
    # `greedy` was a real key once and was removed. A client still pinned to the
    # old build must get a 422 naming `algo`, not a 500 from a registry lookup.
    assert client.post("/plan", json=diamond_json("greedy")).status_code == 422


def test_an_unknown_request_field_is_rejected() -> None:
    # The misspelling that motivates `extra="forbid"`: silently ignoring it gave
    # the client an unordered trip and no way to find out why.
    payload = diamond_json("ucs")
    payload["optimizeOrder"] = True

    assert client.post("/plan", json=payload).status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [
        # A negative or zero-length segment drives the edge cost to zero or below,
        # which breaks the "first settled arrival is the cheapest" invariant UCS
        # and A* rest on. Congestion below 1 does the same through the cost
        # formula, and a risk above 1 just misreports a route as more dangerous
        # than the scale can express.
        ("km", -5.0),
        ("km", 0.0),
        ("congestion", -5),
        ("congestion", 6),
        ("risk", 2.0),
        ("risk", -0.1),
    ],
)
def test_out_of_range_edge_values_are_rejected(field: str, value: float) -> None:
    payload = diamond_json("ucs")
    payload["graph"]["edges"][0][field] = value

    assert client.post("/plan", json=payload).status_code == 422


@pytest.mark.parametrize(("field", "value"), [("lat", 91.0), ("lng", -181.0)])
def test_out_of_range_coordinates_are_rejected(field: str, value: float) -> None:
    # The heuristics take a cosine of the latitude, so a nonsense coordinate
    # makes every estimate nonsense too.
    payload = diamond_json("ucs")
    payload["graph"]["nodes"]["A"][field] = value

    assert client.post("/plan", json=payload).status_code == 422


def test_non_finite_geometry_is_rejected() -> None:
    # JSON has no literal for infinity, but `1e999` decodes to one, so the only
    # thing standing between a client and a graph of `nan` estimates — which lose
    # every comparison A* orders its frontier with — is `allow_inf_nan=False`.
    payload = json.loads('{"lat": 1e999, "lng": 1e999, "id": "A"}')
    graph = diamond_json("ucs")["graph"]
    graph["nodes"]["A"] = payload

    with pytest.raises(ValidationError):
        GraphPayload.model_validate(graph)


@pytest.mark.parametrize("stops", [["B", "B"], ["B", "C", "B"]])
def test_repeated_stops_are_rejected(stops: list[str]) -> None:
    # Held-Karp cannot express one location twice and Nearest Neighbor used to
    # drop the repeat by accident. One answer for every algorithm: refuse it.
    payload = diamond_json("ucs")
    payload["stops"] = stops

    assert client.post("/plan", json=payload).status_code == 422


@pytest.mark.parametrize("field", ["bounds", "detail"])
def test_the_graph_viewport_fields_are_optional(field: str) -> None:
    # Nothing in the planner reads either one; a caller that is not the app
    # should not have to invent a map viewport to plan a route.
    payload: dict[str, Any] = diamond_json("ucs")
    del payload["graph"][field]

    assert client.post("/plan", json=payload).status_code == 200


def test_cors_origins_are_split_and_trimmed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROUTELAB_CORS_ORIGINS", " https://a.example , ,https://b.example ")

    assert cors_origins() == ["https://a.example", "https://b.example"]


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
