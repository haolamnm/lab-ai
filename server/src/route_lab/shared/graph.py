"""The internal graph the search runs on.

The wire payload (``GraphPayload``) carries ``nodes`` and ``edges`` but not the
``adj`` adjacency index — sending it would duplicate every edge in the JSON. This
module rebuilds ``adj`` from ``edges``, exactly as the frontend's
``store.importGraph`` does. Nothing is range-checked on the way through: the
contract already rejects a segment whose length, congestion, or risk is outside
the range the cost model assumes, so an arriving payload either holds or never
became a :class:`~route_lab.contract.graph.GraphPayload` at all.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from route_lab.contract.graph import GraphEdge, GraphNode, GraphPayload, TurnTable


@dataclass(frozen=True)
class Graph:
    """A road network ready to search: nodes, edges, and an adjacency index.

    The collections are typed read-only rather than as ``dict``/``list``. They
    are the payload's own objects, so ``frozen=True`` alone would be a half
    promise: it stops the fields being rebound and says nothing about mutating
    what they point at, which would corrupt the graph mid-search.
    """

    nodes: Mapping[str, GraphNode]
    edges: Sequence[GraphEdge]
    adj: Mapping[str, Sequence[GraphEdge]]
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
    adj: dict[str, list[GraphEdge]] = {node_id: [] for node_id in payload.nodes}
    for edge in payload.edges:
        # GraphPayload has already validated both endpoints, so no malformed
        # topology is silently dropped while rebuilding adjacency.
        adj[edge.from_].append(edge)

    return Graph(
        nodes=payload.nodes,
        edges=payload.edges,
        adj=adj,
        turns=payload.turns,
    )
