from collections.abc import Callable

import pytest

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphPayload
from route_lab.shared.graph import Graph, build_graph
from route_lab.shared.pairwise import build_pairwise
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult, SearchStats, TraceStep


def _conditions() -> Conditions:
    return Conditions.model_validate(
        {
            "vehicle": "van",
            "period": "peak",
            "weights": {
                "distance": 1.0,
                "time": 0.0,
                "congestion": 0.0,
                "risk": 0.0,
            },
        }
    )


def _graph(*, edges: list[dict[str, object]]) -> Graph:
    payload = GraphPayload.model_validate(
        {
            "nodes": {
                "W": {"id": "W", "lat": 10.0, "lng": 106.0},
                "A": {"id": "A", "lat": 10.001, "lng": 106.001},
                "B": {"id": "B", "lat": 10.002, "lng": 106.002},
            },
            "edges": edges,
            "bounds": [[10.0, 106.0], [10.002, 106.002]],
            "detail": "fine",
        }
    )
    return build_graph(payload)


def _edge(
    source: str,
    target: str,
    km: float,
    *,
    name: str = "road",
    way_id: int = 1,
) -> dict[str, object]:
    return {
        "from": source,
        "to": target,
        "km": km,
        "roadClass": "secondary",
        "congestion": 1.0,
        "risk": 0.0,
        "name": name,
        "wayId": way_id,
    }


def _complete_graph() -> Graph:
    return _graph(
        edges=[
            _edge("W", "A", 1.0),
            _edge("W", "B", 2.0),
            _edge("A", "W", 3.0),
            _edge("A", "B", 4.0),
            _edge("B", "W", 5.0),
            _edge("B", "A", 6.0),
        ]
    )


def _direct_search(problem: SearchProblem) -> SearchLegResult:
    edge = next(edge for edge in problem.graph.adj[problem.start] if edge.to == problem.goal)
    return SearchLegResult(
        path=[problem.start, problem.goal],
        edges=[edge],
        trace=[],
        found=True,
        ms=0.25,
        stats=SearchStats(expanded=1, generated=1, max_frontier=1),
    )


def _not_found() -> SearchLegResult:
    return SearchLegResult(
        path=[],
        edges=[],
        trace=[],
        found=False,
        ms=0.0,
        stats=SearchStats(),
    )


def _never_search(problem: SearchProblem) -> SearchLegResult:
    raise AssertionError(f"search should not be called for {problem.start}->{problem.goal}")


def test_build_pairwise_zero_locations() -> None:
    result = build_pairwise(_complete_graph(), [], _conditions(), _never_search)

    assert dict(result.costs) == {}
    assert dict(result.paths) == {}


def test_build_pairwise_one_location_does_not_call_search() -> None:
    result = build_pairwise(_complete_graph(), ("W",), _conditions(), _never_search)

    assert dict(result.costs) == {("W", "W"): 0.0}
    assert dict(result.paths) == {}


def test_build_pairwise_searches_all_ordered_non_diagonal_pairs() -> None:
    calls: list[tuple[str, str]] = []

    def search(problem: SearchProblem) -> SearchLegResult:
        calls.append((problem.start, problem.goal))
        return _direct_search(problem)

    result = build_pairwise(_complete_graph(), ["W", "A", "B"], _conditions(), search)

    assert calls == [
        ("W", "A"),
        ("W", "B"),
        ("A", "W"),
        ("A", "B"),
        ("B", "W"),
        ("B", "A"),
    ]
    assert len(result.paths) == 6


def test_build_pairwise_callback_receives_a_heuristic_bound_to_the_goal() -> None:
    seen: list[SearchProblem] = []

    def search(problem: SearchProblem) -> SearchLegResult:
        seen.append(problem)
        return _direct_search(problem)

    graph = _complete_graph()
    build_pairwise(graph, ["W", "A"], _conditions(), search)

    assert [(problem.start, problem.goal) for problem in seen] == [
        ("W", "A"),
        ("A", "W"),
    ]
    assert all(problem.graph is graph for problem in seen)
    assert all(problem.heuristic(problem.goal) == pytest.approx(0.0) for problem in seen)
    assert all(problem.heuristic(problem.start) > 0.0 for problem in seen)


def test_build_pairwise_preserves_directed_asymmetric_costs() -> None:
    result = build_pairwise(
        _graph(edges=[_edge("A", "B", 1.0), _edge("B", "A", 4.0)]),
        ["A", "B"],
        _conditions(),
        _direct_search,
    )

    assert result.costs[("A", "B")] == pytest.approx(1.0)
    assert result.costs[("B", "A")] == pytest.approx(4.0)


def test_build_pairwise_diagonal_is_zero_and_has_no_cached_path() -> None:
    result = build_pairwise(_complete_graph(), ["W", "A"], _conditions(), _direct_search)

    assert result.costs[("W", "W")] == 0.0
    assert result.costs[("A", "A")] == 0.0
    assert ("W", "W") not in result.paths
    assert ("A", "A") not in result.paths


def test_build_pairwise_uses_exact_accumulated_edge_cost() -> None:
    graph = _graph(
        edges=[
            _edge("W", "B", 8.0),
            _edge("W", "A", 2.5),
            _edge("A", "B", 3.25),
            _edge("B", "W", 1.0),
        ]
    )

    def search(problem: SearchProblem) -> SearchLegResult:
        if (problem.start, problem.goal) == ("W", "B"):
            first = next(edge for edge in graph.adj["W"] if edge.to == "A")
            second = next(edge for edge in graph.adj["A"] if edge.to == "B")
            return SearchLegResult(
                path=["W", "A", "B"],
                edges=[first, second],
                trace=[],
                found=True,
                ms=0.0,
                stats=SearchStats(),
            )
        return _not_found()

    result = build_pairwise(graph, ["W", "B"], _conditions(), search)

    assert result.costs[("W", "B")] == pytest.approx(5.75)


def test_build_pairwise_does_not_add_heuristic_to_cost() -> None:
    captured: list[SearchProblem] = []

    def search(problem: SearchProblem) -> SearchLegResult:
        captured.append(problem)
        return _direct_search(problem)

    result = build_pairwise(_complete_graph(), ["W", "A"], _conditions(), search)
    forward = captured[0]

    assert forward.heuristic(forward.start) > 0.0
    assert result.costs[("W", "A")] == pytest.approx(1.0)
    assert result.costs[("W", "A")] != pytest.approx(1.0 + forward.heuristic(forward.start))


def test_build_pairwise_caches_complete_result_by_identity() -> None:
    returned: dict[tuple[str, str], SearchLegResult] = {}

    def search(problem: SearchProblem) -> SearchLegResult:
        result = _direct_search(problem)
        result.trace.append(TraceStep(expanded=0, frontier=[1], g=7.0, h=2.0, parent=None))
        returned[(problem.start, problem.goal)] = result
        return result

    result = build_pairwise(_complete_graph(), ["W", "A"], _conditions(), search)
    cached = result.paths[("W", "A")]

    assert cached is returned[("W", "A")]
    assert cached.path == ["W", "A"]
    assert cached.trace[0].g == pytest.approx(7.0)
    assert cached.trace[0].h == pytest.approx(2.0)
    assert cached.stats.expanded == 1


def test_build_pairwise_uses_the_exact_parallel_edge_returned_by_search() -> None:
    graph = _graph(
        edges=[
            _edge("A", "B", 5.0, name="slow", way_id=10),
            _edge("A", "B", 1.0, name="fast", way_id=11),
            _edge("B", "A", 2.0),
        ]
    )
    selected: list[SearchLegResult] = []

    def search(problem: SearchProblem) -> SearchLegResult:
        if (problem.start, problem.goal) == ("A", "B"):
            edge = next(edge for edge in graph.adj["A"] if edge.name == "fast")
            result = SearchLegResult(
                path=["A", "B"],
                edges=[edge],
                trace=[],
                found=True,
                ms=0.0,
                stats=SearchStats(),
            )
            selected.append(result)
            return result
        return _direct_search(problem)

    result = build_pairwise(graph, ["A", "B"], _conditions(), search)

    assert result.costs[("A", "B")] == pytest.approx(1.0)
    assert result.paths[("A", "B")] is selected[0]
    assert result.paths[("A", "B")].edges[0].way_id == 11


def test_build_pairwise_omits_unreachable_pair_and_continues() -> None:
    calls: list[tuple[str, str]] = []

    def search(problem: SearchProblem) -> SearchLegResult:
        pair = (problem.start, problem.goal)
        calls.append(pair)
        if pair == ("A", "B"):
            return _not_found()
        return _direct_search(problem)

    result = build_pairwise(_complete_graph(), ["W", "A", "B"], _conditions(), search)

    assert ("A", "B") not in result.costs
    assert ("A", "B") not in result.paths
    assert ("B", "A") in result.costs
    assert len(calls) == 6


def test_build_pairwise_does_not_mutate_inputs() -> None:
    graph = _complete_graph()
    locations = ["W", "A"]
    original_locations = locations.copy()
    original_adjacency = {node: tuple(edges) for node, edges in graph.adj.items()}

    build_pairwise(graph, locations, _conditions(), _direct_search)

    assert locations == original_locations
    assert {node: tuple(edges) for node, edges in graph.adj.items()} == original_adjacency


def test_build_pairwise_rejects_duplicate_locations() -> None:
    with pytest.raises(ValueError, match=r"duplicate location.*A"):
        build_pairwise(_complete_graph(), ["A", "W", "A"], _conditions(), _never_search)


@pytest.mark.parametrize("location_count", [0, 1, 2, 3])
def test_build_pairwise_search_call_count(location_count: int) -> None:
    locations = ["W", "A", "B"][:location_count]
    calls = 0

    def search(problem: SearchProblem) -> SearchLegResult:
        nonlocal calls
        calls += 1
        return _direct_search(problem)

    build_pairwise(_complete_graph(), locations, _conditions(), search)

    assert calls == location_count * (location_count - 1)


def test_build_pairwise_accepts_search_callable_type() -> None:
    search: Callable[[SearchProblem], SearchLegResult] = _direct_search

    result = build_pairwise(_complete_graph(), ("W", "A"), _conditions(), search)

    assert result.paths[("W", "A")].found
