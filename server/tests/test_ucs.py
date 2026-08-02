"""The UCS reference on the diamond: known route, known numbers, honest flags."""

from route_lab.contract.request import PlanRequest
from route_lab.planner import plan_route

from .fixtures import diamond_json, diamond_request


def test_ucs_finds_the_one_cheapest_route() -> None:
    result = plan_route(diamond_request("ucs"))

    assert result.found is True
    assert result.path == ["A", "B", "D"]
    assert result.metrics.km == 2.0
    assert result.metrics.cost == 2.0
    assert result.metrics.hops == 2


def test_ucs_reports_a_complete_metric_set() -> None:
    result = plan_route(diamond_request("ucs"))
    metrics = result.metrics

    # The diamond is fully deterministic, so these are exact, not sanity bounds: a
    # harness regression that miscounts effort must fail here, not slip past a
    # loose `>= 0`. A(0) B,C(2) D reached via B, C re-pushes nothing cheaper but D
    # is reopened once when the C->D path is compared against B->D.
    assert metrics.expanded == len(result.trace) == 4
    assert metrics.generated == 4
    assert metrics.reopened == 1
    assert metrics.max_frontier == 3
    assert metrics.turns_blocked == 0


def test_ucs_is_optimal_but_nearest_is_not() -> None:
    assert plan_route(diamond_request("ucs")).metrics.optimal is True
    # nearest delegates to UCS for the leg but never claims optimality itself.
    nearest = plan_route(diamond_request("nearest"))
    assert nearest.found is True
    assert nearest.path == ["A", "B", "D"]
    assert nearest.metrics.optimal is False


def test_flat_cost_withdraws_the_optimal_claim() -> None:
    request = diamond_json("ucs")
    request["conditions"]["weights"] = {
        "distance": 0.0,
        "time": 0.0,
        "congestion": 0.0,
        "risk": 0.0,
    }
    result = plan_route(PlanRequest.model_validate(request))

    assert result.found is True
    # Every route costs 0 now, so "optimal" would be a meaningless stamp.
    assert result.metrics.optimal is False
