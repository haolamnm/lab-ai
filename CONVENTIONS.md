# Coding Conventions — Route Lab

Binding rules for this repository. When a rule here conflicts with habit, the rule wins.
When a rule here conflicts with something the compiler or linter enforces, fix the code.

---

## 1. Language policy

| What | Language | Why |
|---|---|---|
| Identifiers (variables, functions, types, files, CSS classes) | **English** | Universal across the toolchain and readable by any reviewer. |
| Code comments and JSDoc | **English** | Same reason. No mixed-language comments. |
| User-facing UI strings | **English** | The app ships in English. |
| Commit messages, PR titles, docs | **English** | |
| Vietnamese place names in **data** | **Keep as-is** | `Bến Thành`, `Landmark 81`, `Hàng Xanh`, and street names returned by OpenStreetMap are real geographic data. Translating them makes them wrong and unsearchable. |

The distinction that matters: **chrome is English, data is whatever the data is.** A label reading
`Pickup` next to a value reading `Chợ Bến Thành` is correct. A label reading `Điểm lấy hàng` is not.

Never machine-translate a Vietnamese identifier into an awkward English one. Pick the term a
domain expert would use — see the glossary in §7.

---

## 2. File and directory naming

```
web/src/
  components/   PascalCase.tsx     one React component per file, named after the component
  lib/          camelCase.ts       pure logic, no React imports, no DOM access
  icons/        camelCase.ts(x)
  store.ts      the single Zustand store
  styles.css    the single stylesheet
```

- **Components**: `PascalCase.tsx`, file name === exported component name (`MapPane.tsx` exports `MapPane`).
- **Logic modules**: `camelCase.ts`, named after the concept, not the layer (`traffic.ts`, not `trafficUtils.ts`).
- No `utils.ts`, `helpers.ts`, `common.ts`, or `index.ts` barrel re-exports. A file whose name
  does not say what is inside it will become a junk drawer.
- `lib/` must stay importable without React. If a module in `lib/` needs a hook, it belongs in
  `components/` or in the store instead.

### The backend (`server/`)

§2, §3, §5, and §6 are frontend rules and stop at `web/`. `server/` is Python: `snake_case`
throughout, `uv` as the package manager, `ruff` for lint and format, and a layered-import contract
that `import-linter` enforces mechanically. `cd server && make check` is its gate.

Those rules are written down once, in [`server/README.md`](server/README.md), and are not repeated
here. §1 (language), §4 (comment style), §7 (glossary), and §9 (commits) apply to both halves
unchanged.

---

## 3. Identifier naming

| Kind | Style | Example |
|---|---|---|
| Variables, functions, object properties | `camelCase` | `edgeCost`, `reanchorAll` |
| React components | `PascalCase` | `MapPane`, `TreeView` |
| Types and interfaces | `PascalCase` | `RouteResult`, `TurnRule` |
| Module-level constants (fixed tables, tuning values) | `SCREAMING_SNAKE` | `MAX_PANES`, `ROAD_LABEL` |
| String-union members | `lowercase` | `'astar'`, `'offpeak'`, `'motorway'` |
| CSS classes | `kebab-case`, block-prefixed | `.pane-head`, `.compare-row` |
| CSS custom properties | `--kebab-case` | `--ink`, `--w-congestion` |

Rules:

- **No abbreviations that aren't already domain terms.** `graph`, `edge`, `node`, `km` are fine.
  `cfg`, `res`, `tmp`, `mgr`, `hdl` are not. Loop indices `i`/`j` and the conventional `e` for an
  event or an edge are fine where the scope is a few lines.
- **No Hungarian or type suffixes**: `nodeList`, `edgeArray`, `IRouteResult` are all wrong. Say
  `nodes`, `edges`, `RouteResult`.
- **Booleans read as assertions**: `found`, `passable`, `optimal`, `needsMoreDetail`. Not `flag`,
  not `status`, not `isOk`.
- **Units live in the name** when a bare number is ambiguous: `km`, `minutes`, `metres`,
  `costPerKm`. A field called `distance` invites the next person to guess.
- Functions are verbs (`buildGraph`, `planRoute`, `explain`); values are nouns (`graph`, `route`).
  A function returning a predicate is named for the question it answers: `passable`, `turnAllowed`.

---

## 4. Comment style

This codebase has an unusual and deliberate comment culture. Preserve it.

**Comment the decision, not the mechanics.** The code already states what it does. A comment earns
its place by recording something the code cannot: why this approach beat the obvious one, which
measurement drove a constant, what breaks if someone "simplifies" it.

```ts
// Bad — restates the code
// Loop through the edges and add the cost.

// Good — records the decision and its evidence
// Congestion and risk are multiplied by edge length. Without that, a route through many short
// blocks is penalised for its number of intersections rather than for how bad the traffic is,
// and the algorithm starts preferring long empty detours.
```

Rules:

- Write in **full sentences with a subject**. This is prose for a reader, not a telegram.
- Anchor a claim to its evidence when you have it: "measured on real OSM data for central HCMC,
  491 of 757 turn restrictions are time-conditional" beats "most restrictions are conditional".
- A comment explaining a **trap** should say what goes wrong, concretely. "Re-read this before the
  final `set()` — the user can change the pickup point during the multi-second network call, and
  writing back the snapshot silently discards their choice."
- `/** JSDoc */` on exported functions, types, and any non-obvious field. `//` for reasoning
  inside a function body.
- **No** `TODO`, `FIXME`, `XXX`, commented-out code, or changelog comments (`// changed 2026-08-01`).
  Git already stores history. Open an issue instead of leaving a `TODO`.
- Do not comment on what a comment is doing. Do not sign comments.

---

## 5. TypeScript

- `strict` is on and stays on. `tsconfig.json` also sets `noUnusedLocals`, `noUnusedParameters`, and
  `noUncheckedIndexedAccess`. A failure from the first two means delete the dead symbol, not silence
  the check. `noUncheckedIndexedAccess` types `array[i]` and `record[key]` as possibly `undefined`,
  which is the truth — handle the `undefined` branch or narrow first; do not reach for `!`.
- **No `any`.** Use `unknown` at boundaries you do not control (parsed JSON, API responses) and
  narrow with an explicit runtime check before use.
- **Non-null assertion `!` requires a reason.** It is acceptable when an invariant a few lines
  above guarantees it. It is not acceptable on external data. When `!` is load-bearing, prefer a
  data structure the compiler can verify: a `Record<Key, Value>` keyed by a string union is
  checked exhaustively; `ARRAY.find(x => x.key === k)!` is not.
- **Validate at the boundary, trust inside.** Every value entering from the network, from a user's
  JSON import, or from `localStorage` is validated once at the edge — range-clamped, `Number.isFinite`
  checked, shape checked. Past that point the types are the contract.
- Prefer `type` for unions, `interface` for object shapes. Export a type only if another module
  imports it by name.

---

## 6. React, state, and styling

- **One store.** All query state (pickup, dropoff, stops, network, conditions, criterion, weights)
  lives in the Zustand store and is read from there. No component owns a copy.
- **Select narrowly**: `useStore(s => s.graph)`, never bare `useStore()`. A bare call subscribes the
  component to every state change in the app, so dragging one slider re-renders panes that do not
  read weights.
- **Never build a fresh object or array inside a selector** — it is a new reference every call and
  defeats the equality check. Select the pieces and combine them in the component body.
- **Every effect that creates something destroys it.** Leaflet maps, layers, `ResizeObserver`s,
  `AbortController`s, timers, and non-React event listeners all get a matching cleanup. Panes are
  added and closed freely; anything that accumulates across that cycle is a bug.
- **List keys are stable identities**, never array indices — panes are drag-reorderable and closable.
- Expensive work (route planning, tree layout) goes in `useMemo` keyed on the inputs that actually
  change it, or in the store — never inline in render.
- **Styling is plain CSS** in `styles.css`, organised by block, with colours drawn from the custom
  properties in `:root`. No CSS-in-JS, no utility-class framework, no inline `style` except for
  values genuinely computed at runtime (a per-algorithm hue, a transform).
- **Colour carries meaning or is absent.** The interface chrome is white, grey, and ink. Saturated
  colour is reserved for data: congestion scale, explored region, chosen route, per-algorithm hue.
  Do not introduce a decorative colour.

---

## 7. Domain glossary

Use exactly these English terms. Consistency here is what keeps the UI, the comments, and the
identifiers readable as one system.

| Vietnamese | English | Notes |
|---|---|---|
| màn hình, ô | **pane** | one algorithm's map in the comparison grid |
| lưới | **grid** | the bento layout holding the panes |
| mạng lưới (đường) | **road network** | the graph built from OpenStreetMap |
| mức chi tiết | **detail level** | `coarse` / `medium` / `fine` / `alleys` |
| nút, nút giao | **node**, **intersection** | `node` in graph context, `intersection` in prose |
| cạnh, đoạn đường | **edge**, **road segment** | |
| tuyến, lối đi | **route**, **path** | `route` is the result shown; `path` is the node sequence |
| chặng | **leg** | one pickup-to-stop or stop-to-stop search |
| hành trình | **trip** | the whole journey across all legs |
| điểm lấy hàng | **pickup** | |
| điểm giao | **dropoff** | |
| điểm dừng, ghé | **stop** | intermediate waypoint |
| thứ tự ghé | **visit order** | |
| kẹt xe, mức kẹt xe | **congestion** | 1–5 scale |
| rủi ro | **risk** | 0–1 scale |
| quãng đường | **distance** | always in km, name it `km` in code |
| thời gian | **time**, **minutes** | |
| chi phí | **cost** | the weighted objective the search minimises |
| trọng số | **weight** | |
| tiêu chí | **criterion** | the weight preset |
| khung giờ | **time period** | |
| cao điểm / thấp điểm / đêm | **peak** / **off-peak** / **night** | |
| phương tiện, loại xe | **vehicle** | |
| xe máy / xe van / ô tô / xe tải | **motorbike** / **van** / **car** / **truck** | |
| cấp đường | **road class** | motorway, trunk, primary, … |
| hẻm | **alley** | |
| một chiều | **one-way** | |
| cấm rẽ | **turn restriction** | |
| giờ cấm tải | **truck curfew** | |
| đường chim bay | **straight-line distance** | |
| ước lượng | **heuristic** | |
| đã xét, mở nút | **expanded** | `expanded` is the count shown in the UI |
| hàng đợi biên, biên | **frontier** | |
| cây tìm kiếm | **search tree** | |
| dấu chân khám phá | **exploration footprint** | |
| bước | **step** | timeline position |
| dòng thời gian | **timeline** | |
| đồng bộ khung nhìn | **synced view** | |
| dựng lại mạng lưới | **rebuild network** | |
| đồ thị mẫu | **sample graph** | |
| tối ưu | **optimal** | |
| tối ưu hoá | **optimise**, **optimisation** | en-GB `-ise`, never `-ize`. See the spelling note below. |
| bản đồ / sơ đồ / cây | **map** / **schematic** / **tree** | the three pane views |

**Spelling is en-GB, and this one is not a preference.** The wire field is `optimiseOrder`, aliased
from Python's `optimise_order`, so the contract itself is spelled `-ise` on both sides of the
network boundary. A UI string reading "Optimize" next to a field named `optimiseOrder` makes the
same word look like two different concepts, and the next person to search the codebase for one
spelling misses half the occurrences. Renaming the wire field to `-ize` instead would be a breaking
contract change to settle a spelling argument. So: `-ise` everywhere — identifiers, UI strings,
comments, and docs. Consider this settled, not open.

---

## 8. Tooling

- **Package manager is `bun`.** Use `bun install`, `bun run build`, `bunx`. Do not run `npm` or
  `yarn`; do not commit `package-lock.json` or `yarn.lock`. The lockfile is `bun.lock`.
- Typecheck with `bunx tsc --noEmit`, test with `bun test`, build with `bun run build`. All three
  must pass before a commit. `server/` has its own gate — `cd server && make check` — which must pass
  before a commit that touches it. `make check` at the repository root runs both halves, and CI runs
  the same steps in the same order.
- **Frontend tests are `*.test.ts` beside the module they cover**, run by `bun test`, which needs no
  runner dependency and no DOM. They live under `src/` rather than a sibling `tests/` directory so
  `bunx tsc --noEmit` checks them like any other source file — a test that does not compile is not a
  test. `lib/` staying free of React (§2) is what lets the store and the planner be driven headless.
- Editor settings come from `.editorconfig`: UTF-8, LF endings, final newline, no trailing
  whitespace, and two-space indent **for the frontend**. Python is four spaces, because `ruff format`
  writes four and will reformat anything else; `Makefile` recipes are tabs, because make requires it.
  Both are declared in `.editorconfig`. Do not fight it.

---

## 9. Commits and branches

### Message format

```
<summary in the imperative, under 72 characters>
                                                   <- blank line
Why this change exists. What the previous behaviour was and what was wrong
with it. What you considered and rejected, if the choice was not obvious.
Wrap the body at 80 characters.
```

- **Imperative mood**: "Remove Dijkstra", not "Removed Dijkstra" or "Removes Dijkstra". Read it as
  finishing the sentence *"Applying this commit will…"*.
- **No trailing full stop** on the summary line.
- **English**, like everything else here.
- **The body explains why, not what.** The diff already shows what changed. A body that says
  "changed the cost function" is worthless; one that says "congestion was not scaled by segment
  length, so routes crossing many short blocks were penalised for their number of intersections"
  is the reason the commit exists.
- A commit with no body is fine **only** when the summary is genuinely complete on its own
  (`Fix typo in sidebar label`). Anything touching behaviour needs a body.

### Scope

One commit, one idea. If the summary needs an "and", it is probably two commits.

Never mix a mechanical sweep with a behavioural change. Renaming across forty files and fixing one
bug in the middle of it produces a diff nobody can review, and a `git bisect` that lands on it tells
you nothing. Land the sweep, then land the fix.

### Examples

Good:

```
Key search state on arrival segment, not intersection

A turn restriction constrains a pair of road segments, but the search
keyed its state on the intersection alone. Once a node was settled by its
cheapest arrival, a costlier arrival that would have been allowed to turn
was never tried, so a leg could report "unreachable" while a legal route
existed.

The wider state costs one entry per incoming segment instead of one per
intersection, and is only used on networks that actually carry
restrictions — the sample graph keeps the plain state, so its measured
node counts are unchanged.
```

Bad, and why:

| Message | Problem |
|---|---|
| `fix bug` | Which bug? Useless in a log six months from now. |
| `Updated store.ts and Sidebar.tsx` | Lists files, which `git show` already does. Says nothing. |
| `Refactor + fix pane reset` | Two ideas in one commit. Split it. |
| `asdf` / `wip` | Never reaches a shared branch. Squash it away first. |

### Branches

`<type>/<short-description>` in kebab-case: `feat/turn-restrictions`, `fix/pane-timeline-reset`,
`docs/readme-setup`, `chore/bump-vite`.

Do not commit directly to `main`. Open a pull request, even for solo work — the PR description is
where the reasoning lands for teammates and for the report.

### Pull requests

Title follows the same rules as a commit summary. The description covers: what changed, why, how it
was verified (`bunx tsc --noEmit`, `bun run build`, and what you exercised in the running app), and
anything deliberately left undone.
