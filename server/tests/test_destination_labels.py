from __future__ import annotations

from route_lab.algorithms.destination_labels import (
    ContextTransitionProvider,
    destination_label_search,
)
from route_lab.contract.graph import GraphPayload
from route_lab.contract.request import PlanRequest
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import build_problem


def _request(
    edges: list[tuple[str, str, float, int]],
    *,
    turns: dict[str, object] | None = None,
) -> PlanRequest:
    node_ids = sorted({node for source, target, _, _ in edges for node in (source, target)})
    return PlanRequest.model_validate(
        {
            "graph": {
                "nodes": {
                    node: {"id": node, "lat": 10.0, "lng": 106.0 + index * 0.0001}
                    for index, node in enumerate(node_ids)
                },
                "edges": [
                    {
                        "from": source,
                        "to": target,
                        "km": cost,
                        "wayId": way,
                        "roadClass": "secondary",
                        "congestion": 1,
                        "risk": 0,
                    }
                    for source, target, cost, way in edges
                ],
                "turns": turns,
            },
            "algo": "held_karp",
            "start": node_ids[0],
            "goal": node_ids[-1],
            "conditions": {
                "vehicle": "bike",
                "period": "peak",
                "weights": {"distance": 1, "time": 0, "congestion": 0, "risk": 0},
            },
        }
    )


def test_destination_search_keeps_best_label_for_each_final_way() -> None:
    request = _request(
        [
            ("S", "A", 1.0, 10),
            ("A", "T", 4.0, 100),
            ("S", "B", 1.0, 20),
            ("B", "T", 5.0, 200),
            # Same final way 100 as S-A-T, but more expensive.
            ("S", "C", 3.0, 30),
            ("C", "T", 7.0, 100),
        ],
        turns={"no": {}, "only": {"S|999": []}},
    )
    graph = build_graph(request.graph)
    problem = build_problem(graph, "S", "T", request.conditions)

    result = destination_label_search(problem)

    assert list(result.labels) == [100, 200]
    assert result.labels[100].cost == 5.0
    assert result.labels[100].path == ("S", "A", "T")
    assert result.labels[200].cost == 6.0
    assert result.labels[200].path == ("S", "B", "T")
    assert result.stats.expanded == len(result.trace)


def test_destination_search_respects_start_incoming_context() -> None:
    request = _request(
        [
            ("S", "A", 1.0, 1),
            ("A", "T", 1.0, 2),
            ("A", "D", 2.0, 3),
            ("D", "T", 2.0, 4),
        ],
        turns={
            "no": {"A|1|2": [{"kind": "no_left_turn", "hours": [], "except": []}]},
            "only": {},
        },
    )
    graph = build_graph(request.graph)
    incoming = next(edge for edge in graph.edges if edge.from_ == "S" and edge.to == "A")
    problem = build_problem(graph, "A", "T", request.conditions, incoming=incoming)

    result = destination_label_search(problem)

    assert 2 not in result.labels
    assert result.labels[4].path == ("A", "D", "T")
    assert result.labels[4].cost == 4.0


def test_context_transition_provider_caches_one_query_and_all_labels() -> None:
    request = _request(
        [("S", "A", 1.0, 10), ("A", "T", 1.0, 100), ("S", "T", 3.0, 200)],
        turns={"no": {}, "only": {"S|999": []}},
    )
    graph = build_graph(request.graph)
    calls = 0

    def search(problem):  # type: ignore[no-untyped-def]
        nonlocal calls
        calls += 1
        return destination_label_search(problem)

    provider = ContextTransitionProvider(graph, request.conditions, search=search)

    first = provider.transitions("S", None, "T")
    second = provider.transitions("S", None, "T")

    assert first is second
    assert list(first) == [100, 200]
    assert calls == 1
    assert provider.searches == 1
    assert provider.cache_hits == 1
    assert provider.label_count == 2


def test_context_transition_provider_caches_unreachable_query() -> None:
    payload = GraphPayload.model_validate(
        {
            "nodes": {
                "S": {"id": "S", "lat": 10, "lng": 106},
                "T": {"id": "T", "lat": 10, "lng": 106.001},
            },
            "edges": [],
            "turns": {"no": {"S|1|2": []}, "only": {}},
        }
    )
    conditions = _request([("S", "T", 1.0, 1)]).conditions
    provider = ContextTransitionProvider(build_graph(payload), conditions)

    assert provider.transitions("S", None, "T") == {}
    assert provider.transitions("S", None, "T") == {}
    assert provider.searches == 1
    assert provider.cache_hits == 1
