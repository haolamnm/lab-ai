"""The test graphs have to be geometrically possible, because A* believes they are.

``haversine_heuristic`` estimates the cost remaining as the straight-line distance
to the goal times the cheapest cost-per-km in the network. That is admissible — it
can never overestimate — only while every road is at least as long as the straight
line between the intersections it joins. A graph fetched from Overpass satisfies it
by construction, because ``km`` is measured from the road's own polyline. These
fixtures set ``km`` by hand next to coordinates set by hand, so nothing enforces it
but this.

It is worth pinning even though the searches currently agree: an inadmissible
heuristic does not fail loudly, it just quietly returns a costlier route while the
result still carries ``optimal=True``. A fixture that drifts here would stop
testing A* under the conditions its guarantee needs, and every A* test would go on
passing.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from route_lab.contract.graph import GraphPayload
from route_lab.shared.geo import haversine
from route_lab.shared.graph import build_graph

from .fixtures import diamond_payload, trip_json, turn_blocked_json


def _payloads() -> Iterator[tuple[str, GraphPayload]]:
    yield "diamond", diamond_payload()
    yield "trip", GraphPayload.model_validate(trip_json("ucs")["graph"])
    yield "turn_blocked", GraphPayload.model_validate(turn_blocked_json()["graph"])


@pytest.mark.parametrize(("name", "payload"), list(_payloads()))
def test_no_edge_is_shorter_than_the_straight_line_it_spans(
    name: str, payload: GraphPayload
) -> None:
    graph = build_graph(payload)
    impossible = [
        f"{edge.from_}->{edge.to} km={edge.km} but its endpoints are "
        f"{haversine(graph.nodes[edge.from_], graph.nodes[edge.to]):.3f} km apart"
        for edge in payload.edges
        if edge.km < haversine(graph.nodes[edge.from_], graph.nodes[edge.to]) - 1e-9
    ]

    assert impossible == [], f"{name}: {impossible}"
