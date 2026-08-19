"""Context-aware road search labels and lazy transition caching.

Normal point-to-point A* stops at the cheapest arrival at a destination.  That
is exactly the right contract for one trip leg, but not for a trip optimiser:
two arrivals at the same intersection through different OpenStreetMap ways can
permit different next turns.  This module therefore exhausts the reachable
expanded state graph and retains the cheapest destination path for every final
incoming-way state.

The query cache is deliberately separate from ``shared/pairwise.py``.  Pairwise
data has one scalar per location pair; contextual transitions have one query per
``(source, source incoming way, target)`` and potentially many target labels.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from time import perf_counter
from types import MappingProxyType

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.contract.result import TraceStep
from route_lab.shared.graph import Graph
from route_lab.shared.heap import Heap
from route_lab.shared.problem import SearchProblem, build_problem
from route_lab.shared.search import (
    SearchLegResult,
    SearchMemory,
    SearchStats,
    create_search_memory,
    next_states,
    pop_fresh,
    record_expansion,
    remember,
)

IncomingWay = int | None


@dataclass(frozen=True)
class ContextRouteQueryKey:
    source: str
    source_incoming_way: IncomingWay
    target: str


@dataclass(frozen=True)
class ContextRouteKey:
    source: str
    source_incoming_way: IncomingWay
    target: str
    target_incoming_way: IncomingWay


@dataclass(frozen=True)
class DestinationLabel:
    """The cheapest route ending in one particular destination context."""

    final_incoming_way: IncomingWay
    cost: float
    path: tuple[str, ...]
    edges: tuple[GraphEdge, ...]


@dataclass(frozen=True)
class DestinationSearchResult:
    """All route labels from one search, with diagnostics owned once per query."""

    labels: Mapping[IncomingWay, DestinationLabel]
    trace: tuple[TraceStep, ...]
    stats: SearchStats
    ms: float


DestinationSearch = Callable[[SearchProblem], DestinationSearchResult]


def _reconstruct(
    memory: SearchMemory, goal_key: str
) -> tuple[tuple[str, ...], tuple[GraphEdge, ...]]:
    path: list[str] = []
    edges: list[GraphEdge] = []
    current = goal_key
    while True:
        path.append(memory.node_at[current])
        previous = memory.parent[current]
        if previous is None:
            break
        edge = memory.via[current]
        if edge is not None:
            edges.append(edge)
        current = previous
    path.reverse()
    edges.reverse()
    return tuple(path), tuple(edges)


def _way_sort_key(way: IncomingWay) -> tuple[int, int]:
    return (0, 0) if way is None else (1, way)


def destination_label_search(problem: SearchProblem) -> DestinationSearchResult:
    """Return the minimum-cost target route for every reachable incoming way.

    The loop is A* over the same expanded ``(node, incoming way)`` state used by
    :func:`a_star_search`, including reopening.  It intentionally does not stop
    at the first target state.  Exhausting the finite reachable frontier makes
    every final recorded state cost authoritative even for an admissible but
    inconsistent heuristic and also proves that an unseen target context is
    unreachable from this query.
    """

    started_at = perf_counter()
    memory = create_search_memory(
        problem.graph, problem.start, problem.conditions, problem.incoming
    )
    frontier = Heap()
    frontier.push(memory.start_key, problem.heuristic(problem.start), 0.0)

    while (current := pop_fresh(frontier, memory)) is not None:
        current_h = problem.heuristic(memory.node_at[current])
        record_expansion(memory, current, current_h)
        g = memory.cost[current]
        for edge, key in next_states(memory, current, include_closed=True):
            candidate_g = g + problem.cost(edge)
            if key in memory.cost and candidate_g >= memory.cost[key]:
                continue
            memory.closed.discard(key)
            remember(memory, key, current, edge, candidate_g)
            frontier.push(
                key,
                candidate_g + problem.heuristic(memory.node_at[key]),
                candidate_g,
            )

    target_keys: dict[IncomingWay, str] = {}
    for key, node in memory.node_at.items():
        if node != problem.goal or key == memory.start_key:
            continue
        incoming = memory.via[key]
        way = incoming.way_id if incoming is not None else None
        known = target_keys.get(way)
        if known is None or memory.cost[key] < memory.cost[known]:
            target_keys[way] = key

    labels: dict[IncomingWay, DestinationLabel] = {}
    for way in sorted(target_keys, key=_way_sort_key):
        key = target_keys[way]
        path, edges = _reconstruct(memory, key)
        labels[way] = DestinationLabel(
            final_incoming_way=way,
            cost=memory.cost[key],
            path=path,
            edges=edges,
        )

    return DestinationSearchResult(
        labels=MappingProxyType(labels),
        trace=tuple(memory.trace),
        stats=memory.stats,
        ms=(perf_counter() - started_at) * 1000,
    )


class ContextTransitionProvider:
    """Lazily search and cache contextual transitions requested by the DP."""

    def __init__(
        self,
        graph: Graph,
        conditions: Conditions,
        *,
        search: DestinationSearch = destination_label_search,
    ) -> None:
        self.graph = graph
        self.conditions = conditions
        self._search = search
        self._cache: dict[ContextRouteQueryKey, DestinationSearchResult] = {}
        self._routes: dict[ContextRouteKey, DestinationLabel] = {}
        self._incoming_edges: dict[tuple[str, IncomingWay], GraphEdge] = {}
        for edge in graph.edges:
            self._incoming_edges.setdefault((edge.to, edge.way_id), edge)
        self.searches = 0
        self.cache_hits = 0
        self.label_count = 0

    @property
    def cache_entries(self) -> int:
        return len(self._cache)

    def transitions(
        self,
        source: str,
        incoming_way: IncomingWay,
        target: str,
    ) -> Mapping[IncomingWay, DestinationLabel]:
        query = ContextRouteQueryKey(source, incoming_way, target)
        cached = self._cache.get(query)
        if cached is not None:
            self.cache_hits += 1
            return cached.labels

        incoming = None
        if incoming_way is not None:
            incoming = self._incoming_edges.get((source, incoming_way))
            if incoming is None:
                # A DP state can only acquire an incoming way from a real route
                # label.  Treat a foreign/inconsistent provider request as an
                # unreachable transition instead of inventing an edge context.
                result = DestinationSearchResult(
                    labels=MappingProxyType({}), trace=(), stats=SearchStats(), ms=0.0
                )
                self._cache[query] = result
                return result.labels

        problem = build_problem(
            self.graph,
            source,
            target,
            self.conditions,
            incoming=incoming,
        )
        result = self._search(problem)
        self._cache[query] = result
        self.searches += 1
        self.label_count += len(result.labels)
        for final_way, label in result.labels.items():
            self._routes[ContextRouteKey(source, incoming_way, target, final_way)] = label
        return result.labels

    def route(self, key: ContextRouteKey) -> DestinationLabel:
        return self._routes[key]

    def leg(self, key: ContextRouteKey) -> SearchLegResult:
        """Materialise one selected label without duplicating query diagnostics."""

        query = ContextRouteQueryKey(key.source, key.source_incoming_way, key.target)
        result = self._cache[query]
        label = self._routes[key]
        return SearchLegResult(
            path=list(label.path),
            edges=list(label.edges),
            trace=list(result.trace),
            found=True,
            ms=result.ms,
            stats=result.stats,
        )
