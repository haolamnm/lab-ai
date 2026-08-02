"""Pure, reusable domain logic — the layer every algorithm builds on.

Ports of the frontend's ``web/src/lib/geo.ts`` and ``web/src/lib/traffic.ts``,
plus the search harness that ``web/src/lib/search.ts`` shares across its
algorithms. Nothing here imports an algorithm, the planner, or the api;
import-linter enforces that, which is what lets the algorithms folder lean on
this code without the dependency ever pointing back.
"""
