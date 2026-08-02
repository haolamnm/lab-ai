"""The algorithms playground — one file per search algorithm.

This is the folder the algorithms team owns. Every algorithm has the same shape
(see :data:`route_lab.algorithms.base.Algorithm`), builds on the harness in
:mod:`route_lab.shared.search`, and is registered in
:mod:`route_lab.algorithms.registry`. ``ucs.py`` is a complete worked reference;
``bfs.py``, ``dfs.py``, ``astar.py``, and ``greedy.py`` are stubs waiting to be
filled in. import-linter guarantees nothing here can reach up into the planner or
the api, so the folder stays a self-contained playground.
"""
