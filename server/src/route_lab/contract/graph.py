"""The road-graph half of the contract — mirrors the graph types in types.ts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

RoadClass = Literal["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "alley"]
Detail = Literal["coarse", "medium", "fine", "alleys"]


class Contract(BaseModel):
    """Base for every wire model.

    ``populate_by_name`` lets tests and internal code build a model with the
    Python field names while the wire still uses the camelCase aliases.
    ``extra="forbid"`` is the default because a field the backend does not know
    is a version skew between the two halves of the contract, and a client that
    sends ``optimizeOrder`` for ``optimiseOrder`` deserves a 422 naming the field
    rather than a silent ``False``. :class:`GraphPayload` overrides it; that one
    model has a documented reason to tolerate extras.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class GraphNode(Contract):
    """An intersection in the road network."""

    id: str
    # Ranges are enforced here rather than trusted: the heuristics take a cosine
    # of the latitude and a non-finite coordinate turns every estimate into nan,
    # which makes A* expand in an arbitrary order instead of failing.
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    # Only the sample graph carries these; nodes from OpenStreetMap have neither.
    label: str | None = None
    name: str | None = None


class GraphEdge(Contract):
    """A directed road segment connecting two intersections."""

    # `from` and `except` are Python keywords, so the fields carry a trailing
    # underscore and an explicit alias back to the bare wire name.
    from_: str = Field(alias="from")
    to: str
    # A zero-length or negative segment makes ``edge_cost`` zero or negative, and
    # a negative edge cost silently breaks the optimality UCS and A* rely on: the
    # first settled arrival at a node stops being its cheapest one.
    km: float = Field(gt=0, allow_inf_nan=False)
    road_class: RoadClass
    # The cost model in shared/traffic.py assumes these ranges hold — congestion
    # below 1 drives the cost negative, and the jam factor below zero. Rejecting
    # an out-of-range value is better than clamping it, which would answer a
    # different question than the caller asked and never say so.
    congestion: float = Field(ge=1, le=5)
    risk: float = Field(ge=0, le=1)
    name: str | None = None
    # Coordinates along the real road, so the frontend can draw its true shape.
    # The planner never reads this, but it is part of the graph the client sends.
    shape: list[tuple[float, float]] = Field(default_factory=list)
    # OpenStreetMap way id. Turn restrictions are recorded as pairs of way ids,
    # so without it there is nothing to match against. The sample graph has none.
    way_id: int | None = None


class TurnRule(Contract):
    """A turn restriction at one intersection."""

    # `no_left_turn`, `only_straight_on`, and so on. Nothing here reads it —
    # ``turn_allowed`` dispatches on which of the two tables the rule came from —
    # but every rule the frontend builds from OpenStreetMap carries it, so the
    # field is declared rather than rejected.
    kind: str
    # Time windows this rule applies in, minutes since midnight. Empty = all day.
    hours: list[tuple[int, int]] = Field(default_factory=list)
    # Vehicle keywords exempted from the rule, per OpenStreetMap.
    except_: list[str] = Field(alias="except", default_factory=list)
    # For an `only_*` rule, the single way id allowed to continue onto.
    only_to: int | None = None


class TurnTable(Contract):
    """Turn-restriction lookup, keyed exactly as the frontend builds the keys.

    ``no`` is keyed ``{node}|{from way}|{to way}`` (the banned pair) and ``only``
    ``{node}|{from way}`` (the sole allowed direction).
    """

    no: dict[str, list[TurnRule]] = Field(default_factory=dict)
    only: dict[str, list[TurnRule]] = Field(default_factory=dict)


class GraphPayload(Contract):
    """The graph as it crosses the wire — no ``adj``, which the backend rebuilds.

    This is the one model that ignores unknown fields instead of rejecting them.
    The frontend's ``Graph`` also carries an ``adj`` index whose values are the
    same edge objects as ``edges``; sending it would duplicate every edge in the
    JSON, so the client strips it and the backend rebuilds it from ``edges``. A
    client that forgets to strip it still works rather than getting a 422 about a
    field the backend was going to derive anyway.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    nodes: dict[str, GraphNode]
    edges: list[GraphEdge]
    # The map viewport and the road classes the network was built at. Both are
    # the frontend's own bookkeeping and nothing here reads them; they are
    # declared, and optional, so the wire format stays a mirror of types.ts
    # without making a caller invent values the planner will not use.
    bounds: tuple[tuple[float, float], tuple[float, float]] | None = None
    detail: Detail | None = None
    # The sample graph and imported JSON graphs carry no turn restrictions.
    turns: TurnTable | None = None
