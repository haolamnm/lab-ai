"""An unimplemented algorithm fails loudly in code and gently over HTTP.

Every point search in the registry is written now, so this guarantee has no live
example left to sit behind — which is exactly when it is worth pinning down.
``AlgorithmNotImplemented`` raised inside a leg search must reach the user as a
normal result whose ``problem`` names the gap, never as an HTTP 500. The next
algorithm added to the playground starts as a stub, and this is what keeps its
pane showing a message instead of a crash while it is being filled in.

The stub is injected into the registry rather than shipped, so the guarantee is
tested without any algorithm having to stay broken to prove it.
"""

import pytest
from fastapi.testclient import TestClient

from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.algorithms.registry import POINT_SEARCHES
from route_lab.api import app
from route_lab.planner import plan_route
from route_lab.shared.graph import build_graph
from route_lab.shared.problem import SearchProblem, build_problem
from route_lab.shared.search import SearchLegResult

from .fixtures import diamond_json, diamond_request

client = TestClient(app)


def _unimplemented(problem: SearchProblem) -> SearchLegResult:
    _ = problem
    raise AlgorithmNotImplemented("bfs")


@pytest.fixture
def stubbed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Put a raising algorithm behind the ``bfs`` key for one test."""
    # The planner holds the same dict object the registry exports, so replacing an
    # entry here is enough — no reload, and it is undone when the test ends.
    monkeypatch.setitem(POINT_SEARCHES, "bfs", _unimplemented)


@pytest.mark.usefixtures("stubbed")
def test_planner_turns_the_raise_into_a_problem() -> None:
    result = plan_route(diamond_request("bfs"))

    assert result.found is False
    assert result.problem is not None
    assert "BFS" in result.problem
    # The result is still well-formed: it carries the node lookup, just no route.
    assert result.node_ids == ["A", "B", "C", "D"]
    assert result.path == []


@pytest.mark.usefixtures("stubbed")
def test_endpoint_stays_200() -> None:
    response = client.post("/plan", json=diamond_json("bfs"))

    assert response.status_code == 200
    assert response.json()["found"] is False


def test_calling_an_unimplemented_algorithm_directly_raises() -> None:
    # Loud in code: nothing swallows it below the planner.
    request = diamond_request("bfs")
    problem = build_problem(build_graph(request.graph), "A", "D", request.conditions, guided=False)
    with pytest.raises(AlgorithmNotImplemented) as raised:
        _unimplemented(problem)

    assert raised.value.key == "bfs"
    assert "bfs.py" in str(raised.value)
