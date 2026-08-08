"""Build directed pairwise route data for trip-level ordering algorithms.

This module bridges point-search algorithms and trip-level optimizers without
depending on a concrete search implementation: the search is a parameter, which
is also what keeps ``shared`` from importing ``algorithms``. Every ordered,
non-diagonal location pair is searched independently. Reachable pairs retain
both their exact accumulated edge cost and the complete search result so callers
can later reconstruct route legs.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType

from route_lab.contract.conditions import Conditions
from route_lab.shared.graph import Graph
from route_lab.shared.problem import PointSearch, build_problem
from route_lab.shared.search import SearchLegResult


@dataclass(frozen=True)
class PairwiseResult:
    """Exact costs and search results keyed by directed location pairs."""

    costs: Mapping[tuple[str, str], float]
    paths: Mapping[tuple[str, str], SearchLegResult]


def build_pairwise(
    graph: Graph,
    locations: Sequence[str],
    conditions: Conditions,
    search: PointSearch,
) -> PairwiseResult:
    """Build exact directed costs and route legs between all locations.

    Location order is preserved. Diagonal costs are zero and do not invoke the
    search callback. Missing routes are omitted from both returned mappings so
    callers can distinguish them from zero-cost routes.
    """

    ordered_locations = tuple(locations)
    seen: set[str] = set()
    for location in ordered_locations:
        if location in seen:
            raise ValueError(f"duplicate location: {location!r}")
        seen.add(location)

    costs: dict[tuple[str, str], float] = {
        (location, location): 0.0 for location in ordered_locations
    }
    paths: dict[tuple[str, str], SearchLegResult] = {}

    for source in ordered_locations:
        for target in ordered_locations:
            if source == target:
                continue

            problem = build_problem(
                graph=graph,
                start=source,
                goal=target,
                conditions=conditions,
            )
            result = search(problem)
            if not result.found:
                continue

            pair = (source, target)
            costs[pair] = sum(problem.cost(edge) for edge in result.edges)
            paths[pair] = result

    return PairwiseResult(
        costs=MappingProxyType(costs),
        paths=MappingProxyType(paths),
    )
