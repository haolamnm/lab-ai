"""Behaviour shared by the newly implemented uninformed searches."""

from route_lab.algorithms.bfs import breadth_first_search
from route_lab.algorithms.dfs import depth_first_search
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import SearchProblem, build_problem

from .fixtures import diamond_payload, diamond_request


def _problem() -> SearchProblem:
    graph = build_graph(diamond_payload())
    conditions = diamond_request("bfs").conditions
    return build_problem(graph, "A", "D", conditions, guided=False)


def test_bfs_returns_the_fewest_hop_route() -> None:
    result = breadth_first_search(_problem())

    assert result.found is True
    assert result.path == ["A", "D"]
    assert len(result.edges) == 1
    assert result.stats.expanded == len(result.trace) == 4
    assert result.stats.generated == 3
    assert result.stats.reopened == 0
    assert result.stats.max_frontier == 3
    assert all(step.h is None for step in result.trace)


def test_dfs_follows_the_newest_branch_first() -> None:
    result = depth_first_search(_problem())

    assert result.found is True
    assert result.path == ["A", "D"]
    assert len(result.edges) == 1
    assert result.stats.expanded == len(result.trace) == 2
    assert result.stats.generated == 3
    assert result.stats.reopened == 0
    assert result.stats.max_frontier == 3
    assert all(step.h is None for step in result.trace)
