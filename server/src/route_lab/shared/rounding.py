"""JavaScript-compatible rounding, so a metric matches the search.ts reference.

Python's built-in ``round`` is round-half-to-even; the frontend rounds with
``Math.round`` (integers) and ``Number.prototype.toFixed`` (decimals), both of
which break a ``.5`` tie *upward* for the non-negative values this backend puts on
the wire. At an exact tie the two rules disagree — ``round(2.5) == 2`` but
``Math.round(2.5) == 3`` — so an otherwise clean edge could show a route one
minute shorter here than in the browser. The whole premise of this service is
that a pane shows the same numbers whichever planner ran it (see the note in
``shared/heap.py``), so every value put on the wire is rounded through here.
"""

from __future__ import annotations

import math


def js_round(value: float, digits: int = 0) -> float:
    """Round ``value`` to ``digits`` decimals, breaking ties upward like JS does."""
    factor = 10**digits
    return math.floor(value * factor + 0.5) / factor
