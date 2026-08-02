"""A* Search — STUB for the algorithms team.

A* is UCS plus a heuristic: it orders the frontier by ``g + h`` instead of ``g``,
so it drives toward the goal and expands far fewer states while returning the
exact same optimal route (the heuristic is admissible — it never overestimates).

Recipe: start from ``ucs.py`` and change only the priority.
* Frontier: :class:`route_lab.shared.frontier.PriorityQueue`, exactly as UCS.
* Cost so far: ``candidate = g + problem.cost(edge)`` — unchanged from UCS.
* Priority to push with: ``candidate + problem.heuristic(memory.node_at[key])``.
* Pass the heuristic to the trace: call
  ``record_expansion(memory, current, problem.heuristic(memory.node_at[current]))``
  so the pane can show ``h`` alongside ``g``.

Skip a popped state when it is already in ``memory.closed`` — the same simple
staleness check UCS uses, and it stays valid here: ``h`` is fixed per state, so an
improved re-push still means a strictly lower ``g`` (hence a strictly lower
``g + h``), and the first time a state is popped it is popped at its best priority.

Delete this ``raise`` and return :func:`route_lab.shared.search.complete_leg`.
"""

from __future__ import annotations

from route_lab.algorithms.base import AlgorithmNotImplemented
from route_lab.shared.problem import SearchProblem
from route_lab.shared.search import SearchLegResult


def a_star_search(problem: SearchProblem) -> SearchLegResult:
    _ = problem
    raise AlgorithmNotImplemented("astar")
