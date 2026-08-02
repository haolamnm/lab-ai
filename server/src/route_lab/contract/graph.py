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
    ``extra="ignore"`` is deliberate: the frontend's ``Graph`` also carries an
    ``adj`` index whose values are the same edge objects as ``edges``. Sending it
    would duplicate every edge in the JSON, so the client strips it — and the
    backend rebuilds ``adj`` from ``edges`` itself. Ignoring unknown fields means
    a client that forgets to strip ``adj`` still works instead of erroring.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class GraphNode(Contract):
    """An intersection in the road network."""

    id: str
    lat: float
    lng: float
    # Only the sample graph carries these; nodes from OpenStreetMap have neither.
    label: str | None = None
    name: str | None = None


class GraphEdge(Contract):
    """A directed road segment connecting two intersections."""

    # `from` and `except` are Python keywords, so the fields carry a trailing
    # underscore and an explicit alias back to the bare wire name.
    from_: str = Field(alias="from")
    to: str
    km: float
    road_class: RoadClass
    # Congestion 1-5 and risk 0-1. The frontend clamps these on import; the cost
    # model in shared/traffic.py assumes the ranges hold.
    congestion: float
    risk: float
    name: str | None = None
    # Coordinates along the real road, so the frontend can draw its true shape.
    # The planner never reads this, but it is part of the graph the client sends.
    shape: list[tuple[float, float]] = Field(default_factory=list)
    # OpenStreetMap way id. Turn restrictions are recorded as pairs of way ids,
    # so without it there is nothing to match against. The sample graph has none.
    way_id: int | None = None


class TurnRule(Contract):
    """A turn restriction at one intersection."""

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
    """The graph as it crosses the wire — no ``adj``, which the backend rebuilds."""

    nodes: dict[str, GraphNode]
    edges: list[GraphEdge]
    bounds: tuple[tuple[float, float], tuple[float, float]]
    detail: Detail
    # The sample graph and imported JSON graphs carry no turn restrictions.
    turns: TurnTable | None = None
