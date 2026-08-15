"""The /plan response body — mirrors ``RouteResult`` in web/src/lib/types.ts."""

from pydantic import Field

from route_lab.contract.graph import Contract
from route_lab.contract.request import AlgoKey


class TraceStep(Contract):
    """One node-expansion step, in the shape the map and tree timeline consume.

    Nodes are stored by index, not id: a single run over a few-hundred-node
    network produces tens of thousands of frontier entries, and across every open
    pane the string ids would waste memory for nothing. ``RouteResult.node_ids``
    maps an index back to its id.
    """

    expanded: int
    frontier: list[int]
    g: float
    h: float | None
    # The node this one was reached from. The parent-child pairs form the search
    # tree, whose shape is the portrait of the algorithm.
    parent: int | None


class Metrics(Contract):
    """The complete, locked measurement set every algorithm returns.

    The frontend footer reads a subset today (``km``, ``minutes``, ``cost``,
    ``expanded``, ``ms``, ``optimal``); the rest are the search-effort numbers the
    algorithm comparison exists to show. They are gathered by the shared harness,
    not by each algorithm, so this set is guaranteed complete for every algorithm
    at once — add a field here and in :class:`route_lab.shared.search.SearchStats`
    together, never a one-off number inside one algorithm.
    """

    # Route quality — what the trip actually costs.
    km: float
    minutes: float
    cost: float
    # Number of road segments in the chosen route (path length in hops).
    hops: int
    # Search effort — how hard the algorithm worked to find it.
    expanded: int
    generated: int
    reopened: int
    max_frontier: int
    # Time inside the leg searches, summed. Deliberately the narrow measurement:
    # `planRoute` in web/src/lib/search.ts sums exactly the same thing, so this
    # is the one figure a pane may rank across algorithms and the app may show
    # without knowing which planner answered. Widening it here is what made a
    # local and a remote run of one trip disagree; `planning_ms` is where the
    # wider number belongs. An ordering pass searches one leg per greedy step
    # and never a leg it drops, so it needs no exception to that rule.
    ms: float
    # Wall-clock time for the whole post-validation pipeline — the ordering
    # search and the pairwise matrix as well as the legs. Optional because only
    # this planner can measure it: the browser computes its ordering behind a
    # memo, so the same span there would time the pane order, not the work.
    planning_ms: float | None = None
    # Correctness and constraints.
    optimal: bool
    # How many times a direction was dropped because of a turn restriction.
    turns_blocked: int


class Reveal(Contract):
    """Which prefix of the trip is drawn once the timeline passes ``upto``."""

    upto: int
    path: list[str]


class RouteResult(Contract):
    """The full result of planning one algorithm across one trip."""

    algo: AlgoKey
    # Set only when the query itself is meaningless or a leg has no route.
    problem: str | None = None
    # Visit order. An open tour ends at the goal; a closed tour ends where it
    # started, the goal having been ordered like any other stop. A run that
    # completed no leg reports an empty order, in
    # step with its empty `path` and zero metrics — the one shape a reader can
    # rely on is that `order` never names a point the trip did not reach.
    order: list[str] = Field(default_factory=list)
    path: list[str] = Field(default_factory=list)
    trace: list[TraceStep] = Field(default_factory=list)
    # Index-to-id lookup for every node in the graph, in graph order.
    node_ids: list[str] = Field(default_factory=list)
    reveal: list[Reveal] = Field(default_factory=list)
    found: bool
    metrics: Metrics
