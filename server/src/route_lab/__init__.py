"""Route Lab planning backend.

A pure search-algorithm service. The frontend in ``web/`` builds the road graph
from OpenStreetMap and geocodes addresses; this package only plans routes over a
graph it is handed, speaking the exact JSON contract defined in
``web/src/lib/types.ts`` and mirrored by :mod:`route_lab.contract`.
"""
