"""Great-circle geometry — the Python side of web/src/lib/geo.ts.

Only ``haversine`` is ported: the frontend owns graph construction (bounds,
padding, hashing), so the backend never needs the rest.
"""

import math
from typing import Protocol

_EARTH_RADIUS_KM = 6371.0


class LatLng(Protocol):
    """Anything with a latitude and longitude — a graph node satisfies this."""

    lat: float
    lng: float


def haversine(a: LatLng, b: LatLng) -> float:
    """Straight-line distance between two points, in km."""
    d_lat = math.radians(b.lat - a.lat)
    d_lng = math.radians(b.lng - a.lng)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a.lat)) * math.cos(math.radians(b.lat)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))
