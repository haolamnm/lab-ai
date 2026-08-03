"""The algorithms playground — one file per search or optimisation algorithm.

Point-search algorithms share :data:`route_lab.algorithms.base.Algorithm`, build
on :mod:`route_lab.shared.search`, and are registered in ``POINT_SEARCHES``.
Trip-level algorithms have task-specific interfaces instead: Held–Karp consumes
a directed location-cost mapping and does not belong to the point-search
registry. Import-linter guarantees nothing here can reach up into the planner or
the api, so the folder stays a self-contained playground.
"""
