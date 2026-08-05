"""The one interface every algorithm implements, and the not-yet-done signal."""

from collections.abc import Callable

from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult

# An algorithm solves one leg. It is handed a fully-assembled SearchProblem — the
# graph, endpoints, conditions, and the plug-n-play cost and heuristic — and
# returns a SearchLegResult. The signature is uniform so the registry dispatches
# any algorithm the same way, and so a heuristic-guided search and a blind one
# look identical from the outside:
#
#     (problem) -> SearchLegResult
#
# The blind searches (BFS, DFS, UCS) simply never call `problem.heuristic`; the
# guided one (A*) does.
Algorithm = Callable[[SearchProblem], SearchLegResult]


class AlgorithmNotImplemented(NotImplementedError):
    """Raised by a stub algorithm the team has not written yet.

    The api catches it and returns a normal result whose ``problem`` explains the
    gap, so an unfinished algorithm shows a clear message in its pane instead of
    turning into an HTTP 500.
    """

    def __init__(self, key: str) -> None:
        self.key = key
        super().__init__(
            f"The {key.upper()} algorithm is not implemented on the backend yet. "
            f"Implement it in server/src/route_lab/algorithms/{key}.py — follow ucs.py."
        )
