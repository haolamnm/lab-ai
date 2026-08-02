"""Depth-First Search — STUB for the algorithms team.

DFS plunges down one branch to its end before backtracking. It is neither
shortest nor cheapest; it is here to show how much worse an uninformed order can
be.

Recipe (follow ``ucs.py`` for the surrounding shape):
* Frontier: :class:`route_lab.shared.frontier.Stack` (LIFO) — the most recently
  discovered state is expanded next.
* Cost: as with BFS, count hops (``memory.cost[current] + 1``); DFS does not
  minimise it, but the harness still wants a ``g`` for the trace.
* Successor rule: skip any ``key`` already in ``memory.cost``.
* Do NOT pass a heuristic to ``record_expansion`` — DFS is blind.

Delete this ``raise`` and return :func:`route_lab.shared.search.complete_leg`.
"""

from __future__ import annotations

from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult


def depth_first_search(problem: SearchProblem) -> SearchLegResult:
    _ = problem
    raise AlgorithmNotImplemented("dfs")
