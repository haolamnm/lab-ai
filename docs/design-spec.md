# Route Lab — UI/UX Design

**Date:** 2026-07-31
**Scope:** Frontend for Lab 1 — Search Algorithms for Vietnamese Traffic Route Optimization
**Owner:** UI/UX and frontend code. The algorithms are built by another team member, connected via FastAPI.

---

## 1. Background

The assignment calls for an app that finds optimal routes in Vietnamese urban traffic. The team chose a **delivery scenario in TP.HCM**.

This document describes the interface, the interaction flow, and the frontend data contract required from the backend. The algorithms themselves are out of scope here.

## 2. Constraints from the assignment

The interface is directly or indirectly responsible for 35 of the 100 points:

| Item | Points | What the interface must do |
|---|---:|---|
| Visualize the search process | 10 | Show step by step: expanded nodes, frontier, final route |
| Explain the route and compare options | 10 | Place the options side by side, state clearly why one was chosen |
| Vietnamese traffic context | 10 | Real roads, real place names, readable congestion levels |
| Demo video | 5 | The interface must film clearly and read well on camera |

The assignment requires letting the user choose: start point, destination, intermediate stops, algorithm, optimization criterion. It must display: the route taken, the visit order, the number of nodes expanded, total distance, total time, total cost, processing time.

## 3. Decisions locked in

**Road network built dynamically from OpenStreetMap.** The user picks the pickup point and the dropoff point anywhere at all, the app loads the real roads inside the bounding box around those two points, and reduces them to a graph. There is no fixed list of locations. This is the "simplified real-world" kind of data the assignment allows, and it is far more compelling than a hand-drawn graph.

**Map: Leaflet, CARTO Positron basemap.** Lightweight, draws markers and polylines directly. A light grey background means every saturated color on screen is a color the app drew itself. Not using Google Maps: it costs money, and its Directions API can easily give the impression the team didn't build the algorithms itself.

**Stack:** Vite, React, TypeScript, Zustand, Leaflet. No external grid library — drag-and-drop uses native HTML drag and drop, resizing uses CSS `resize`.

**Typefaces: IBM Plex Sans and IBM Plex Mono.** Both have a complete Vietnamese character set, with tone marks placed correctly.

## 4. Two design principles

**The interface has no color of its own — only data has color.** The application chrome uses only white, grey, and ink. Every saturated hue that appears carries meaning: green through red is the congestion level, blue is the region the algorithm has expanded, black ink is the chosen route. In a comparison tool, any color that carries no meaning is noise.

**The machine speaks in monospace, people speak in regular type.** Every number, algorithm name, and step count is set in IBM Plex Mono. Labels, instructions, and descriptions are set in IBM Plex Sans. A glance tells you which is a measured value and which is the interface talking.

The most important consequence: **what distinguishes the algorithms is not the route, but the exploration footprint.** UCS and A\* always return the same route, because both are optimal on the same cost function (UCS *is* Dijkstra, which is why it isn't split out as a separate algorithm). The difference lies in how many nodes must be expanded and the shape of the region that spreads out. Measured on the Bến Thành to Landmark 81 route: UCS expands 263 nodes, A\* expands 197. The interface must foreground the process — the final route is only the outcome.

So expanded nodes **fade over time** instead of staying at a fixed intensity — the viewer sees the direction of the spread, not just the region it has already covered.

## 5. Screen architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Route Lab · TP.HCM delivery   [Synced view]  legend              │
├──────────────┬───────────────────────────────────────────────────┤
│ TRIP         │ ┌────────────────────┐ ┌────────────────────┐     │
│  Pickup …    │ │ A*        step 128 │ │ BFS       step 128 │     │
│  Stop …      │ │ ┌────────────────┐ │ │ ┌────────────────┐ │     │
│  Dropoff …   │ │ │      MAP       │ │ │ │      MAP       │ │     │
│              │ │ └────────────────┘ │ │ └────────────────┘ │     │
│ ROAD NETWORK │ │ 5.53 km  15 min    │ │ 5.54 km  15 min    │     │
│  Detail level│ └────────────────────┘ └────────────────────┘     │
│  [Build]     │ ┌────────────────────┐  ┌──────────────┐          │
│  483 nodes   │ │ DFS       step 128 │  │ Add pane     │          │
│              │ └────────────────────┘  └──────────────┘          │
│ CONDITIONS   │                                                   │
│  Time period │                                                   │
│  Vehicle     │                                                   │
│  Strong/Weak │                                                   │
│              │                                                   │
│ CRITERION    │                                                   │
│ WEIGHTS      ├───────────────────────────────────────────────────┤
│ [Run]        │ Back Run Forward  Step 128/263  ────●────  1x     │
└──────────────┴───────────────────────────────────────────────────┘
```

### Sidebar

The single source of truth for the query. No pane is allowed to edit these values. Changing any value clears every pane's old results at once and returns them all to the not-yet-run state — no pane is allowed to keep showing an old result while another shows a new one.

Five groups: trip, road network, conditions, criterion, weights.

The four weight sliders are named for the quantity each controls: *distance, time, congestion, risk*. The assignment requires explaining how the weights were chosen; dragging a slider in front of the grader and pointing out how the route bends is far more persuasive than writing a formula in the report.

### Startup state

The grid starts completely empty. No pane is pre-built, and there is only **one** invitation to add a pane — the dashed placeholder cell only appears once the grid already holds at least one pane. The run button stays locked until there is both a network and a pane.

### Bento grid

Each pane is an independent map with its own algorithm list, dragged by its header to reorder, dragged by its corner to resize, with its own close button. **Limited to one pane per algorithm** (`MAX_PANES = ALGOS.length`, six today): a cap below the number of things there are to compare is an arbitrary limit rather than a design, and the grid wraps at two columns and scrolls, so an extra pane costs a row rather than the 300px each cell needs to stay readable.

The view stays synced across every pane, and can be switched off with a button on the top bar when a spot needs a closer look.

A pane added midway through automatically runs against the current query right away — no pane is ever left out of phase.

### Shared timeline

A single bar controls everything. Drag to step 128 and every pane shows the state of its own algorithm at step 128. The viewer sees it directly: at the same step 128, A\* has already reached the destination while BFS is still spreading. A pane that finishes early shows the label *done at step N* and then holds still.

Deliberately, panes are **not** allowed to run at their own individual speed — doing so would destroy the ability to compare them.

### Three view modes within each pane

Three tabs sit at the top of each pane, each mode answering a different question. Tabs, not a single cycling button: the user sees all three options and clicks straight to the one they want, instead of guessing how many more clicks it takes to get there.

**Map** — the real CARTO basemap, real street names, edges tinted by congestion level. Answers "what does this route avoid." This is the mode that carries the ten points for Vietnamese traffic context.

**Schematic** — strips the basemap away entirely, leaving just the road grid on a paper background, with edges receding to a neutral tone. With a clean background, the only color left is the algorithm's, and the exploration footprint stands out with nothing competing against it.

**Tree** — lays out the search tree in a radial layout. Every node that gets expanded has a parent; the set of those parent–child pairs is a genuine tree, and **the shape of the tree is the algorithm's portrait**. DFS produces a long chain with almost no branching, BFS produces a fan spreading out evenly by layer, A\* produces a teardrop skewed toward the destination, UCS a circle. Put four trees side by side and the difference is understood instantly, no words needed.

Uses a **radial layout by depth** rather than a force simulation: computed once and done, always identical across runs so the comparison stays meaningful, and it costs no physics iterations per frame. Traversed with an explicit stack, since a DFS tree runs hundreds of levels deep.

The viewport takes a **tight bounding box around the nodes**, not a square sized to the largest radius — a radial tree rarely fills its circle, especially for A\*, so a tight box lets the tree occupy four to five times more of the pane's area. Scroll to zoom (0.6× to 40×, the point under the cursor stays fixed), drag to pan, double-click to fit the pane. Dot size and stroke width are divided by the zoom level so they hold a constant size on screen: zooming in spreads the branches apart, it doesn't inflate the whole tree. Dot size is measured against the distance between two levels — always equal to 1 — rather than against the bounding box, because the bounding box of a deep tree widens out while the levels stay exactly that far apart.

### Custom-designed sample graph

The assignment separates out the part where the algorithms are explained and requires the team to build its own illustrative example, not copy one from a tutorial. The OpenStreetMap network can't be used for that: hundreds to thousands of nodes, node IDs that are coordinate strings — no one can trace that by eye.

The **Sample graph** button loads a graph of twenty nodes and thirty-four edges, each node carrying a letter and the name of a real place in TP.HCM. It exceeds the assignment's minimum of twenty nodes and thirty edges, so this set can be submitted as-is.

The numbers weren't picked at random. Measured on the A → J route, motorbike, peak hour:

| Algorithm | Nodes expanded | Distance | Route |
|---|---:|---:|---|
| BFS | 19 | 12.4 km | A→C→L→F→K→J |
| DFS | 9 | 21.8 km | A→O→N→M→K→J |
| UCS | 19 | 11.4 km | A→D→E→F→K→J |
| A\* | 11 | 11.4 km | A→D→E→F→K→J |

Four algorithms produce three different routes. The four vehicle types also split into two: the motorbike threads through the E–F congestion cluster at Hàng Xanh because it can weave through, while the van, car, and truck all detour around via Landmark 81.

The **Import file** button reloads the graph from JSON, so the team can hand-edit the dataset and reload it — genuinely "custom-designed."

## 6. Choosing locations and building the road network

A three-step flow, replacing a fixed list of locations:

1. **Type any place name.** The app queries Nominatim, restricted to Vietnam. It waits 350ms after the user stops typing before querying, and cancels the previous query when a new one comes in.
2. **Build the road network.** Calls Overpass for every road inside the bounding box around the selected points, expanded by 22% so the algorithm has room to route around obstacles. Simplify: keep only intersections, merging the straight segments in between into a single edge that carries the road's real shape. Keep only the largest connected cluster of roads.
3. **Pin.** Each location is snapped to its nearest intersection, with the distance shown clearly in meters.

The distance label is mandatory, not decoration: it states honestly that the algorithm runs on intersections, not on doorsteps, and turns a limitation of the model into transparent information.

**Three detail levels** can be toggled: coarse (major roads), medium (adds medium roads), fine (adds small roads too). The detail level determines graph size — measured on the Bến Thành to Landmark 81 route: 483 nodes at the coarse level, 679 at medium, 2241 at fine. Above 900 nodes, the interface warns that the animation will be long and slow.

Traffic conditions for each road segment are simulated from the road class plus a fixed amount of noise keyed to the way ID: running it again any number of times produces the same result, which is what makes comparison meaningful.

The submission should switch from Nominatim to **Goong**, since its Vietnamese address suggestions are considerably better. Goong requires an API key, so this build uses Nominatim so it runs right away; switching only requires replacing the body of one function.

### Building intersections: an audit against real data

Three questions about how intersections are built, answered by measurement rather than by reasoning. Measurement area: the bounding box between Nhà thờ Đức Bà and Thảo Điền, 4.260 roads, 16.224 points.

**What identifies a node.** The first version rounded coordinates to five decimal places (~1,1 m) and concatenated them into a node ID. Measured again, that approach counts out **3.929 intersections, exactly matching the count from the real node IDs** — not a single node off. But it **incorrectly merges 17 pairs of nodes that are actually separate**, meaning it fabricates 17 paths that don't exist, typically where an overpass and the road beneath it happen to share coordinates. Overpass already returns a `nodes` array, so switching to real node IDs wipes out that whole class of error at no extra cost. The rounded coordinate is kept as a fallback.

**Missing road classes.** The first version only queried six major road classes, dropping all `*_link` branches — the ramps up to and down from overpasses and grade-separated interchanges. Without them, there is no way up onto, or down off of, a major arterial:

| Detail level | Strongly connected cluster (old) | With `*_link` added |
|---|---:|---:|
| Coarse | 438 / 664 — 66% | 580 / 857 — 68% |
| Medium | 716 / 971 — 74% | **961 / 1135 — 85%** |
| Fine | 4315 / 5040 — 86% | **4731 / 5169 — 92%** |

The measurement area has 199 such link branches. Adding them, the Đức Bà – Thủ Thiêm route goes from 239 up to **437 nodes**, the destination pin moves from 1260 m down to **723 m**, and the returned route goes from 3,77 km up to **5,0 km** — far closer to reality. `unclassified` and `living_street` are pulled in too, folded into `residential`.

**One-way tags.** Added `oneway=-1` (travel runs opposite to the point order — the edge must be reversed, not dropped), `oneway=true/1`, `junction=circular`, and the implicit convention that motorways default to one-way. Measured within the area, all four cases came back at zero — Vietnamese data doesn't use them — but handling them correctly costs only one line, so it's done anyway.

### Turn restrictions

Measured before writing any code, because it isn't worth building an entire subsystem for an empty set. The number of `type=restriction` relations in the OpenStreetMap data:

| Area | Roads | Turn-restriction relations |
|---|---:|---:|
| Greater TP.HCM | 45.404 | 1.350 |
| Central Hà Nội | 3.861 | 487 — **12,6 per 100 roads** |

The data is dense and worth using. About 76% have a `via` that is a single intersection, so they're usable right away; 24% have a `via` that is an entire road, meant for multi-branch junctions, needing a completely different model, so those are skipped — better to miss one restriction than to build one wrong.

The surprise is in how Vietnamese mappers tag things. Of 757 relations in central TP.HCM, **491 use `restriction:conditional`** instead of `restriction`, and **459 carry `except`**:

```
"restriction:conditional": "no_left_turn @ (06:00-09:00,16:00-19:00)"
"except": "motorcycle;bicycle;mofa;moped"
```

In other words: cars are banned from turning left during peak hours, motorbikes are not. That lines up exactly with two axes the app already has — time period and vehicle type — so turn-restriction signs become the place where those two choices meet.

The app only has three time periods, while the signs record real clock times, so each period is assigned a **representative timestamp**: peak 17:30, off-peak 13:00, night 22:00. The question asked is whether that timestamp falls inside the restriction's window. This gives a clear-cut result that can be explained in one sentence, far better than overlapping two time ranges — where a fifteen-minute overlap would get the whole period treated as restricted.

Measured on the Đức Bà – Landmark 81 route, at the "fine" level, 124 readable turn restrictions (92 with a time window, 111 with an exemption):

| Vehicle | Peak | Off-peak | Night |
|---|---:|---:|---:|
| Motorbike | blocked 3 times | 3 | 3 |
| Car, van | **22** | 18 | 6 |
| Truck | 3 | 3 | 2 |

Motorbikes are nearly immune, cars get blocked seven times as often at peak. It's something anyone who drives in Sài Gòn already knows, and now it's sitting in the data instead of in anecdote.

**One thing to state plainly:** on the routes measured, turn restrictions **do not** change the final route — they block directions the cheapest route was never going to use anyway. Their value lies in a more correct model and in the gap in numbers between vehicle types, not yet in the route-finding outcome itself.

**An approximation, and where it approximates.** Turn restrictions constrain a **pair** of road segments, while the search algorithm on the node graph only remembers one parent node per node. The handling here is therefore an approximation: it **never generates a route that breaks the rules**, but it may miss a cheaper legal route that would require entering that node from a different direction. Getting it exactly right would need to search on an edge graph, with the number of states growing with the degree of each node.

This is deliberately **not** counted in the "optimal" column. Every run on a real road network hits at least one turn restriction somewhere, so folding it in would turn every result into "approximate" and the column would lose all ability to tell UCS apart from DFS — the exact thing it exists to do. Instead, the block count is shown separately at the foot of the pane, and the explanation block states the limitation clearly.

### Time period must act through the congestion level, not through the base speed

The first version multiplied the base speed by the time period. It was wrong in a subtle way: multiplying speed multiplies it the same way for **every** vehicle type, so a motorbike's lane-splitting advantage turns into a fixed ratio. Measured over one kilometer of arterial road:

| | Peak | Off-peak |
|---|---:|---:|
| Motorbike, congestion slowdown | ×1,92 | ×1,92 |
| Car, congestion slowdown | ×2,93 | ×2,93 |

Identical. Meaning the model says that at two in the morning a motorbike is still faster than a car by that exact same percentage — which isn't true.

What changes with time of day is **whether the road is congested**. So the time period is multiplied into the congestion term (`peak 1,00 · offpeak 0,55 · night 0,18`), and the base speed is corrected to match: motorbike 0,95, car 1,10 — on an open road, the car is faster.

| | Before | After |
|---|---:|---:|
| Peak | motorbike faster by 36% | 14% |
| Off-peak | 31% | 6% |
| Night | 31% | **0%** |

Over 1 km of open road: car 1,70 minutes, motorbike 1,97 — the car wins. Over 1 km at congestion 5/5 during peak hour: car 5,00, motorbike 3,80 — the motorbike wins. The advantage flips exactly where it should, and the "Speed" scale in the interface updates automatically, since it's derived from the same coefficients.

### Fourth detail level: alleys

The alley network is what sets Vietnamese motorbike shippers apart from every other vehicle, and the first version **didn't have it**. Counted across the central TP.HCM area:

| Road class | Number of roads | |
|---|---:|---|
| `service` | 5794 | not loaded — of which **4345 are `service=alley`**, i.e. alleys |
| `residential` | 2414 | currently loaded |

What the app calls "fine" is really residential streets, which cars enter normally — so the motorbike has no distinct advantage there at all. Measured before the fix: a car covers the exact same 0,5 km of "fine" road as a motorbike, with the time difference coming entirely from the congestion coefficient.

The data also states plainly whether cars can enter: of the 4345 alleys, 27% are tagged `motorcar=destination` and 10% are tagged `motorcar=no`. The model: `service=alley` becomes its own road class, `alley`, passable only by motorbike; any alley tagged `motorcar=yes` is treated as a residential street (measured for exactly one route).

Alleys have to be queried with a separate Overpass clause, and must filter precisely for `service=alley` — pulling in all of `service` would also sweep in parking-lot entrances and driveways, things that don't connect anywhere.

Measured over a 1,5 km stretch in Quận 1–Quận 3:

| | "Fine" level | "Alleys" level |
|---|---|---|
| Graph | 946 nodes, 2030 edges | **2793 nodes, 6480 edges** (3343 alley edges, 129 km) |
| Motorbike | 2,15 km · 9 min | **2,09 km** · 9 min · includes 0,1 km of alley |
| Car, van | 2,15 km · 11 min — **same route** | **2,36 km** · 12 min — **different route** |

Before the fix, all three vehicle types took the same road. After the fix, the motorbike gets its own route, 11% shorter, for the real reason.

The cost: the graph is three times heavier, loading takes ~21 seconds. So this level's limits are set very tight (1,4 km corridor, 14 km² area), it only works for trips under roughly 3 km, and it is **never auto-selected as a fallback** when another level is disconnected — it has to be the user's decision.

### Vehicle comparison table

The pane grid compares **algorithms**: one pane per algorithm, the same trip. Vehicle type is the opposite — it's a single choice shared across the whole grid, so finding out where a truck differs from a motorbike means clicking to change vehicle and remembering the old numbers yourself. That's not really a comparison.

The **Vehicle comparison** block below the explanation panel runs all four vehicle types in one pass, holding the current algorithm, time period, and weights fixed. Columns: distance, time, cost, number of banned edges, number of turn-restriction blocks, farthest pin distance, and a route-group letter — matching letters mean the same road was taken.

It isn't enough to just change `vehicle` and rerun four times, because **each vehicle type pins to a different intersection**: a spot a motorbike can stop at isn't necessarily one a truck can pull away from. The table re-pins for each vehicle on its own; skip that step and you're comparing two different things.

Only computed when the user opens it. Each computation is four full search passes — measured on a 1701-node graph it takes 19–34 ms, fast enough on a click, but running it in the background on every slider nudge would make the interface stutter.

Measured on Đức Bà – Landmark 81, A\*, at the fine level:

| Vehicle | Peak | Off-peak | Banned edges (peak → off-peak) |
|---|---|---|---|
| Motorbike | 4,75 km · 14 min | 4,75 km · 11 min | 0 |
| Van, car | 4,75 km · 22 min | 4,75 km · 16 min | 0 |
| Truck | **4,54 km** · 29 min | **4,08 km** · 20 min | 2951 → 2184 |

The first three vehicles take the same road, differing only in time. The truck takes its own route, and that route even changes with the time period.

### All weights at zero

Dragging all four sliders to 0 makes the cost function return 0 for every road segment, so every route has an equal cost. Measured on the sample graph:

| | Balanced | All four weights at zero |
|---|---|---|
| UCS | 11,4 km · OPTIMAL | **20,7 km · still OPTIMAL** |
| A\* | 11,4 km · expands 11 nodes | 20,7 km · expands 10 nodes, identical to UCS |

Mathematically, no statement here is false: the 20,7 km route genuinely does have the lowest cost, because every route costs 0. A\* degenerates because its heuristic multiplies distance by the lowest cost per kilometer, and that number is also 0, so h = 0. But a user who reads the word "optimal" next to a meandering route can only conclude the app is broken.

Handling: `costIsFlat` detects this case, drops the "optimal" tag on every algorithm, shows a warning right below the four sliders, and the explanation block states the cause instead of the usual claim of optimality. It doesn't block the user — they can still drag everything to 0 if they want to see what happens.

### Truck curfew

Trucks used to be banned from both `residential` and `tertiary` all day, i.e. 75% of edges at the high detail level. Too aggressive: a light delivery truck can still use side roads, it just can't fit into an alley.

What actually blocks trucks downtown isn't the road class but the **truck curfew** — a time-based restriction. So it's split in two:

- All-day ban: `residential` only.
- Truck curfew, peak period only: adds `tertiary` and `secondary`.

Vans are fully exempt — that's the real reason delivery companies in Vietnam use vans.

Measured on the same route: a truck travels **4,54 km at peak** but **4,08 km off-peak and at night**. Time period now changes not just speed, it changes which network is even reachable. So changing the time period must also re-pin locations, just like changing vehicle: a spot a truck can park at midday might not be one it can pull away from at peak hour.

**Not yet modeled:** turn restrictions whose `via` is a road, weight-based limits (`maxweight`), and administrative-zone truck bans. Stated plainly so no one assumes it's already there.

### Differences between vehicle types only show up at the "fine" level

Measured on the Đức Bà – Landmark 81 route, same origin and destination:

| Level | Motorbike | Van | Car | Truck |
|---|---|---|---|---|
| Medium | 3,71 km · 11 min | 3,71 km · 16 min | 3,71 km · 16 min | 3,71 km · 25 min |
| Fine | 4,75 km · 14 min | 4,75 km · 22 min | 4,75 km · 22 min | **3,71 km** · 25 min |

At the "medium" level all four vehicles take the **same route**, differing only in time and cost. The reason makes sense: that level only has `trunk`, `primary`, `secondary`, and motorbikes are only banned from motorways while trucks are only banned from `residential` and `tertiary` — none of those classes are present, so **no edge is banned for any vehicle**.

At the "fine" level, trucks are banned from 2712/3598 edges and forced to hug the major arterials, producing a completely different route. So when filming a video to illustrate the difference between vehicle types, it has to use **the sample graph or the "fine" level** — at the "medium" level the difference is only in time, not in the path taken.

### The retained cluster must be strongly connected

The downloaded road network always has stray disconnected fragments, so only one cluster is kept. That cluster must be **strongly connected** — following the direction of travel from any node reaches every other node — not merely connected in the sense of ignoring direction.

One-way streets make those two notions very different from each other, and in Vietnam that gap is large. Measured directly on Overpass data around central Sài Gòn: **1414 of 1931 roads carry the `oneway=yes` tag, i.e. 73%**, mostly because boulevards with a median strip are drawn as two parallel one-way roads.

The consequence of checking undirected connectivity, measured on the Nhà thờ Đức Bà to Thủ Thiêm route at the "medium" level:

| Method | Nodes kept | Reachable forward from the start point |
|---|---:|---:|
| Undirected connectivity (old) | 506 | 374 / 506 — 132 nodes no road leads to |
| Strong connectivity (now) | 239 | 239 / 239 |

The old version would build the network and **report success**, pin two points 83 m and 142 m away, and only then would the algorithm report unreachable — with the explanation wrongly blaming a disconnected network, when the road was actually still connected, just facing the wrong way. This is the worst kind of bug: every signal says everything is fine right up to the very last step.

Uses **Kosaraju's algorithm**, traversed with an explicit stack because the network has thousands of nodes. Remeasured on four routes after the fix, all reach 100% of nodes and all find a route.

The cost paid: with a smaller cluster, some points end up pinned farther away — Thủ Thiêm goes from 723 m up to 1260 m, because most of the roads in there are one-way dead ends. In exchange, any two points within the retained network are guaranteed to reach each other, so moving the origin and destination never requires rebuilding the network.

## 7. Delivery vehicles

Four vehicle types, each with different strengths and weaknesses, so the same two points can still produce different routes. This is where the problem is at its most distinctly Vietnamese — motorbike shippers and trucks genuinely don't take the same roads.

| Vehicle | Strengths | Weaknesses |
|---|---|---|
| Motorbike | Can weave through when congested, can enter small roads | Banned from motorways, low cargo, higher risk |
| Van | Can use every road class, the most balanced | Not the fastest at anything, under any condition |
| Car | Fast on major arterials, safe | Helpless in congestion, can't weave through |
| Truck | Largest cargo capacity | Banned from small roads and alleys, slow, heavily penalized on risky segments |

Modeled with three coefficients: a speed multiplier, a congestion-sensitivity factor, a risk factor — plus a list of banned road classes.

**Changing vehicle must re-pin the points.** A spot a motorbike can stop at isn't necessarily one a truck can enter. Skip this step and choosing a truck reports every route as unreachable, even with a main road right next door. Measured in practice: the motorbike pins 59m into an alley, the truck has to pin to a main road 92m away and takes a longer but bigger route.

### When there is no route

Even with correct pins, a route may still be unreachable — an area that only connects to the network via a motorway leaves the motorbike stuck, even though the network is fully connected. "Unreachable" on its own only says something is broken, not what to do next, and its two causes call for opposite fixes: a disconnected network needs rebuilding, while a vehicle ban means the network is fine and only the vehicle needs to change.

Telling the two cases apart costs only two breadth-first traversals — one with every constraint dropped, one for each remaining vehicle type — so it just states the reason outright:

> Motorbike can't get through: every road connecting the two points has to pass through a motorway, and motorbikes are banned there. Switching to a van, car, or truck will get through.

Along with two rules about how numbers are reported:

- **No route means nothing to optimize.** `metrics.optimal` must check `found` too, not just read the algorithm's theoretical property. This used to stamp "OPTIMAL" on an empty result, right next to the line reading "unreachable."
- **Never show a fake zero.** Distance, time, and cost at zero aren't because the route is short but because there is no route at all. The foot of the pane keeps only two numbers that are real: how many nodes were expanded and how long it took before giving up.

By the same logic, `order` only lists the points actually reached: whichever leg gets blocked, the points after it were never reached, and naming them would be stating something false.

## 8. Cost function

```
cost = w₁·distance + w₂·time + w₃·congestion·distance + w₄·risk·distance
```

The congestion and risk terms are **multiplied by length**, not added as a flat lump. Three hundred meters of heavy congestion can't be counted the same as three kilometers of heavy congestion, and the network pulled from OpenStreetMap has plenty of segments only a few dozen meters long — a flat lump sum would unfairly penalize any route that passes through many intersections.

Multiplying by length gives a second benefit: every term is proportional to distance, so the lower bound A\* uses for its heuristic becomes tight. Before the fix, A\* expanded 516 nodes against UCS's 546 — nearly useless. After the fix, 197 against 263.

**A\*'s heuristic** is the straight-line distance multiplied by the lowest cost per kilometer anywhere in the whole network. This still never overestimates, so A\* keeps its optimality, but it's far tighter than using the raw kilometer figure directly. **Whoever writes the algorithm must use this exact formula**, or the numbers on the two sides won't match.

## 9. Visual language

**Color conflict.** Two information systems sit on the same roads: each segment's congestion level, and the route the algorithm chose. They're separated by material, not by color:

- **The road base shows the congestion level**, a green-to-red scale over the 1–5 range, a thin, slightly faded line. Always visible, even before a run.
- **The chosen route is drawn in black ink**, a thick white outline wrapping a black core running through the middle. Ink sits outside every data color scale, so it can never be mistaken for one, and reads like a pen stroke laid onto the map: the city's conditions are color, the algorithm's decision is ink.

**Node state** is distinguished by both color and size:

| State | Appearance | Meaning |
|---|---|---|
| Untouched | small grey dot | the algorithm doesn't know about it yet |
| In the frontier | hollow circle, light blue outline | waiting to be expanded |
| Expanded | solid blue dot, fading over time | finished being expanded |
| Being expanded | large circle, dark blue outline | the focus of the current step |

Pickup, stop, and dropoff points are distinguished by **shape**, not by adding a new color: circle, diamond, square.

**No icons are used.** Buttons carry words: Back, Run, Forward, Close, Delete. In an interface built for measurement, words say it more precisely than pictures.

## 10. State model

Three blocks, which is why the panes never drift out of sync with each other:

```ts
query    : { start, goal, stops[], detail, period, vehicle, criterion, weights }
panes    : { id, algo, result }[]
timeline : { step, playing, speed, maxStep }
```

Panes do **not** keep a copy of the query.

The trace stores nodes as **indices** rather than string IDs: a single run over a network of a few hundred nodes generates tens of thousands of queue entries, and multiplied across six panes, storing strings would waste memory for nothing.

## 11. API contract

**Current state: the split is decided by `VITE_API_URL`.**

Graph construction is always in the browser: `lib/overpass.ts` queries OpenStreetMap and builds the
weighted graph, and the backend never touches the network. Planning is the part that moved. When
`VITE_API_URL` is set, `store.ts` sends every pane through `lib/planClient.ts` to `POST /plan` on the
Python service in `server/` — every graph, the sample one included, so two panes on one screen can
never be computed by two different planners. When it is unset, `lib/search.ts` runs BFS, DFS, UCS,
and A\* in the browser as before, and a pane set to Held–Karp says it needs the backend rather than
silently substituting a heuristic answer.

The endpoint sketch below is what this document *proposed*; it is not what shipped. The real
contract is one endpoint, `POST /plan`, taking the whole graph in the request body — the service is
stateless and has no `GET /api/graph` because it never builds a graph. See
[`server/README.md`](../server/README.md) for the shipped request and response shapes. The
requirements that follow the sketch — `nodeIds`, the `algo` field name, and a non-empty `trace` —
all survived into it unchanged, and are the reason it works.

```
GET  /api/graph?points=lat,lng;lat,lng&detail=coarse|medium|fine
  → { nodes: [{ id, lat, lng }],
      edges: [{ from, to, km, roadClass, congestion, risk, name, shape }] }

POST /api/search/batch
  ← { start, goal, stops[], algorithms[], vehicle, period, weights, optimiseOrder }
  → { nodeIds: [...],
      results: [{ algo, order[], path[], found, problem?, metrics, trace[] }] }
```

**Three things are mandatory; missing any one breaks the visualization:**

**1. `nodeIds` is mandatory, and its order must be fixed.** This is an array of
node IDs, used as the lookup table for `trace`. The previous version of this
document forgot this field entirely. Each step in `trace` stores a node by
**its index in `nodeIds`**, not by node ID, because a single run over a
network of a few hundred nodes generates tens of thousands of queue entries —
multiplied across six panes, storing strings would waste memory for nothing.
The order of `nodeIds` must match the order of the `nodes` array returned by
`GET /api/graph`, and must stay fixed for the entire session.

**2. The field name is `algo`, not `algorithm`.** The previous version wrote
`algorithm`; the source code uses `algo`. `algo` was chosen so the frontend
wouldn't need to change.

**3. `trace` must never be empty.** This is the single most fragile point in
the whole project: a backend very commonly returns just the final route and
forgets `trace`, and without `trace` the entire step-by-step visualization —
ten points on the grading rubric — simply doesn't exist.

`metrics` consists of: `km`, `minutes`, `cost`, `expanded`, `ms`, `optimal`.

`trace` is an array of steps:
```json
{ "expanded": 412, "frontier": [128, 96, 431], "g": 4.21, "h": 3.08 }
```
For algorithms that don't use a heuristic, `h` returns `null`; the interface hides it automatically.

`problem` is an explanatory sentence for when the query is inherently meaningless — for example,
the start and destination both pin to the same intersection. With this field, the interface
can state the reason instead of showing "done at step 0, optimal," which looks like it's stuck.

A single `batch` request serves all six panes, so every pane receives its result at the same
time and the shared timeline starts up in sync.

## 12. The multi-stop problem

Uses the same bento grid, no separate tab.

Each pane runs its own algorithm through each leg in turn, then stitches the traces together into a single timeline. Whichever leg arrives shows up right away — the route is built up piece by piece.

The *auto-order stops* option uses a nearest-neighbor heuristic, measured with the real UCS cost between pairs of points. This is an **approximate** solution, and the metrics pane must state that clearly — the assignment requires stating explicitly whether an algorithm's result is optimal or approximate.

Measured in practice with two additional stops: auto-ordering gives 9.79 km, keeping the manually entered order gives 10.97 km. An 11% gap.

## 13. Technical risks

**Leaflet renders incorrectly when its container is resized.** `invalidateSize()` must be called after every pane resize, via a `ResizeObserver` placed on each map container. Without this, the map breaks on the very first resize.

**Infinite loop when syncing the view.** Pane A fires a move event to B, B fires one back to A. Needs a guard flag at the application layer.

**Too many redraws.** Each step may need to update several thousand nodes. Two measures: use canvas instead of SVG, and only restyle nodes whose state actually changed — the fade effect is split into four discrete steps instead of continuous, so most nodes don't change step on any given tick.

**Overpass rejects Node's default User-Agent** with a 406 error. Browsers aren't affected, since they always send a real User-Agent. This only matters when running tests outside the browser.

**Overpass is sometimes slow.** Measured from 1.7 seconds to 8.7 seconds for the same query. There must be a clear loading state and an error message that says how to fix it.

## 14. Scope-cutting order if time runs short

Cut from the bottom up:

1. Four custom weight sliders (keep the four preset criterion buttons)
2. Drag-and-drop pane reordering (keep resizing)
3. Three road-network detail levels (lock to one fixed level)
4. Intermediate stops — **cannot be cut**, the assignment requires the multi-stop problem

The core that stays untouched: the multi-pane grid, per-pane algorithm selection, the shared timeline, node state, the metrics table.

## 15. Open questions

- Will the submission switch to Goong? Someone needs to register an API key.
- Will there be a dark theme? Currently assumed **no**; reconsider if the video ends up filmed in a dark room.
- Does it need to run on a phone? Assumed **no** — a multi-pane grid is inherently a wide-screen interface.
