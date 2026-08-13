# Route Lab — backend

The planning service behind Route Lab. The frontend in `web/` already does the parts that touch the
outside world — it queries Overpass for the road network, geocodes place names, and builds the
weighted graph. This service does none of that. It receives a graph the frontend already built and
runs a search algorithm over it, nothing else. That split is deliberate: everything here is pure and
deterministic, which is exactly what makes it safe for several people to implement algorithms in
side by side.

**This is the real backend, not `web/src/lib/search.ts`.** The TypeScript in `search.ts` was a demo
that ran BFS, DFS, UCS, and A\* entirely in the browser, with no server involved — it proved
the idea and shipped the first version of the app. This Python service replaces it as the actual
planning backend, speaking the identical JSON contract (`POST /plan` in, a `RouteResult` out), so
the frontend's request and response shapes do not change, only which process answers them.

---

## Requirements

| | |
|---|---|
| **uv** | Astral's Python package manager — the backend's equivalent of the frontend's Bun. See [uv's install docs](https://docs.astral.sh/uv/getting-started/installation/). |
| **Python 3.12 or newer** | You do not need to install this yourself: `uv python install` fetches a matching interpreter, and `uv sync` will do so automatically if none is found. |

Check `uv` works:

```bash
uv --version
```

---

## Install and run

```bash
cd server
uv sync
uv run uvicorn route_lab.api:app --reload --port 8787
```

This serves on <http://127.0.0.1:8787>. `uv sync` reads `pyproject.toml` and `uv.lock` and creates
a project-local virtual environment; `--reload` restarts the server on every source change, which
matters while several people are editing files in `algorithms/` at once.

To connect the real frontend to it instead of the mock, run the frontend against this backend:

```bash
cd web
VITE_API_URL=http://127.0.0.1:8787 bun run dev
```

The port is 8787 rather than uvicorn's usual 8000 to stay clear of the range other local
services tend to claim, and the URL says `127.0.0.1` rather than `localhost` on purpose: if
anything else is listening on `::1`, the browser resolves `localhost` there first and
`POST /plan` lands on that other server as a confusing 404.

### All commands

Run these from the `server/` directory (or `make <target>` from the same place — every target below
is a thin wrapper over one of these `uv run` commands, see `Makefile`).

| Command | What it does |
|---|---|
| `make install` (`uv sync`) | Install dependencies and create the virtual environment. Reads `uv.lock`. |
| `make dev` (`uv run uvicorn route_lab.api:app --reload --port 8787`) | Dev server with hot reload. Your normal workflow. |
| `make lint` (`uv run ruff check`) | Lint with Ruff. |
| `make format` (`uv run ruff format`) | Reformat with Ruff. |
| `make typecheck` (`uv run ty check` + `uv run basedpyright`) | Two independent strict type checkers. Both must pass. |
| `make imports` (`uv run lint-imports`) | Check the layered-architecture contract described below. |
| `make deps` (`uv run deptry src`) | Find dependencies that are imported but undeclared, or declared but unused. |
| `make test` (`uv run pytest`) | Run the test suite. |
| `make check` | The full gate above, in the order CI runs it. Run this before every commit. |

There is no `bun.lock` equivalent step to remember separately: `uv.lock` **is committed**, the same
way `bun.lock` is on the frontend — see the root [`.gitignore`](../.gitignore).

### Configuration

One variable, read straight from the process environment by `_cors_origins()` in `api.py`:

| Variable | Default | What it does |
|---|---|---|
| `ROUTELAB_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origins allowed to call this backend. Add your deployed frontend origin here in production. |

Set it on the command line — there is deliberately **no `.env` file**:

```bash
ROUTELAB_CORS_ORIGINS=https://routelab.example make dev
```

There used to be a `server/.env.example`, and it did nothing: nothing in this package loads a `.env`,
there is no `--env-file` on the uvicorn invocation, and `os.environ` never sees the file. A sample
config that silently has no effect is worse than none, and one variable with a working default does
not justify the machinery to make it real.

---

## Architecture

```
server/
├── pyproject.toml
├── uv.lock
├── Makefile
├── tests/              The pytest suite `make test` and CI run. One module per unit under test.
└── src/route_lab/
    ├── contract/       Pydantic models mirroring web/src/lib/types.ts — the JSON contract itself.
    ├── shared/         The algorithm kit (see below). Pure domain logic ported from lib/traffic.ts
    │   ├── graph.py     and lib/geo.ts, plus the reusable search building blocks:
    │   ├── traffic.py   the cost model (edge_cost, passable, turn_allowed, min_cost_per_km),
    │   ├── geo.py       haversine, a min-heap, the frontier kit, the heuristic kit, the
    │   ├── heap.py      binary min-heap shared by priority-based algorithms.
    │   ├── frontier.py  Stack / Queue — the two order-only frontiers.
    │   ├── heuristics.py scaled Haversine heuristic, selected through a registry.
    │   ├── pairwise.py  directed cost matrix over every pair of trip points, for the ordering
    │   │                algorithms; each pair is one guided search.
    │   ├── rounding.py  JavaScript-compatible rounding, so a metric matches the search.ts number.
    │   ├── problem.py   SearchProblem: one leg plus its plug-n-play cost and heuristic.
    │   ├── search.py    SearchMemory + next_states/remember/record_expansion/complete_leg.
    ├── algorithms/      One file per algorithm, uniform signature. The playground.
    │   ├── base.py      The Algorithm type and the AlgorithmNotImplemented exception.
    │   ├── registry.py  Maps an AlgoKey ('bfs', 'ucs', …) to its function.
    │   ├── ucs.py       Uniform Cost Search implementation.
    │   ├── nearest_neighbor.py  Traffic-aware stop-ordering heuristic.
    │   ├── bfs.py       )
    │   ├── dfs.py       ) The other three point searches. Each differs from ucs.py only in its
    │   ├── astar.py     ) frontier and the priority it pushes with.
    │   └── held_karp.py Trip-level, not a point search: consumes a directed cost matrix and
    │                    returns the cheapest closed tour, or the cheapest open path — either
    │                    to whichever stop is cheapest, or to a required `end`. Not in
    │                    POINT_SEARCHES.
    ├── planner.py       plan_route(request) -> RouteResult: builds the leg sequence, dispatches
    │                   each leg through the registry, applies nearest-neighbour ordering,
    │                   aggregates metrics, and produces failure explanations.
    ├── diagnostics.py   Explains *why* a leg has no route: disconnected network, one-way trap,
    │                   vehicle ban, or curfew — the same four cases the frontend distinguishes.
    └── api.py           The FastAPI app: POST /plan, GET /health.
```

### The layered import rule

`import-linter` (`make imports` / `uv run lint-imports`) enforces a strict layering, high to low:

```
api  >  planner | diagnostics  >  algorithms  >  shared  >  contract
```

A layer may import the ones below it and never the ones above. Concretely: an algorithm may pull in
`shared` and `contract`, but can never reach up into `planner` or `api`; `shared` can never import an
algorithm; `contract` is a pure leaf that depends on nothing else in the package.

This is what mechanically keeps the algorithms folder decoupled and reviewable. Several people wrote
`bfs.py`, `dfs.py`, `astar.py`, and `held_karp.py` at the same time, in parallel with
the planner and API being built. Without an enforced boundary, one algorithm quietly importing another,
or reaching into the planner for a shortcut, turns every pull request into a review of the whole
package. With it, a change confined to `algorithms/*.py` is mechanically guaranteed not to touch
anything else, so a reviewer only has to read the one file that changed.

---

## The algorithm kit

Everything you need to write an algorithm is in `shared/`, and it is designed so the *only* thing
that differs between BFS, DFS, UCS, and A\* is which frontier you pick and what priority you
push with. Everything else — the graph, the cost, the heuristic, the bookkeeping, the metrics — is
provided and identical for all of them.

### The graph, and how the delivery problem maps onto it

A `Graph` (`shared/graph.py`) is intersections and road segments:

* a **node** (`GraphNode`) is an intersection, keyed by id, with a lat/lng;
* an **edge** (`GraphEdge`) is a directed road segment `from -> to`; a two-way street is two edges,
  a one-way street is one, so direction is modelled for free;
* `graph.adj[node_id]` lists the edges leaving a node — the successors you expand into;
* `graph.turns` holds turn restrictions, applied for you by the harness.

A **trip** (pickup → stops → dropoff) is split into **legs**, and each leg is one
[`SearchProblem`](#the-problem-cost-and-heuristic-sharedproblempy-sharedheuristicspy). Your algorithm solves a single leg; the planner
runs the legs in order, joins the paths, and handles multi-stop ordering. You never deal with the
whole trip — only start-to-goal on one graph.

### The frontier kit (`shared/frontier.py`)

The two order-only frontiers, with the same `push` / `pop` / truthy-length interface, so
`while frontier:` reads the same in either algorithm:

| Frontier | Discipline | Used by |
|---|---|---|
| `Queue` | FIFO — first in, first out | BFS (fewest hops) |
| `Stack` | LIFO — last in, first out | DFS (deepest branch first) |

The cost-ordered searches do **not** use a frontier class. UCS and A\* build a `Heap`
(`shared/heap.py`) directly and drive it with `pop_fresh(frontier, memory)` from `shared/search.py`:

```python
frontier = Heap()
frontier.push(memory.start_key, priority=0.0, cost=0.0)
while (current := pop_fresh(frontier, memory)) is not None:
    ...
```

The priority is the only difference between them — `g` for UCS, `g + h` for A\*. To "improve" a
state, push it again with a lower priority rather than doing a decrease-key; the older, worse entry
stays in the heap and `pop_fresh` discards it, because the state is closed by the time it surfaces.
That is why the pop and the staleness check are one call instead of a `while` loop with an
`if state in memory.closed: continue` at the top.

### The problem, cost, and heuristic (`shared/problem.py`, `shared/heuristics.py`)

Your algorithm is handed a `SearchProblem` bundling the leg and its two swappable functions:

```python
@dataclass(frozen=True)
class SearchProblem:
    graph: Graph
    start: str
    goal: str
    conditions: Conditions
    cost: CostFn  # cost(edge) -> float, plug-n-play
    heuristic: Heuristic  # heuristic(node_id) -> float, plug-n-play
```

* **Cost** is `problem.cost(edge)`. The default is the traffic cost model (`edge_cost` in
  `traffic.ts` terms: distance + time + congestion·km + risk·km, weighted). Swap it by building a
  `SearchProblem` with a different `CostFn` — nothing in any algorithm changes.
* **Heuristic** is `problem.heuristic(node_id)` — an estimate of remaining cost to the goal. The
  production system supports scaled `haversine`: great-circle distance to the goal multiplied by
  the cheapest cost per kilometre in the network. This converts kilometres into an admissible cost
  lower bound. It is selected through `HEURISTICS` by `build_problem` (`heuristic_name`, defaulting
  to `DEFAULT_HEURISTIC = "haversine"`), preserving the registry architecture for future extension.
  The wire contract has no heuristic field, so API clients cannot select a different heuristic.

### The locked output schema

Every algorithm returns a `SearchLegResult` (`shared/search.py`), and the planner turns those into
the one `RouteResult` the frontend consumes. You never build a `RouteResult` yourself — return the
leg result and the shapes are guaranteed to line up.

### The locked metric set

You do **not** compute any metrics. The harness counts the search as it runs and fills in a complete
`SearchStats` for every algorithm identically — so the comparison is honest, because no algorithm
counts itself. The full set (`shared/search.py`, surfaced in the response `Metrics`):

| Metric | Meaning |
|---|---|
| `expanded` | states taken off the frontier and expanded (one per trace step) |
| `generated` | states pushed onto the frontier |
| `reopened` | states re-reached more cheaply and re-pushed |
| `max_frontier` | the largest the frontier ever grew (peak memory) |
| `turns_blocked` | directions dropped because a turn restriction forbade them |

The planner adds the route-quality numbers (`km`, `minutes`, `cost`, `hops`, `optimal`, `ms`). To add
a new search-effort metric, add a field to `SearchStats` and to the response `Metrics` together, and
count it in the harness — never inside a single algorithm.

---

## How to implement an algorithm

Each algorithm is a plain function with this signature (`src/route_lab/algorithms/base.py`):

```python
Algorithm = Callable[[SearchProblem], SearchLegResult]
```

Steps:

1. Create the file, e.g. `src/route_lab/algorithms/beam.py`, and start it as a stub that raises
   `AlgorithmNotImplemented("beam")`. That is what lets `api.py` return a normal `RouteResult` with
   the `problem` field set, rather than a 500, while the algorithm is still unwritten — its pane in
   the browser shows a message instead of a crash. `tests/test_unimplemented_algorithm.py` pins that
   guarantee down. Register it in `registry.py` and add its key to `AlgoKey` on both sides.
2. Read `src/route_lab/algorithms/ucs.py` first. It is the complete worked reference: copy its shape,
   change only the frontier and the priority you push with.
3. Build a `SearchMemory` with `create_search_memory(problem.graph, problem.start, problem.conditions)`,
   pick a frontier — `Queue`/`Stack` from the kit for an order-only search, a bare `Heap` popped
   through `pop_fresh` for a cost-ordered one — then loop:
   - pop a state (`pop_fresh` already skips the stale entries),
   - `record_expansion(memory, current)` to append the step to the trace the frontend animates
     (pass the heuristic value too for A\*, so the pane can show `h`),
   - test `memory.node_at[current] == problem.goal`,
   - for each `next_states(memory, current)`, compute the cost with `problem.cost(edge)` and, if it
     improves on the best known, `remember(...)` it and push it onto the frontier.
4. Terminate with `complete_leg(memory, goal_or_none, started_at)`, which turns the harness's
   internal state — trace, path, and the gathered `SearchStats` — into your `SearchLegResult`.
5. The function is already wired into `src/route_lab/algorithms/registry.py`; leave it there.
6. Run `make check`. It runs the full gate — Ruff, both type checkers, `import-linter`, `deptry`,
   and `pytest` — in the same order CI does, so a green `make check` locally means a green CI run.

Do not import another algorithm module, the planner, or the API from inside `algorithms/` — that is
exactly what the layered-import contract above rejects, and `make check` will catch it via
`lint-imports` before it reaches review.

---

## The contract

The service exposes two endpoints.

### `POST /plan`

Request body — one planning request, matching `PlanInput` in `web/src/lib/search.ts`:

| Field | Type | Meaning |
|---|---|---|
| `graph` | `Graph` | The road network the frontend already built from OpenStreetMap (or the sample graph). |
| `algo` | `AlgoKey` | Which algorithm to run: `bfs`, `dfs`, `ucs`, `astar`, `nearest`, or `held_karp`. |
| `start` | `string` | Node id of the pickup point. |
| `goal` | `string` | Node id of the dropoff point. |
| `stops` | `string[]` | Node ids of intermediate stops, in the entered order when `optimiseOrder` is false. |
| `optimiseOrder` | `boolean` | Whether to reorder all destinations (intermediate stops plus dropoff). Point searches use Nearest Neighbor; Held-Karp runs its exact optimizer. The `nearest` algorithm always reorders even when false. |
| `returnToStart` | `boolean` | The shape of the trip, read by **every** algorithm. False is an open tour running `start -> stops -> goal`. True is a closed tour: `goal` becomes an ordinary stop whose position is chosen like any other, and the route comes home to `start`. |
| `conditions` | `Conditions` | Vehicle, time period, and the four cost weights. |

**The contract validates rather than repairs.** Two things follow from that, and both surface as a
422 rather than a quietly wrong route:

* **Ranges are enforced** — `km` above zero, `congestion` 1–5, `risk` 0–1, latitude and longitude
  within their real bounds. Out of range is rejected, not clamped. The frontend already clamps on
  import (`store.ts`), so a bad value arriving here means the client is not the one this contract was
  written for, and silently correcting it would hide that. A negative congestion produces a negative
  edge cost, and negative edge costs break the optimality guarantee UCS and A\* are stamped with.
* **Unknown fields are rejected** (`extra="forbid"`). A field the backend does not recognise is
  version skew between the two halves of the contract, and a client sending `optimizeOrder` for
  `optimiseOrder` gets a 422 naming the field instead of a silent `False`. `GraphPayload` is the one
  exception: it ignores extras, so a client that forgets to strip the frontend's `adj` index — which
  the backend rebuilds from `edges` anyway — still works.

Response body — a `RouteResult`: `order`, `path`, `trace`, `nodeIds`, `reveal`, `found`, `metrics`,
and an optional `problem` string explaining a leg that could not be routed (or an algorithm not
implemented yet). `order` is the visit order after any reordering, and
[`web/src/lib/types.ts`](../web/src/lib/types.ts) calls it authoritative: read the visit order from
there and never re-derive it from `path`, which is the road-by-road route and knows nothing about
stops. It is a strict superset of the frontend's own `RouteResult` type: the search-effort metrics
`hops`, `generated`, `reopened`, and `maxFrontier` are always present here but optional in
`web/src/lib/types.ts`, because the offline TypeScript planner does not report them.

### `GET /health`

A liveness check with no request body, for local smoke-testing and for whatever process supervises
this service in a deployment.

### Where the types actually live

The authoritative shapes are `web/src/lib/types.ts` on the frontend side. Everything in
`src/route_lab/contract/` is a Pydantic mirror of that file, kept in the `contract/` layer precisely
because it has to stay a pure leaf: it is the one thing every other layer in this package, and the
frontend across the network boundary, both agree on.
