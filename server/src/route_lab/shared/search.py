"""The search harness shared by every algorithm — the port of the shared
bookkeeping in web/src/lib/search.ts.

An algorithm never touches raw dicts. It builds a :class:`SearchMemory` with
:func:`create_search_memory`, then loops: pop a state, :func:`record_expansion`,
check the goal, and for each :func:`next_states` decide whether to
:func:`remember` it. When the goal is reached (or the frontier empties) it
returns :func:`complete_leg`. UCS in ``algorithms/ucs.py`` is the worked example.

The harness also *counts* the search as it runs — expansions, states generated,
reopenings, peak frontier size, and directions a turn rule blocked — so every
algorithm reports the same complete :class:`SearchStats` without doing any
bookkeeping of its own. That is what lets the comparison be honest: no algorithm
can under- or over-count because none of them count at all.

The one other subtlety: on a graph that carries turn restrictions the search
state is ``(intersection, arriving way)`` rather than the bare intersection, so a
costlier-but-legal arrival is not shut out by the cheapest one.
:meth:`SearchMemory.key_of` hides that; algorithms stay identical either way.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from time import perf_counter

from route_lab.contract.conditions import Conditions
from route_lab.contract.graph import GraphEdge
from route_lab.contract.result import TraceStep
from route_lab.shared.graph import Graph
from route_lab.shared.heap import Heap
from route_lab.shared.rounding import js_round
from route_lab.shared.traffic import passable, turn_allowed


def node_ids(graph: Graph) -> list[str]:
    """Every node id in graph order — the index-to-id lookup a result carries."""
    return list(graph.nodes.keys())


def _node_index(graph: Graph) -> dict[str, int]:
    return {node_id: index for index, node_id in enumerate(node_ids(graph))}


@dataclass
class SearchStats:
    """Every measurement the harness gathers for one leg.

    This is the locked, complete set: an algorithm returns all of it, always,
    because the harness fills it in. Add a field here (and to the response
    ``Metrics``) rather than having any algorithm compute its own number.
    """

    # States taken off the frontier and expanded (one per trace step).
    expanded: int = 0
    # Successor states pushed onto the frontier (counts a re-push of an improved
    # state too — that is what `reopened` measures separately).
    generated: int = 0
    # Times an already-generated state was reached more cheaply and re-pushed.
    reopened: int = 0
    # The largest the frontier ever grew — the search's peak memory footprint.
    max_frontier: int = 0
    # Directions dropped because a turn restriction forbade them.
    turns_blocked: int = 0


@dataclass
class SearchLegResult:
    """The outcome of searching one leg — one pickup-to-stop or stop-to-stop hop."""

    path: list[str]
    edges: list[GraphEdge]
    trace: list[TraceStep]
    found: bool
    ms: float
    stats: SearchStats


@dataclass
class SearchMemory:
    """Per-leg bookkeeping. Each algorithm still owns its own frontier and loop."""

    graph: Graph
    conditions: Conditions
    node_index: dict[str, int]
    turns_active: bool
    start_key: str
    node_at: dict[str, str]
    parent: dict[str, str | None]
    via: dict[str, GraphEdge | None]
    cost: dict[str, float]
    closed: set[str]
    # An insertion-ordered set: dict keys preserve order, matching the JS Set the
    # frontend iterates when it records the frontier. A plain Python set would
    # reorder it and the trace would stop matching the browser's.
    open: dict[str, None]
    trace: list[TraceStep] = field(default_factory=list)
    stats: SearchStats = field(default_factory=SearchStats)

    def key_of(self, node: str, incoming: GraphEdge | None) -> str:
        """The search-state key for arriving at ``node`` via ``incoming``.

        Plain node id unless the graph carries turn restrictions, in which case
        the arriving way is folded in so turn rules can be applied per arrival.
        """
        if not self.turns_active:
            return node
        way = incoming.way_id if incoming is not None else None
        return f"{node}|{'' if way is None else way}"


def create_search_memory(graph: Graph, start: str, conditions: Conditions) -> SearchMemory:
    """A fresh :class:`SearchMemory` seeded with the start state."""
    memory = SearchMemory(
        graph=graph,
        conditions=conditions,
        node_index=_node_index(graph),
        turns_active=graph.turns_active,
        start_key="",
        node_at={},
        parent={},
        via={},
        cost={},
        closed=set(),
        open={},
    )
    start_key = memory.key_of(start, None)
    memory.start_key = start_key
    memory.node_at[start_key] = start
    memory.parent[start_key] = None
    memory.via[start_key] = None
    memory.cost[start_key] = 0.0
    memory.open[start_key] = None
    memory.stats.max_frontier = 1
    return memory


def next_states(
    memory: SearchMemory, current: str, *, include_closed: bool = False
) -> list[tuple[GraphEdge, str]]:
    """Legal outgoing ``(edge, key)`` pairs, counting directions a turn rule bans.

    Blind searches leave ``include_closed`` false. A* enables it so an improved
    route may reopen a state after an expansion when used with an inconsistent
    heuristic; the algorithm removes that state from ``closed`` before requeueing
    it. Keeping this policy at the call site leaves UCS's behaviour unchanged.
    """
    at = memory.node_at[current]
    incoming = memory.via[current]
    result: list[tuple[GraphEdge, str]] = []

    for edge in memory.graph.adj.get(at, []):
        if not passable(edge, memory.conditions.vehicle, memory.conditions.period):
            continue
        if incoming is not None and not turn_allowed(
            memory.graph.turns, at, incoming, edge, memory.conditions
        ):
            memory.stats.turns_blocked += 1
            continue
        key = memory.key_of(edge.to, edge)
        if include_closed or key not in memory.closed:
            result.append((edge, key))
    return result


def remember(memory: SearchMemory, key: str, current: str, edge: GraphEdge, cost: float) -> None:
    """Record ``key`` as reached from ``current`` via ``edge`` at ``cost``."""
    if key in memory.cost:
        memory.stats.reopened += 1
    memory.cost[key] = cost
    memory.parent[key] = current
    memory.via[key] = edge
    memory.node_at[key] = edge.to
    memory.open[key] = None
    memory.stats.generated += 1
    if len(memory.open) > memory.stats.max_frontier:
        memory.stats.max_frontier = len(memory.open)


def record_expansion(memory: SearchMemory, current: str, heuristic: float | None = None) -> None:
    """Append one expansion to the trace, in the shape the timeline consumes."""
    memory.closed.add(current)
    memory.open.pop(current, None)
    memory.stats.expanded += 1
    at = memory.node_at[current]
    parent = memory.parent[current]
    memory.trace.append(
        TraceStep(
            expanded=memory.node_index[at],
            frontier=[memory.node_index[memory.node_at[key]] for key in memory.open],
            g=js_round(memory.cost[current], 3),
            h=None if heuristic is None else js_round(heuristic, 3),
            parent=None if parent is None else memory.node_index[memory.node_at[parent]],
        )
    )


def complete_leg(memory: SearchMemory, goal_key: str | None, started_at: float) -> SearchLegResult:
    """Reconstruct the leg from the parent chain and stamp its elapsed time.

    The exact edge objects the algorithm selected are kept, rather than looked up
    again by node pair — that lookup is wrong when parallel roads join the same
    two intersections.
    """
    path: list[str] = []
    edges: list[GraphEdge] = []

    current = goal_key
    while current is not None:
        path.insert(0, memory.node_at[current])
        edge = memory.via[current]
        if edge is not None:
            edges.insert(0, edge)
        current = memory.parent[current]

    return SearchLegResult(
        path=path,
        edges=edges,
        trace=memory.trace,
        found=goal_key is not None,
        stats=memory.stats,
        ms=(perf_counter() - started_at) * 1000,
    )


def pop_fresh(frontier: Heap, memory: SearchMemory) -> str | None:
    """Pop the next non-stale state, or None when the frontier is exhausted.

    Improved states leave stale heap entries behind; one is fresh only if it is
    still open and its recorded cost still matches the current best. The public
    :class:`route_lab.shared.frontier.PriorityQueue` skips stale entries with a
    simpler ``closed`` check instead; this is the internal form the ordering
    sweep uses.
    """
    while frontier.size:
        entry = frontier.pop()
        if entry.id not in memory.closed and entry.cost == memory.cost[entry.id]:
            return entry.id
    return None
