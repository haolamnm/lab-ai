"""The internal graph the search runs on.

The wire payload (``GraphPayload``) carries ``nodes`` and ``edges`` but not the
``adj`` adjacency index — sending it would duplicate every edge in the JSON. This
module rebuilds ``adj`` from ``edges``, exactly as the frontend's
``store.importGraph`` does, and clamps congestion and risk into the ranges the
cost model assumes. Clamping is defensive: the frontend already clamps on import,
but the backend does not trust an arbitrary API caller, and a single negative
congestion value produces a negative edge cost that silently breaks the
optimality guarantee UCS and A* rely on.
"""

from __future__ import annotations

from dataclasses import dataclass

from route_lab.contract.graph import Detail, GraphEdge, GraphNode, GraphPayload, TurnTable
from route_lab.shared.traffic import clamp_congestion, clamp_risk


@dataclass(frozen=True)
class Graph:
    """A road network ready to search: nodes, edges, and an adjacency index."""

    nodes: dict[str, GraphNode]
    edges: list[GraphEdge]
    adj: dict[str, list[GraphEdge]]
    bounds: tuple[tuple[float, float], tuple[float, float]]
    detail: Detail
    turns: TurnTable | None

    @property
    def turns_active(self) -> bool:
        """Whether any turn restriction is present.

        The search only pays for the wider ``(node, arriving way)`` state when
        this holds, so the sample graph keeps the plain ``node`` state and its
        measured expansion counts stay identical to the frontend's.
        """
        return self.turns is not None and (bool(self.turns.no) or bool(self.turns.only))


def build_graph(payload: GraphPayload) -> Graph:
    """Turn a wire payload into a searchable :class:`Graph`."""
    # Clamp on the way in, once, so no downstream code has to re-check the range.
    edges = [
        edge.model_copy(
            update={
                "congestion": clamp_congestion(edge.congestion),
                "risk": clamp_risk(edge.risk),
            }
        )
        for edge in payload.edges
    ]

    adj: dict[str, list[GraphEdge]] = {node_id: [] for node_id in payload.nodes}
    for edge in edges:
        # An edge whose endpoint is not among the nodes is dropped, matching the
        # frontend's `adj[e.from]?.push(e)` — the optional chain is a silent skip.
        if edge.from_ in adj:
            adj[edge.from_].append(edge)

    return Graph(
        nodes=payload.nodes,
        edges=edges,
        adj=adj,
        bounds=payload.bounds,
        detail=payload.detail,
        turns=payload.turns,
    )
