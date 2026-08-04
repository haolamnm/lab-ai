"""A stubbed algorithm fails loudly in code but gently over HTTP.

Calling the function raises; going through the planner or the api turns that into
a normal result whose ``problem`` explains the gap — never a 500, so an
unimplemented pane shows a message instead of a crash while the team fills stubs.
"""

import pytest
from fastapi.testclient import TestClient

from route_lab.algorithms.astar import a_star_search
from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.api import app
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import build_problem

from .fixtures import diamond_json, diamond_payload, diamond_request

client = TestClient(app)

STUBS = ["astar", "greedy"]


@pytest.mark.parametrize("algo", STUBS)
def test_planner_turns_a_stub_into_a_problem(algo: str) -> None:
    result = plan_route(diamond_request(algo))
    assert result.found is False
    assert result.problem is not None
    assert algo.upper() in result.problem
    # The result is still well-formed: it carries the node lookup, just no route.
    assert result.node_ids == ["A", "B", "C", "D"]
    assert result.path == []


@pytest.mark.parametrize("algo", STUBS)
def test_stub_endpoint_stays_200(algo: str) -> None:
    response = client.post("/plan", json=diamond_json(algo))
    assert response.status_code == 200
    assert response.json()["found"] is False


def test_calling_a_stub_directly_raises() -> None:
    graph = build_graph(diamond_payload())
    conditions = diamond_request("astar").conditions
    problem = build_problem(graph, "A", "D", conditions, guided=False)
    with pytest.raises(AlgorithmNotImplemented):
        a_star_search(problem)
