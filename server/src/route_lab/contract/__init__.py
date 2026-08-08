"""The JSON contract shared with the frontend.

Every model here mirrors a type in ``web/src/lib/types.ts`` (or the ``PlanInput``
in ``web/src/lib/search.ts``). That file is the authoritative definition; these
are the Python side of the same wire format. Field names are Python
``snake_case`` and serialise to the ``camelCase`` the frontend sends and expects,
via a ``to_camel`` alias generator, so neither side has to translate by hand.

This package is a pure leaf: it imports nothing else from ``route_lab``, which
import-linter enforces. A contract that reached into the algorithms or the
planner would stop being a contract and start being an implementation.

Import from the module that defines the name — ``.graph``, ``.conditions``,
``.request``, ``.result`` — never from here. A re-export barrel would hide which
of the four a type belongs to, and the four are the map of the wire format.
"""
