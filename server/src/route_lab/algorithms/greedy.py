"""Greedy Best-First Search — STUB for the algorithms team.

Greedy orders the frontier by the heuristic alone — ``h``, never ``g`` — so it
races straight at the goal, expanding very few states, but drops its optimality
guarantee: it can commit to a cheap-looking direction that turns out long.

Recipe: start from ``ucs.py``.
* Frontier: :class:`route_lab.shared.frontier.PriorityQueue`.
* Still track true cost in ``memory`` (``candidate = g + problem.cost(edge)``) so
  the route's reported cost and the trace's ``g`` are real.
* Priority to push with: ``problem.heuristic(memory.node_at[key])`` — the
  estimate only, with no ``g`` term.
* Pass the heuristic to ``record_expansion`` as A* does, so the pane shows ``h``.

Delete this ``raise`` and return :func:`route_lab.shared.search.complete_leg`.
"""

from __future__ import annotations

from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult


def greedy_best_first_search(problem: SearchProblem) -> SearchLegResult:
    _ = problem
    raise AlgorithmNotImplemented("greedy")
