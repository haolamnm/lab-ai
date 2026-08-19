from __future__ import annotations

from collections.abc import Mapping

import route_lab.planner as planner
from route_lab.algorithms.context_held_karp import context_held_karp
from route_lab.algorithms.destination_labels import (
    ContextRouteKey,
    DestinationLabel,
)
from route_lab.contract.request import PlanRequest


def _label(
    source: str,
    target: str,
    cost: float,
    final_way: int,
    *,
    via: str | None = None,
) -> DestinationLabel:
    path = (source, target) if via is None else (source, via, target)
    return DestinationLabel(final_incoming_way=final_way, cost=cost, path=path, edges=())


class FakeProvider:
    def __init__(
        self,
        transitions: Mapping[tuple[str, int | None, str], Mapping[int | None, DestinationLabel]],
    ) -> None:
        self._transitions = dict(transitions)
        self._routes: dict[ContextRouteKey, DestinationLabel] = {}
        self.calls: list[tuple[str, int | None, str]] = []

    def transitions(
        self, source: str, incoming_way: int | None, target: str
    ) -> Mapping[int | None, DestinationLabel]:
        query = (source, incoming_way, target)
        self.calls.append(query)
        labels = self._transitions.get(query, {})
        for final_way, label in labels.items():
            self._routes[ContextRouteKey(source, incoming_way, target, final_way)] = label
        return labels

    def route(self, key: ContextRouteKey) -> DestinationLabel:
        return self._routes[key]


def test_more_expensive_arrival_label_wins_globally_on_open_tour() -> None:
    provider = FakeProvider(
        {
            ("W", None, "B"): {
                10: _label("W", "B", 5, 10, via="cheap"),
                20: _label("W", "B", 6, 20, via="useful"),
            },
            ("B", 10, "G"): {30: _label("B", "G", 100, 30)},
            ("B", 20, "G"): {40: _label("B", "G", 1, 40)},
            ("W", None, "G"): {50: _label("W", "G", 50, 50)},
            ("G", 50, "B"): {60: _label("G", "B", 50, 60)},
        }
    )

    result = context_held_karp(
        warehouse="W",
        stops=["B", "G"],
        transitions=provider,
        return_to_start=False,
        end="G",
    )

    assert result.found is True
    assert result.cost == 7
    assert result.order == ("W", "B", "G")
    assert result.route_keys[0].target_incoming_way == 20
    assert result.route_keys[1].source_incoming_way == 20


def test_context_specific_unreachable_transition_does_not_kill_other_label() -> None:
    provider = FakeProvider(
        {
            ("W", None, "B"): {
                10: _label("W", "B", 1, 10),
                20: _label("W", "B", 2, 20),
            },
            # B,way10 -> G is deliberately absent.
            ("B", 20, "G"): {30: _label("B", "G", 1, 30)},
        }
    )

    result = context_held_karp("W", ["B", "G"], provider, return_to_start=False, end="G")

    assert result.found is True
    assert result.cost == 3
    assert result.route_keys[0].target_incoming_way == 20


def test_closed_tour_return_uses_last_destination_context() -> None:
    provider = FakeProvider(
        {
            ("W", None, "X"): {
                10: _label("W", "X", 1, 10),
                20: _label("W", "X", 2, 20),
            },
            # Only the more expensive arrival can return to W.
            ("X", 20, "W"): {30: _label("X", "W", 1, 30)},
        }
    )

    result = context_held_karp("W", ["X"], provider, return_to_start=True)

    assert result.found is True
    assert result.cost == 3
    assert result.order == ("W", "X", "W")
    assert result.route_keys[-1].source_incoming_way == 20


def test_context_ties_follow_input_stop_order_deterministically() -> None:
    provider = FakeProvider(
        {
            ("W", None, "A"): {10: _label("W", "A", 1, 10)},
            ("W", None, "B"): {20: _label("W", "B", 1, 20)},
            ("A", 10, "B"): {30: _label("A", "B", 1, 30)},
            ("B", 20, "A"): {40: _label("B", "A", 1, 40)},
        }
    )

    result = context_held_karp("W", ["A", "B"], provider, return_to_start=False)

    assert result.order == ("W", "A", "B")


def _turn_request() -> PlanRequest:
    edge_defaults = {"roadClass": "secondary", "congestion": 1, "risk": 0.0}
    return PlanRequest.model_validate(
        {
            "graph": {
                "nodes": {
                    node: {"id": node, "lat": 10.0, "lng": 106.0 + index * 0.0001}
                    for index, node in enumerate(("S", "A", "D", "B"))
                },
                "edges": [
                    {"from": "S", "to": "A", "km": 1, "wayId": 1, **edge_defaults},
                    {"from": "A", "to": "B", "km": 1, "wayId": 2, **edge_defaults},
                    {"from": "A", "to": "D", "km": 2, "wayId": 3, **edge_defaults},
                    {"from": "D", "to": "B", "km": 2, "wayId": 4, **edge_defaults},
                ],
                "turns": {
                    "no": {"A|1|2": [{"kind": "no_left_turn", "hours": [], "except": []}]},
                    "only": {},
                },
            },
            "algo": "held_karp",
            "start": "S",
            "stops": ["A"],
            "goal": "B",
            "returnToStart": False,
            "conditions": {
                "vehicle": "bike",
                "period": "peak",
                "weights": {"distance": 1, "time": 0, "congestion": 0, "risk": 0},
            },
        }
    )


def test_planner_does_not_concatenate_an_illegal_cross_leg_turn() -> None:
    request = _turn_request()

    # Characterize the old abstraction: independent A->B starts without context
    # and therefore takes the otherwise-forbidden direct way 2.
    graph = planner.build_graph(request.graph)
    scalar = planner.build_pairwise(
        graph=graph,
        locations=["S", "A", "B"],
        conditions=request.conditions,
        search=planner.a_star_search,
    )
    assert scalar.paths[("A", "B")].path == ["A", "B"]

    result = planner.plan_route(request)

    assert result.found is True
    assert result.order == ["S", "A", "B"]
    assert result.path == ["S", "A", "D", "B"]
    assert result.metrics.cost == 5.0
    assert result.metrics.optimal is True


def _context_request(
    *,
    nodes: tuple[str, ...],
    edges: list[tuple[str, str, float, int]],
    turns: dict[str, object],
    start: str,
    goal: str,
    stops: list[str],
    return_to_start: bool,
) -> PlanRequest:
    edge_defaults = {"roadClass": "secondary", "congestion": 1, "risk": 0.0}
    return PlanRequest.model_validate(
        {
            "graph": {
                "nodes": {
                    node: {"id": node, "lat": 10.0, "lng": 106.0 + index * 0.0001}
                    for index, node in enumerate(nodes)
                },
                "edges": [
                    {
                        "from": source,
                        "to": target,
                        "km": cost,
                        "wayId": way,
                        **edge_defaults,
                    }
                    for source, target, cost, way in edges
                ],
                "turns": turns,
            },
            "algo": "held_karp",
            "start": start,
            "stops": stops,
            "goal": goal,
            "returnToStart": return_to_start,
            "conditions": {
                "vehicle": "bike",
                "period": "peak",
                "weights": {"distance": 1, "time": 0, "congestion": 0, "risk": 0},
            },
        }
    )


def test_planner_keeps_a_dearer_arrival_way_when_it_wins_the_complete_route() -> None:
    request = _context_request(
        nodes=("W", "P", "Q", "B", "G"),
        edges=[
            ("W", "P", 2, 1),
            ("P", "B", 3, 10),  # cheapest arrival at B: total 5
            ("W", "Q", 3, 2),
            ("Q", "B", 3, 20),  # dearer arrival at B: total 6
            ("B", "G", 1, 30),
        ],
        turns={
            "no": {"B|10|30": [{"kind": "no_left_turn", "hours": [], "except": []}]},
            "only": {},
        },
        start="W",
        goal="G",
        stops=["B"],
        return_to_start=False,
    )

    result = planner.plan_route(request)

    assert result.found is True
    assert result.order == ["W", "B", "G"]
    assert result.path == ["W", "Q", "B", "G"]
    assert result.metrics.cost == 7
    assert result.metrics.optimal is True


def test_planner_closed_return_uses_the_final_destination_arrival_way() -> None:
    request = _context_request(
        nodes=("W", "P", "Q", "X"),
        edges=[
            ("W", "P", 0.5, 1),
            ("P", "X", 0.5, 10),
            ("W", "Q", 1, 2),
            ("Q", "X", 1, 20),
            ("X", "W", 1, 30),
        ],
        turns={
            "no": {"X|10|30": [{"kind": "no_left_turn", "hours": [], "except": []}]},
            "only": {},
        },
        start="W",
        goal="X",
        stops=[],
        return_to_start=True,
    )

    result = planner.plan_route(request)

    assert result.found is True
    assert result.order == ["W", "X", "W"]
    assert result.path == ["W", "Q", "X", "W"]
    assert result.metrics.cost == 3
    assert result.metrics.optimal is True


def test_no_turn_graph_still_uses_standard_held_karp(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from .fixtures import trip_request

    request = trip_request("held_karp", goal="B", stops=["A"], return_to_start=False)
    original = planner.build_pairwise
    calls = 0

    def pairwise(**kwargs):  # type: ignore[no-untyped-def]
        nonlocal calls
        calls += 1
        return original(**kwargs)

    monkeypatch.setattr(planner, "build_pairwise", pairwise)
    result = planner.plan_route(request)

    assert calls == 1
    assert result.found is True
    assert result.order == ["W", "A", "B"]
    assert result.path == ["W", "A", "B"]
    assert result.metrics.cost == 2.0
    assert result.metrics.optimal is True
