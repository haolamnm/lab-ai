"""The run conditions half of the contract — vehicle, period, and weights."""

from typing import Literal

from pydantic import Field

from route_lab.contract.graph import Contract

VehicleKey = Literal["bike", "van", "car", "truck"]
PeriodKey = Literal["peak", "offpeak", "night"]


class Weights(Contract):
    """The four coefficients of the cost function the search minimises.

    Each is a non-negative multiplier. A negative weight would make some edges
    cheaper the worse they are and could drive an edge cost below zero, which
    silently breaks the optimality both UCS and A* rely on — the same reason
    :class:`~route_lab.contract.graph.GraphEdge` bounds congestion and risk.
    This endpoint is public and unauthenticated, so the guarantee is enforced
    here rather than trusted.
    """

    distance: float = Field(ge=0)
    time: float = Field(ge=0)
    congestion: float = Field(ge=0)
    risk: float = Field(ge=0)


class Conditions(Contract):
    """Everything about a run other than the graph and the endpoints."""

    vehicle: VehicleKey
    period: PeriodKey
    weights: Weights
