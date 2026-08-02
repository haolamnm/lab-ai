"""Breadth-First Search — STUB for the algorithms team.

BFS returns the route with the fewest road segments, ignoring cost entirely.

Recipe (follow ``ucs.py`` for the surrounding shape):
* Frontier: :class:`route_lab.shared.frontier.Queue` (FIFO) — first seen, first
  expanded, which is what makes the first path to the goal the shortest in hops.
* Cost: count hops, i.e. push each successor at ``memory.cost[current] + 1``.
* Successor rule: a state seen once is never improved, so skip any ``key`` already
  in ``memory.cost``.
* Do NOT pass a heuristic to ``record_expansion`` — BFS is blind.

Delete this ``raise`` and return :func:`route_lab.shared.search.complete_leg`.
"""

from __future__ import annotations

from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult


def breadth_first_search(problem: SearchProblem) -> SearchLegResult:
    _ = problem
    raise AlgorithmNotImplemented("bfs")
