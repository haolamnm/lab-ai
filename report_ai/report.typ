#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2.5cm),
  numbering: "1",
  number-align: center + bottom,
)
#set text(font: "Times New Roman", size: 12pt, lang: "en")
#set par(justify: true, leading: 0.75em)
#set heading(numbering: "1.1")
#show table: set text(size: 10.5pt)
#show table.cell.where(y: 0): set table.cell(fill: luma(235))
#show table.cell.where(y: 0): set text(weight: "bold")

#let report-figure(path, caption-text, width: 100%) = figure(
  image(path, width: width),
  caption: caption-text,
)

#page(
  paper: "a4",
  margin: (x: 2.5cm, top: 1.8cm, bottom: 2cm),
  numbering: none,
)[
  #set text(font: "Times New Roman", lang: "en")

  #align(center)[
    #image("khtn.jpg", width: 2.6cm)
    #v(0.35cm)

    #text(size: 16pt, weight: "bold")[VNUHCM - UNIVERSITY OF SCIENCE]
    #v(0.25cm)
    #text(size: 14pt, weight: "bold")[FACULTY OF INFORMATION TECHNOLOGY]
  ]

  #v(0.8cm)
  #line(length: 100%, stroke: 1.2pt)
  #v(0.45cm)
  #align(center)[
    #text(size: 18pt, weight: "bold")[PROJECT REPORT]
    #v(0.3cm)
    #text(size: 17pt, weight: "bold")[DELIVERY-ROUTE SEARCH AND OPTIMIZATION]
    #v(0.18cm)
    #text(size: 15pt, weight: "bold")[(ROUTE LAB)]
  ]
  #v(0.45cm)
  #line(length: 100%, stroke: 1.2pt)

  #v(0.55cm)
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    align: (left, right),
    [
      #v(1.65cm)
      *Students:* #linebreak()
      24127034 - Lâm Chí Hào #linebreak()
      24127072 - Bùi Thị Bích Loan #linebreak()
      24127122 - Cao Tiến Thiên #linebreak()
      24127197 - Nguyễn Khánh Linh #linebreak()
      24127567 - Lê Nguyễn Anh Trí
    ],
    align(right)[
      *Course:* #linebreak()
      Fundamentals of Artificial Intelligence #linebreak()
      #v(0.25cm)
      *Lecturers:* #linebreak()
      Bùi Tiến Lên #linebreak()
      Bùi Duy Đăng #linebreak()
      Võ Nhật Tân
    ],
  )

  #v(1fr)
  #align(center)[Ho Chi Minh City, August 17, 2026]
]

#counter(page).update(1)

#align(center)[#text(size: 18pt, weight: "bold")[Table of Contents]]
#v(10pt)
#{
  set text(size: 10pt)
  set par(leading: 0.5em)
  outline(title: none, depth: 2)
}

#pagebreak()

= Team Introduction

== Team Member Information

#table(
  columns: (1.5cm, 4cm, 2.4cm, 1fr, 2.2cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (center, left, center, left, center),
  [No.], [Full name], [Student ID], [Primary role], [Completion],
  [1], [Lâm Chí Hào], [24127034], [Team leader, system integration, data, video], [100%],
  [2], [Bùi Thị Bích Loan], [24127072], [BFS, DFS, report], [100%],
  [3], [Cao Tiến Thiên], [24127122], [UCS, Nearest, slide], [100%],
  [4], [Nguyễn Khánh Linh], [24127197], [A\*, DP, slide], [100%],
  [5], [Lê Nguyễn Anh Trí], [24127567], [GUI, frontend, video], [100%],
)

== Contribution Assessment for Each Member

#{
  set par(justify: false)
  table(
  columns: (3.2cm, 4.4cm, 3.6cm, 2.2cm, 2.2cm),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left, center, center),
  [Member], [Tasks], [Evidence (branches)], [Self #linebreak() assessment], [Team #linebreak() assessment],
  [Lâm Chí Hào], [Team coordination, system architecture, backend integration, and data processing], [`fix/isolate-` #linebreak() `optimise-order`], [100%], [100%],
  [Bùi Thị Bích Loan], [BFS, DFS, and algorithm testing], [`feat/bfs-dfs-` #linebreak() `search`], [100%], [100%],
  [Cao Tiến Thiên], [UCS and Nearest Neighbor], [`refactor/nearest-` #linebreak() `pairwise-astar`], [100%], [100%],
  [Nguyễn Khánh Linh], [A\* and Held–Karp Dynamic Programming], [`feat/astar` #linebreak() `feat/held-karp` #linebreak() `fix/held-karp-` #linebreak() `closed-tour-notice`], [100%], [100%],
  [Lê Nguyễn Anh Trí], [GUI and frontend visualization], [`feat/ui-overhaul`], [100%], [100%],
  )
}



== Degree of Requirement Completion

#table(
  columns: (1cm, 3.5cm, 1fr, 2.7cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (center, left, left, center),
  [No.], [Project requirement], [Implementation in Route Lab], [Status],
  [1], [Vietnamese traffic scenario], [Delivery routing in Ho Chi Minh City], [Completed],
  [2], [Graph-based traffic model], [Real road network from OpenStreetMap + sample graph], [Completed],
  [3], [Edge attributes], [Distance, travel time, congestion, road type, direction, risk], [Completed],
  [4], [Cost function], [Weighted distance, time, congestion, and risk], [Completed],
  [5], [Two-location routing], [Pickup → Dropoff route search], [Completed],
  [6], [Multi-location routing], [Intermediate stops + optimized visiting order], [Completed],
  [7], [BFS], [Implemented and visualized], [Completed],
  [8], [DFS], [Implemented and visualized], [Completed],
  [9], [UCS], [Implemented and visualized], [Completed],
  [10], [A\*], [Implemented with an admissible heuristic], [Completed],
  [11], [Additional algorithms], [Greedy Best-First + Nearest Neighbor], [Completed],
  [12], [GUI], [Interactive map, algorithm panes, and shared timeline], [Completed],
  [13], [Step-by-step visualization], [Expanded nodes, frontier, and final route], [Completed],
  [14], [Route explanation], [Explains route quality, traffic conditions, and alternatives], [Completed],
  [15], [Performance comparison], [Distance, cost, expanded nodes, runtime], [Completed],
)

#pagebreak()

= Problem Context

== Selected Problem Context

This project considers the problem of *delivery-route search and optimization in Ho Chi Minh City*. For each delivery trip, the user specifies a pickup location, a final dropoff location, and optionally multiple intermediate stops. The proposed system, Route Lab, is designed both to identify appropriate routes and to visualize how different search algorithms operate on the same road network.

Route Lab allows the user to choose the structure of a trip. Under the default open-route mode, the dropoff is fixed as the final destination: `pickup → stops → dropoff`. Under `Round trip` mode, the trip must return to the pickup location. In this case, there is no separate terminal destination; therefore, the location entered in the dropoff field is treated as an ordinary stop and may be placed at an appropriate position in the visit order.

When at least one intermediate stop is present, the interface displays the `Optimise visit order` option. If this option is disabled, point-to-point algorithms preserve the user-specified order. If it is enabled, the system may reorder the stops according to the actual route cost. For an open route, the dropoff remains fixed at the end; for a round trip, the former dropoff location may be reordered together with the other stops. This design allows users to compare a manually specified schedule directly with an optimized schedule. In practical use, users may enable optimization when the delivery sequence is flexible and a lower-cost visiting order is preferred, or leave it disabled when orders must be served in the prescribed sequence.

The problem setting reflects characteristics of urban transportation in Vietnam, particularly in Ho Chi Minh City, where the road network contains multiple road types, including major arterials, local roads, residential streets, and alleys. Accessibility also depends on vehicle type. Motorbikes can travel through alleys and are modeled as less sensitive to congestion, but they are not allowed on motorways. Cars can achieve higher speeds on uncongested roads but are more strongly affected by traffic jams. Vans cannot use alleys, while trucks are restricted on residential roads, alleys, and selected road classes during peak periods.

Route Lab supports four vehicle types (motorbike, van, car, and truck), three time periods (Peak, Off-peak, and Night), and five routing criteria (Shortest, Fastest, Balanced, Avoid congestion, and Custom). Consequently, the same origin and destination may yield different routes when the vehicle type, time period, or priority weights in the cost function change.

Road-network data are provided through two principal mechanisms:

- *Real road network:* the frontend searches for locations and retrieves relevant road data from OpenStreetMap through geographic data services. Road segments are converted into a directed graph, retain their geometry for map visualization, and may include turn restrictions.
- *Sample graph:* the system provides an offline graph consisting of 21 nodes representing locations in Ho Chi Minh City and 36 links. Traffic-related values are deliberately designed by the team to create controlled scenarios in which algorithmic behavior can be clearly observed and compared.

On the same input data, the system can execute up to six algorithms: BFS, DFS, UCS, A\*, Nearest Neighbor, and Held-Karp Dynamic Programming. The first four algorithms solve route-search problems for individual legs, whereas Nearest Neighbor and Held-Karp additionally address visit-order selection for trips containing multiple locations.

== Practical Problem Statement

In real-world urban delivery, the route with the shortest geometric distance is not necessarily the fastest, safest, or most appropriate route in terms of overall cost. A short route may pass through heavily congested areas, narrow roads, or high-risk segments, whereas a longer route may use major roads that allow faster and more stable travel. Therefore, minimizing distance alone may fail to represent actual transportation requirements.

The problem is further constrained by traffic regulations and operating conditions:

- one-way roads permit travel only in the specified direction;
- some vehicle types are prohibited from using particular road classes;
- trucks are restricted on selected urban roads during peak periods;
- specific turning movements at intersections may be prohibited depending on the incoming road segment;
- congestion affects different vehicle types and time periods differently;
- disconnected road sections or points located within one-way regions may make a trip infeasible.

Each road segment is therefore characterized not only by its endpoints but also by distance, road class, direction, congestion, and risk. Estimated travel time is derived from segment length, the base speed associated with the road class, vehicle-specific congestion sensitivity, and the selected time period. The cost function combines distance, travel time, congestion, and risk through user-selected weights.

When a trip contains only a pickup and a dropoff, the system must identify a valid sequence of edges connecting the two locations. With multiple stops, the problem becomes more complex because two layers must be addressed simultaneously:

+ finding an appropriate route between each pair of consecutive locations;
+ determining the visit order of the stops so that the total trip cost is reduced.

The ordering problem also depends on the trip type. For an open route, the final destination is explicitly specified by the user; therefore, only intermediate stops may be permuted, while the dropoff remains fixed at the end. For a round trip, all locations after the pickup are treated as destinations to be visited, and the final route returns to the pickup. Distinguishing these two cases prevents the system from unintentionally placing the dropoff in the middle of a one-way delivery itinerary.

If the original input order is followed without optimization, the vehicle may revisit the same geographic area multiple times. Nearest Neighbor addresses this problem efficiently by repeatedly selecting the unvisited location with the lowest route cost, but it does not guarantee a globally optimal ordering. Held-Karp applies dynamic programming to the pairwise cost matrix between locations to determine the minimum-cost visit order, at the expense of exponentially increasing time and memory requirements as the number of stops grows.

Another important requirement is explainability. Users need not only the final route but also insight into which nodes were expanded, how the frontier evolved, how much processing time the algorithm required, and whether the returned solution is guaranteed to be optimal. Route Lab therefore serves both as a delivery-routing system and as a visual environment for comparing search strategies under identical conditions.

== Significance of the Proposed Solution

For delivery operations, route optimization can reduce unnecessary travel distance, travel time, exposure to congestion, and route-related risk. Incorporating vehicle type and time period produces more realistic results than applying a single route to all operating conditions. For example, a route suitable for a motorbike may pass through alleys, whereas a car or truck may require a different road network; similarly, a route appropriate at night may differ from one selected during peak hours.

The multi-criteria cost function allows users to adjust the trip objective rather than being restricted to a single definition of a “good route.” The Shortest criterion prioritizes distance, Fastest prioritizes travel time, Avoid congestion imposes a larger penalty on congested roads, and Balanced combines multiple factors. Custom mode allows each weight to be modified independently for sensitivity analysis. This makes it possible to demonstrate that BFS and DFS do not use route cost to select frontier states, whereas UCS and A\* may change their selected paths when the weights change.

For multi-stop deliveries, optimizing the visit order reduces unnecessary detours and repeated travel through previously visited areas. At the same time, the `Optimise visit order` switch preserves user control: the system may either retain a committed delivery order or reorder destinations to reduce total cost. Keeping the dropoff fixed at the end of an open route preserves the intended trip objective, while round-trip mode provides a separate formulation for vehicles that must return to the depot. Nearest Neighbor offers a fast solution that is suitable when a near-optimal route is required quickly, whereas Held-Karp provides an exact optimal benchmark for a small number of stops. Comparing these approaches illustrates the trade-off between solution quality and computational cost.

From an academic perspective, Route Lab provides a fair comparison environment because every algorithm pane uses the same pickup, dropoff, stops, graph, vehicle, time period, and weight configuration. A shared timeline allows the algorithms to be inspected at the same search step. The Map view presents the route geographically, while the Tree view visualizes the search tree and expansion pattern. The comparison table reports cost, distance, travel time, hops, expanded nodes, generated states, reopened states, peak frontier size, and runtime.

By combining a traffic model, search algorithms, quantitative metrics, and step-by-step visualization, the system does more than return a route: it also explains why that route was selected and how much search effort was required. This provides a foundation for evaluating completeness, optimality, route quality, and computational performance across different traffic scenarios.

#pagebreak()


= Problem Modeling

== Graph-Based Representation

The transportation network in Route Lab is modeled as a directed, weighted graph:

$ G = (V, E) $

where:

- $V$ is the set of nodes representing intersections or points in the road network. Each node contains an `id`, latitude `lat`, and longitude `lng`; `label` and `name` are optional attributes used primarily in the sample graph;
- $E$ is the set of directed edges representing road segments connecting pairs of nodes;
- a two-way road is represented by two edges in opposite directions;
- a one-way road is represented by a single edge in the permitted direction.

The frontend constructs a graph from the OpenStreetMap road network, the sample graph, or an imported JSON file. Data sent to the backend include `nodes`, `edges`, and `turns`, with optional `bounds` and `detail` fields. The adjacency list is not transmitted through the API because doing so would duplicate the complete edge set. Instead, the backend function `build_graph()` reconstructs it as follows:

#block(inset: 8pt, fill: luma(245), width: 100%)[
  `adj[u] = list of edges whose from field equals u`
]

Each edge is inserted only into the adjacency list of its `from` node. An edge whose `from` endpoint does not exist in the node set is not added to the adjacency list. Thus, travel direction and one-way constraints are encoded directly in the graph representation rather than being applied as post-processing corrections after route search.

When turn restrictions are present, the search state is expanded to:

$ "state" = ("currentIntersection", "incomingWay") $

`currentIntersection` is the current intersection, and `incomingWay` is the `wayId` of the segment used to enter that intersection. This representation is necessary because the legality of the next turn depends on both the current intersection and the incoming segment. If no active turn restriction exists, the state is represented only by the node ID. This compact representation reduces memory usage while keeping the number of expanded nodes consistent between the frontend and backend on the sample graph.

`turns` contains a `no` table for prohibited incoming-outgoing pairs and an `only` table for the unique permitted outgoing direction. Each rule may include an active time interval and a list of exempt vehicle types. `bounds` defines the map viewport, while `detail` indicates the set of road classes included in the loaded network. Backend algorithms directly use `nodes`, `edges`, `adj`, and `turns`.

A trip containing multiple locations is decomposed into consecutive route legs. The visit-order structure depends on two settings:

- *Open route, no optimization:* `pickup → stop 1 → stop 2 → … → dropoff`; the original input order is preserved and the dropoff is fixed at the end.
- *Open route, optimized:* intermediate stops are reordered according to route cost, after which the dropoff is appended as the final destination.
- *Round trip, no optimization:* locations are visited in their input order and the route then returns to the pickup.
- *Round trip, optimized:* the location entered in the dropoff field becomes an ordinary stop; all destinations are reordered and the pickup is appended at the end to close the tour.

Each consecutive pair of locations becomes a `SearchProblem`. The planner solves each leg separately and concatenates the resulting paths, edges, traces, and metrics into a trip-level result.

== Components of the Search Problem

#table(
  columns: (3.4cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  [Component], [Definition in the system],
  [Node], [An intersection with an ID and coordinates in `graph.nodes`],
  [Edge], [A directed road segment in `graph.edges`],
  [Initial state], [The pickup node of the current leg; the initial state key is the node ID or `node|incomingWay` when turn restrictions are active],
  [Goal state], [The stop or dropoff node to be reached in the current leg],
  [Transition], [Traverse a valid outgoing edge from the current state],
  [Goal test], [The node component of the current state equals the goal node],
  [Action set], [Edges satisfying road-class, vehicle, time-period, and turn-restriction constraints],
  [Step cost], [Non-negative `edge_cost(edge, conditions)`; BFS and DFS do not use this value to order the frontier],
  [Single-leg solution], [A sequence of nodes and the exact `via` edges selected by the algorithm from start to goal],
  [Trip-level solution], [The leg solutions concatenated according to the visit order],
)

`optimiseOrder` is an optional setting for the four point-to-point algorithms BFS, DFS, UCS, and A\*. When it is `false`, the planner preserves the stop order. When it is `true` and multiple destinations are present, the planner constructs a pairwise A\* cost matrix and applies a nearest-next strategy to determine an order before running the selected search algorithm on each leg. The trip-level algorithms Nearest Neighbor and Held-Karp always apply their own ordering strategies and therefore do not depend on this switch.

For an open route (`returnToStart = false`), `goal` is the mandatory final dropoff. For a round trip (`returnToStart = true`), the former `goal` is treated only as another location to be visited, and the final trip-level goal becomes `start`. This rule is applied consistently across all six panes so that each algorithm solves the same trip formulation.

Pickup, dropoff, and stop values are initially geographic coordinates. Before search begins, the `snap()` function maps each coordinate to the nearest intersection from which the current vehicle can legally depart. Snapping is repeated when the vehicle or time period changes because a node that is valid for a motorbike may be invalid for a truck.

The transition rule is implemented in `next_states()` using the following sequence:

+ read outgoing edges from `adj[current]`;
+ remove edges that are not traversable under the road class, vehicle, and time period, including truck-curfew restrictions;
+ if the state has an incoming edge, validate the incoming-outgoing pair against `no` and `only` turn rules, active time intervals, and exempt vehicle lists;
+ create a state key for the edge's `to` node, including `wayId` when turn restrictions are active;
+ discard states already in the closed set, except when A\* is allowed to reconsider them for reopening after discovering a cheaper path;
+ return the remaining `(edge, successorState)` pairs in the original adjacency order.

The goal test succeeds when the current node equals the goal node, regardless of the incoming way. Search memory stores `parent`, the selected `via` edge, best-known cost, open set, and closed set. When the goal is reached, the system follows `parent` pointers backward to reconstruct the path. The exact `via` edge is retained so that parallel road segments connecting the same pair of nodes are handled correctly.

The point-to-point algorithms differ only in the rule used to remove a state from the frontier: BFS uses FIFO order, DFS uses LIFO order, UCS prioritizes $g(n)$, and A\* prioritizes $g(n)+h(n)$. Because they share the same transition rules and measurement framework, `expanded`, `generated`, `reopened`, `maxFrontier`, and `turnsBlocked` are recorded consistently.

For a multi-location trip, the system adds a trip-level ordering layer above these individual leg searches. Nearest Neighbor repeatedly selects the lowest-cost unvisited destination, whereas Held-Karp evaluates subset states to determine the minimum-cost visit order. After an order has been selected, the route between each pair of consecutive locations is computed and the resulting legs are concatenated into one complete trip. The system therefore supports both point-to-point routing and point-to-multiple-point routing while retaining the same graph, transition rules, and edge-cost model.

== Road-Edge Attributes

Each `GraphEdge` represents a directed road segment and contains the following attributes:

#table(
  columns: (2.2cm, 2.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  [Attribute], [Type/range], [Meaning and use],
  [`from`], [Node ID], [Starting intersection of the directed edge],
  [`to`], [Node ID], [Ending intersection of the directed edge],
  [`km`], [$"km" > 0$], [Segment length in kilometers; the API rejects zero, negative, infinite, or NaN values],
  [`roadClass`], [7 values], [One of motorway, trunk, primary, secondary, tertiary, residential, or alley; determines base speed and access permissions],
  [`congestion`], [1 to 5], [Baseline congestion level of the segment; contributes directly to cost and indirectly reduces speed],
  [`risk`], [0 to 1], [Segment risk level; adjusted by the vehicle-specific risk factor],
  [`name`], [String or empty], [Road name used in route explanations],
  [`shape`], [List of coordinates], [Original geometry used to draw the polyline in Map view],
  [`wayId`], [Number or empty], [OpenStreetMap identifier used to evaluate turn restrictions],
)

`km`, `roadClass`, `congestion`, `risk`, and edge direction are input data. The backend validates that `congestion` lies in [1, 5], `risk` lies in [0, 1], and all weights are non-negative. These constraints ensure non-negative edge costs, which are required for the optimality guarantees of UCS and A\*. `minutes` and `cost` are not static edge attributes because they depend on vehicle type, time period, and weights; they are computed at runtime by `edge_minutes()` and `edge_cost()`.

The seven `roadClass` values are the normalized operational categories used by Route Lab rather than a claim that OpenStreetMap contains only seven highway tags. The application retains motorway, trunk, primary, secondary, tertiary, and residential as distinct routing categories and models alleys separately because they have vehicle-specific access rules. Auxiliary OpenStreetMap tags are mapped into these categories: corresponding `_link` roads inherit their parent class, while `unclassified` and `living_street` are normalized to `residential`. This normalization provides a small, consistent set for speed and access calculations without discarding relevant road segments.

A two-way road produces two `GraphEdge` objects with reversed `from` and `to` fields; a one-way road produces only the edge in the legal direction. Two edges may connect the same pair of nodes while representing different road segments, so the search memory stores the exact selected `via` edge.

== Cost Function and Associated Components

The cost of a road segment is defined as:

$ "Cost"(e) = w_d dot "km"(e) + w_t dot "minutes"(e) + w_c dot "congestion"(e) dot "km"(e) + w_r dot "risk"(e) dot "vehicleRiskFactor" dot "km"(e) $

where $w_d$ controls the priority assigned to distance; $w_t$ controls travel time; $w_c$ penalizes congestion; $w_r$ penalizes risk; and `vehicleRiskFactor` represents the vehicle's sensitivity to risk. Congestion and risk are multiplied by segment length so that 300 meters of congestion is not treated as equivalent to 3 kilometers of congestion.

=== Distance Component

$ "distanceCost" = w_d dot "km"(e) $

`km(e)` is the segment length in kilometers. For OpenStreetMap data, this value is derived from geometry; for the sample graph, it is manually simulated. Increasing $w_d$ causes UCS and A\* to favor routes with shorter total distance. When $w_d = 0$, distance no longer contributes directly to route cost.

=== Time Component

$ "jamFactor"(e) = 1 + ("congestion"(e)-1) dot 0.42 dot "jamSensitivity"_v dot "periodJam" $

$ "speed"(e) = ("classSpeed" dot "vehicleSpeed"_v) / "jamFactor"(e) $

$ "minutes"(e) = ("km"(e) / "speed"(e)) dot 60 $

$ "timeCost" = w_t dot "minutes"(e) $

Estimated speed depends on road class, the vehicle speed factor, congestion, the vehicle's congestion sensitivity, and the selected time period. The slowdown constant applied per congestion level is 0.42. The base speeds encoded in the implementation are:

#table(
  columns: (2.6cm, 1.5cm, 2.4cm, 1.5cm, 2.6cm, 1.5cm),
  inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Road class], [km/h], [Road class], [km/h], [Road class], [km/h],
  [Motorway], [60], [Trunk], [45], [Primary], [32],
  [Secondary], [26], [Tertiary], [22], [Residential], [16],
  [Alley], [11], [], [], [], [],
)

`periodJam` equals 1.00 during Peak, 0.55 during Off-peak, and 0.18 during Night. The time period modifies the effect of congestion rather than multiplying the base speed directly. As a result, the motorbike's modeled advantage in congested traffic becomes smaller under uncongested nighttime conditions, while cars can benefit more from higher speeds on open roads. Increasing $w_t$ allows a cost-based algorithm to select a longer route when its estimated total travel time is lower.

=== Congestion Component

#table(
  columns: (2cm, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Level], [Interpretation],
  [1], [Free-flowing traffic], [2], [Low traffic volume], [3], [Moderate traffic volume],
  [4], [High congestion], [5], [Very high congestion],
)

$ "congestionCost" = w_c dot "congestion"(e) dot "km"(e) $

Multiplying by `km(e)` represents the effect of congestion over the full segment length. Increasing $w_c$ causes UCS and A\* to avoid highly congested segments more aggressively. The selected time period does not modify the segment's baseline congestion value; instead, it changes how strongly that congestion affects estimated travel speed.

The congestion level and the congestion weight are different quantities. `congestion(e)` is an edge-data attribute on a 1-to-5 scale, where level 5 represents very high congestion. By contrast, the GUI slider controls the coefficient $w_c$ on a 0-to-3 scale. A slider value of 3 does not mean congestion level 3; it applies the strongest available user preference against road segments whose stored congestion level may be as high as 5.

=== Risk Component

$ "riskCost" = w_r dot "risk"(e) dot "vehicleRiskFactor" dot "km"(e) $

`risk(e)` lies in the interval [0, 1] and represents the aggregate disadvantage associated with a segment. The sample graph uses simulated risk values; the current system does not use a real-time risk data source. Risk does not determine whether an edge is legally traversable; rather, it contributes a relative penalty to route cost.

#table(
  columns: (2.5cm, 3.5cm, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Vehicle], [`vehicleRisk` #linebreak() `Factor`], [Modeling interpretation],
  [Motorbike], [1.3], [More sensitive to road and weather conditions],
  [Van], [1.0], [Reference level],
  [Car], [0.8], [Less sensitive under the current model],
  [Truck], [1.6], [Larger size and payload make risky segments more difficult to traverse],
)

=== Interpretation of the Weights

$w_d$, $w_t$, $w_c$, and $w_r$ are relative preference coefficients rather than physical quantities. The final cost is a composite score used to rank routes under the same configuration.

- Increasing $w_d$ prioritizes shorter routes in kilometers.
- Increasing $w_t$ prioritizes lower estimated travel time.
- Increasing $w_c$ permits detours in order to avoid congested segments.
- Increasing $w_r$ permits detours in order to avoid risky segments.
- Setting a weight to zero removes the corresponding component from the direct cost calculation.

The predefined weight sets are design assumptions used for simulation and have not been calibrated against real operational data. The project therefore does not claim that they are globally optimal weights for real-world traffic.

=== Use of the Cost Function by Each Algorithm

- UCS uses $g(n)$ as the cumulative route cost from the start state to $n$.
- A\* uses $g(n) + h(n)$, where $g(n)$ accumulates edge costs.
- Nearest Neighbor constructs a directed cost matrix using A\*, then greedily selects the unvisited stop with the lowest route cost; previously computed legs are reused.
- Held-Karp also uses pairwise A\* costs, but applies bitmask dynamic programming to determine the visit order with minimum total cost. The backend limits the number of stops to 12 because the complexity grows exponentially.
- BFS and DFS do not use cost when selecting the next node; the planner evaluates route cost only after a path has been found.

The default A\* heuristic is the Haversine distance from the current node to the goal multiplied by the minimum feasible cost per kilometer among traversable edges. This forms an admissible lower bound and therefore preserves A\* optimality with respect to the modeled cost. The code also supports an admissible Euclidean heuristic and a non-admissible Manhattan heuristic for experimentation, but `build_problem()` selects Haversine by default.

Consequently, changing the weights may alter the route or visit order produced by UCS/A\*, pairwise A\*, Nearest Neighbor, and Held-Karp. BFS and DFS preserve their expansion rule when the graph, vehicle, time period, valid edge set, and adjacency order remain unchanged; their route cost is evaluated only after the path has been constructed.

== Weight Configuration Modes

The GUI provides four predefined configurations and one custom mode. Selecting a preset copies the corresponding weights into the run conditions. Adjusting any slider changes the criterion to `Custom`. GUI sliders accept values from 0 to 3 in increments of 0.05, while the backend contract accepts any non-negative weight.

#table(
  columns: (3.2cm, 2cm, 2cm, 2cm, 2cm), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Criterion], [Distance], [Time], [Congestion], [Risk],
  [Balanced], [1.0], [0.5], [0.8], [1.5],
  [Shortest], [1.0], [0.0], [0.0], [0.0],
  [Fastest], [0.0], [1.0], [0.0], [0.0],
  [Avoid congestion], [0.3], [0.6], [2.5], [1.0],
  [Custom], [User-defined], [User-defined], [User-defined], [User-defined],
)

=== Balanced

This preset combines all four components. Distance provides the baseline objective, time receives a moderate weight, congestion is explicitly penalized, and risk receives a comparatively large weight to prevent safety from being traded for only a small distance advantage. This is the default preset for general demonstrations.

=== Shortest

Only $w_d = 1$ is retained. Route cost equals total distance in kilometers, so UCS and A\* identify the shortest route by distance among all legally traversable paths. Other metrics are still displayed but do not affect frontier priority.

=== Fastest

Only $w_t = 1$ is retained. Cost-based algorithms minimize estimated total travel time and may select a longer route if it uses faster road classes or is less affected by congestion.

=== Avoid Congestion

This preset sets $w_c = 2.5$, substantially higher than the other components. Distance, time, and risk remain active so that the algorithm does not take an excessively long or risky detour merely to avoid congestion. This is a complete preset and differs from the controlled experiment in which only the congestion slider is varied.

=== Custom Mode and the Flat-Cost Case

Custom mode allows each cost component to be isolated. If all four weights are zero, every edge and every route has zero cost. In that case, the system cannot meaningfully claim a unique optimal result, and A\* degenerates to UCS because the cost-per-kilometer lower bound is zero.

The `congestion weight` must not be confused with the `edge.congestion` attribute. `edge.congestion` lies in the range 1-5 and describes the baseline condition of a road segment, whereas the congestion slider lies in the range 0-3 and specifies how strongly the user wants congested segments to be penalized in the cost function.

To evaluate sensitivity specifically to the congestion weight, the report holds `distance = 1.00`, `time = 0.50`, and `risk = 1.50` constant and defines three configurations:

#table(
  columns: (3.4cm, 2cm, 2cm, 2cm, 2cm), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Test configuration], [$w_d$], [$w_t$], [$w_c$], [$w_r$],
  [Congestion Min], [1.00], [0.50], [0.00], [1.50],
  [Balanced], [1.00], [0.50], [0.80], [1.50],
  [Congestion Max], [1.00], [0.50], [3.00], [1.50],
)

Across the three runs, the graph, pickup, dropoff, stops, vehicle, time period, and adjacency ordering must remain unchanged. UCS and A\* may change paths because $w_c$ directly affects frontier priorities; stop-ordering algorithms may also change their visit orders because the pairwise cost matrix changes. BFS and DFS do not use cost to select nodes, so their path and expansion order should remain unchanged; only the total cost assigned to the resulting path changes. Their estimated travel time also remains unchanged in this experiment because `edge.congestion`, vehicle type, and time period are held constant.

#pagebreak()
= Dataset

== Data Sources

The assignment specification (Section 4.4, Dataset Requirements) proposes three approaches to dataset construction and explicitly recommends the third: “Hybrid data - Use real Vietnamese locations and manually add simulated traffic conditions. This approach is recommended for balancing realism and implementation difficulty.” The project follows this hybrid approach by integrating three data sources that operate in parallel within the same application.

=== Source 1 - Real Road Network from OpenStreetMap (Primary Mode)

After the user selects a pickup and dropoff and clicks Build network, the application retrieves all relevant roads within an area surrounding the intended trip from the Overpass API, OpenStreetMap's public query service, and then constructs a directed graph from the raw data.

The graph-construction procedure (`web/src/lib/overpass.ts`) is as follows:

1. Restrict the retrieval area. Trips shorter than 8 km use a bounding box, whereas longer trips use a corridor constructed with an `around` clause following the ordered sequence of required locations. Overpass maintains a spatial index for bounding boxes and can therefore respond very quickly, whereas `around` requires distance calculations against road segments. Conversely, for inter-city trips, a bounding box may cover thousands of square kilometers even though the relevant road corridor occupies only a few hundred square kilometers.
2. Filter roads by road class according to the detail level selected by the user (see the “Road Class” section below).
3. Reduce the network to intersections. A point is treated as an intersection when at least two road ways pass through it. The geometry between two intersections is merged into a single edge while preserving the original polyline so that the actual road shape can be displayed on the map.
4. Detect one-way roads from three sources: the `oneway` tag, roundabouts (`junction=roundabout`), and the OpenStreetMap convention that motorways are one-way by default. `oneway=-1` indicates that traffic flows in the direction opposite to the recorded node order, so the resulting edge direction must be reversed.
5. Parse turn restrictions from relations with `type=restriction`, including time-dependent restrictions (`restriction:conditional`) and `except` lists that exempt motorbikes.
6. Repair connectivity. The retrieved road network is reduced to a strongly connected component capable of serving the complete trip using Kosaraju's algorithm. If the retained component contains fewer than eight nodes, the application reports that the network is too fragmented rather than returning a graph that is not useful for routing.

Design decision 1: nodes are identified by their OpenStreetMap node IDs rather than by rounded coordinates. Two road ways are connected if and only if they share the same node ID; this is their actual topological identity. Measurements in the Notre-Dame Cathedral-Thao Dien region showed that rounding coordinates to five decimal places (approximately 1.1 m) produced the same intersection count as node-ID-based counting, meaning that no intersections were missed. However, coordinate rounding incorrectly merged some distinct node pairs, typically where an overpass has nearly the same coordinates as the road below it. Using node IDs eliminates this class of error without additional computational cost.

Design decision 2: the system uses strong connectivity rather than ordinary connectivity. One-way roads make these two concepts substantially different. Many roads in central Ho Chi Minh City are tagged `oneway=yes` because divided boulevards are represented as two parallel one-way ways. If direction is ignored, the network appears fully connected; under the true travel directions, however, a substantial subset of nodes cannot reach other regions. Retaining such nodes would allow network construction to appear successful and defer failure until route search, where the system would incorrectly attribute the problem to graph disconnection even though the roads are physically connected but directed in the opposite direction.

=== Source 2 - Manually Constructed Sample Graph (for Illustration)

The assignment requires that algorithm examples be designed by the project team rather than copied from tutorials. A full OpenStreetMap network is unsuitable for this purpose because it contains hundreds or thousands of nodes with opaque identifiers and is difficult to trace manually. An illustrative example requires the opposite characteristics: it should be small, named, and controllable.

The project therefore defines a custom graph with 21 nodes and 36 undirected links (72 directed edges) in `web/src/lib/sampleGraph.ts`. Each node corresponds to a real location in Ho Chi Minh City and is assigned a letter from A to U, allowing a route to be described concisely as, for example, A → C → F → H. This graph exceeds the assignment's minimum requirement of 20 nodes and 30 edges and is therefore included as the submitted dataset.

The sample graph serves two additional purposes: it acts as a fallback when Internet connectivity is unavailable or Overpass is overloaded, and it provides the fixed network for all scenarios in the “Eight Illustrative Scenarios on the Sample Graph” section. The network remains constant while each scenario changes only the destination and run conditions.

=== Source 3 - User-Imported JSON Graphs

The application also accepts user-authored graphs in JSON format and supports both English and Vietnamese field names (`nodes`/`nut`, `edges`/`doanDuong`, `km`, `roadClass`/`capDuong`, `congestion`/`mucKetXe`, `risk`/`ruiRo`). Congestion and risk values are clamped to their valid ranges, while edges referencing nonexistent nodes or containing non-finite `km` values are removed (see “Values Imported from JSON Are Validated and Normalized”).

=== External Services

#table(
  columns: (3.5cm, 4cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left),
  [Service], [Purpose], [Notes],
  [Overpass API], [Road geometry and turn restrictions], [Public service with rate limits. Requests are retried up to three times (after 0 s / 4 s / 9 s) for HTTP 429/503/504 responses, with a hard overall cutoff of 75 seconds],
  [Nominatim], [Address lookup for the search field], [Public service, approximately one query per second],
  [CARTO Positron], [Basemap], [Light-gray basemap so that saturated colors shown in the interface correspond to application-generated overlays],
  [Google Fonts], [IBM Plex Sans/Mono fonts], [Full Vietnamese character support with correct diacritic rendering],
)

== Locations in the Dataset

=== List of 21 Nodes

This section describes the fixed sample dataset. It does not change over time and is included with the project submission for algorithm demonstrations.

#table(
  columns: (3cm, 5cm, 3cm, 3cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (center, left, center, center),
  [Label], [Location], [Latitude], [Longitude],
  [A], [Ben Thanh Market], [10.7725], [106.6980],
  [B], [Notre-Dame Cathedral Basilica of Saigon], [10.7797], [106.6990],
  [C], [Independence Palace], [10.7772], [106.6957],
  [D], [Bach Dang Wharf], [10.7745], [106.7060],
  [E], [Saigon Zoo and Botanical Gardens], [10.7880], [106.7050],
  [F], [Hang Xanh Intersection], [10.8010], [106.7100],
  [G], [Landmark 81], [10.7947], [106.7218],
  [H], [Saigon Bridge], [10.7960], [106.7280],
  [I], [Thao Dien], [10.8060], [106.7370],
  [J], [Thu Duc Market], [10.8500], [106.7550],
  [K], [Mien Dong Bus Station], [10.8145], [106.7115],
  [L], [Ba Chieu Market], [10.8018], [106.6968],
  [M], [Tan Son Nhat International Airport], [10.8188], [106.6520],
  [N], [Tan Binh Market], [10.7936], [106.6473],
  [O], [Ho Chi Minh City University of Technology], [10.7725], [106.6580],
  [P], [Cho Ray Hospital], [10.7556], [106.6595],
  [Q], [Binh Tay Market], [10.7500], [106.6500],
  [R], [Dam Sen Park], [10.7680], [106.6350],
  [S], [Chu Y Bridge], [10.7480], [106.6870],
  [T], [Crescent Mall, District 7], [10.7290], [106.7180],
  [U], [Dinh Tien Hoang Alley], [10.7930], [106.6923],
)

Node U is the only node that is not a landmark. It is introduced specifically to model an alley crossing that provides a lower-cost branch for motorbikes while remaining inaccessible to other vehicle types.

=== List of 36 Edges

Each row denotes one undirected link, which is instantiated as two directed edges in opposite directions. Congestion is measured on a 1-5 scale and risk on a 0-1 scale.

#table(
  columns: (2cm, 2cm, 2cm, 2cm, 2cm, 4cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (center, center, center, center, center, left),
  [From], [To], [km], [Congestion], [Risk], [Road class],
  [A], [C], [0.7], [4], [0.10], [secondary],
  [A], [D], [1.0], [3], [0.10], [primary],
  [A], [S], [3.2], [3], [0.30], [secondary],
  [A], [O], [4.4], [4], [0.20], [primary],
  [B], [C], [0.5], [2], [0.05], [tertiary],
  [B], [D], [1.0], [2], [0.05], [tertiary],
  [B], [E], [1.2], [3], [0.10], [secondary],
  [C], [L], [3.0], [4], [0.20], [primary],
  [D], [E], [1.6], [2], [0.10], [primary],
  [D], [T], [5.6], [3], [0.20], [primary],
  [E], [F], [1.6], [5], [0.40], [primary],
  [E], [G], [2.1], [3], [0.10], [primary],
  [F], [G], [1.5], [5], [0.50], [primary],
  [F], [K], [2.0], [4], [0.30], [primary],
  [F], [L], [1.5], [4], [0.30], [secondary],
  [G], [H], [0.8], [3], [0.10], [primary],
  [H], [I], [1.5], [2], [0.10], [motorway],
  [H], [K], [2.8], [3], [0.20], [primary],
  [I], [J], [5.5], [2], [0.10], [motorway],
  [J], [K], [6.2], [3], [0.20], [primary],
  [K], [M], [6.6], [4], [0.30], [primary],
  [L], [M], [5.3], [4], [0.30], [secondary],
  [L], [N], [5.6], [3], [0.20], [secondary],
  [M], [N], [3.0], [3], [0.20], [primary],
  [N], [O], [2.7], [3], [0.20], [secondary],
  [N], [R], [3.5], [2], [0.10], [tertiary],
  [O], [P], [2.0], [4], [0.30], [secondary],
  [O], [R], [2.6], [3], [0.20], [tertiary],
  [P], [Q], [1.8], [5], [0.50], [residential],
  [P], [S], [3.2], [4], [0.40], [secondary],
  [Q], [R], [2.6], [3], [0.20], [residential],
  [Q], [S], [4.3], [3], [0.30], [secondary],
  [S], [T], [4.0], [2], [0.10], [primary],
  [T], [H], [7.6], [2], [0.10], [motorway],
  [C], [U], [1.80], [1], [0.35], [alley],
  [U], [L], [1.10], [1], [0.35], [alley],
)

The two alley edges use congestion level 1 because alleys are modeled as having no traffic-light queues, while their risk is set to 0.35 because of narrow width and parked vehicles. The balance between these two effects is precisely what the cost-function comparison is intended to demonstrate.

The numerical values are selected deliberately so that visibly different algorithmic outcomes occur: a short route passes through the heavily congested Hang Xanh area, a longer but less congested route detours around Landmark 81, and several dead-end branches on the western side provide DFS with paths along which it can descend deeply before backtracking.

A geometric consistency constraint is automatically tested. Both the `km` values and node coordinates are manually specified, so the two tables must remain consistent: a road segment cannot be shorter than the straight-line distance between the two intersections it connects. Eight entries previously violated this constraint, which silently invalidated A\* optimality because the A\* heuristic is straight-line distance and remains a valid lower bound only when the constraint holds. `sampleGraph.test.ts` now compares every edge value with the geometry drawn for that edge. Two additional tests verify that A\* and UCS return identical costs across all 21 × 20 ordered node pairs under all four criteria, preventing this error from reappearing.

=== Eight Illustrative Scenarios on the Sample Graph

Each scenario (`web/src/lib/sampleCases.ts`) completely specifies one experimental situation, including origin/destination, vehicle, time period, and optimization criterion. This ensures that one particular modeling feature is responsible for the observed result. The values below are regression-locked by `sampleCases.test.ts` in CI.

#table(
  columns: (2cm, 2cm, 2cm, 2cm, 2cm, 6cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, center, center, center, left),
  [Scenario], [Trip], [Vehicle], [Period], [Criterion], [Intended observation],
  [Two blocks], [A → B], [Motorbike], [Off-peak], [Balanced], [All reasonable algorithms use A-C-B for a total of 1.2 km; DFS follows the first deep branch it encounters and returns after 23 km],
  [Cross-town haul], [A → J], [Motorbike], [Peak], [Balanced], [A\* and UCS both return 12.4 km; BFS returns 13.4 km because it minimizes hops, while DFS returns 22.9 km],
  [Rush hour], [A → T], [Car], [Peak], [Avoid congestion], [The route accepts an additional 600 m to detour via Chu Y Bridge: 7.2 km and 23 minutes],
  [Same trip at night], [A → T], [Car], [Night], [Fastest], [With congestion greatly reduced, the direct route via Bach Dang Wharf becomes preferable: 6.6 km and 13 minutes],
  [Alley shortcut], [A → M], [Motorbike], [Off-peak], [Shortest], [The Ba Chieu alley reduces distance to 8.9 km, whereas other vehicles require 9.0 km; under Fastest, even the motorbike avoids the alley],
  [Truck at peak], [A → M], [Truck], [Peak], [Balanced], [Peak-hour restrictions increase the truck route to 12.8 km and 79 minutes, compared with 8.9 km and 41 minutes for the motorbike],
  [Three-stop run], [A → C, M, Q → J], [Motorbike], [Peak], [Balanced], [Optimized order: 30.8 km; original input order: 37.9 km],
  [Round trip], [A → C, M, Q → J → A], [Motorbike], [Peak], [Balanced], [For the closed tour, the greedy panes travel 43.2 km, while Held-Karp finds 41.6 km and proves that no lower-cost tour exists under the modeled objective],
)

These scenarios are stored in `web/src/lib/sampleCases.ts` and validated in CI to ensure that they remain stable over time.

== Description of Input Data

This section describes the input attributes used by the project. The complete formulas are given in “Cost Function and Associated Components”; the present section focuses on the origin, range, and interpretation of each input variable.

=== Distance

`km` is the physical length of a road segment. For OpenStreetMap data, it is derived from the actual polyline and segments shorter than 0.001 km are discarded. For the sample graph, the value is manually designed and tested to ensure that it is not smaller than the straight-line distance between the two nodes. The backend enforces `km > 0` at the contract level (`Field(gt=0)`), so an edge with `km <= 0` is rejected by validation rather than passed to the search algorithm. This condition prevents non-positive edge lengths from violating the assumptions required by UCS and A\* optimality.

=== Travel Time

`minutes` is not stored directly in the dataset. It is derived from road class, vehicle type, congestion level, and time period. Consequently, the same road segment may have a different estimated travel time under a different vehicle or period, making vehicle and time-period comparisons meaningful.

=== Vehicle

Route Lab supports four vehicle types: motorbike, van, car, and truck. Each vehicle has a distinct base-speed factor, congestion sensitivity, risk factor, and access rules. Vehicle type is therefore a substantive input variable because a route may be valid for a motorbike but invalid for a truck or car under the same peak-hour conditions.

#table(
  columns: (2.4cm, 1.9cm, 2.2cm, 2cm, 3.2cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center, center, center, left, left),
  [Vehicle], [Speed factor], [Congestion sensitivity], [Risk factor], [Permanently prohibited], [Time-dependent restrictions],
  [Motorbike], [0.95], [0.55], [1.3], [motorway], [-],
  [Van], [1.00], [1.00], [1.0], [alley], [-],
  [Car], [1.10], [1.15], [0.8], [alley], [-],
  [Truck], [0.75], [1.25], [1.6], [residential, alley], [tertiary, secondary during peak hours],
)

=== Congestion Level

`congestion = clamp₁₋₅( round( BASE_JAM[road class] + (hash("wayId:startNodeId") - 0.5) × 2.2 ) )`

`BASE_JAM` is a fixed baseline congestion level by road class:

A central modeling assumption is that no congestion or risk value in Route Lab represents a real-time traffic measurement. For OpenStreetMap data, congestion and risk are generated deterministically from road class plus hash-based noise. The actual congestion key is `wayId:startNodeId`, where the node ID acts as the anchor at the beginning of a segment after an OSM way has been split at intersections. Consequently, two segments split from the same OSM way may still receive different values. In the sample graph, congestion and risk are manually specified for each edge in `sampleGraph.ts` to create observable and testable scenarios.

This simulation is not intended to replace real-time traffic data. Its purpose is to ensure reproducibility and fairness in algorithm comparison. All six panes operate on the same graph and the same edge values, so observed differences arise from algorithmic behavior rather than randomly changing environmental data.

#table(
  columns: (2.3cm, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center, center, center, center, center, center, center),
  [Road class], [motorway], [trunk], [primary], [secondary], [tertiary], [residential], [alley],
  [BASE_JAM], [2], [3], [4], [4], [3], [2], [1],
)

The hash function is FNV-1a applied to the identifier string and returns a value in $[0, 1)$. The essential property is determinism: repeated runs produce exactly the same value for the same road segment. This is necessary for a meaningful comparison, because all six panes must evaluate the same cost function on the same edge data.

The selected time period does not change the stored congestion value; instead, it scales the congestion effect during cost calculation:

#table(
  columns: (3cm, 2.8cm, 3cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center, center),
  [Period], [Representative time], [Congestion factor],
  [Peak], [17:30], [1.00],
  [Off-peak], [13:00], [0.55],
  [Night], [22:00], [0.18],
)

=== Risk (0-1 Scale)

The assignment lists risk as an optional attribute (“optional risk factors such as flooding, construction, or narrow roads”). The project includes it because risk is one of the four components of the cost function and has a dedicated weight control in the interface.

As with congestion, risk is simulated. It is generated from road class plus deterministic noise with amplitude $±0.15$, using a separate hash key from congestion so that the two quantities are not artificially correlated.

It is important to emphasize that the risk value does not represent the actual condition of a road at the current time. Instead, it is a deliberately simulated and reproducible variation defined by network structure and road type. The objective is not to produce real-time “ground-truth” measurements, but to provide a sufficiently controlled environment for comparing algorithms and evaluating how weight changes affect route selection.

#table(
  columns: (2.3cm, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center, center, center, center, center, center, center),
  [Road class], [motorway], [trunk], [primary], [secondary], [tertiary], [residential], [alley],
  [Baseline risk], [0.10], [0.20], [0.25], [0.30], [0.40], [0.55], [0.70],
)

The modeling principle is that smaller roads carry higher risk because they tend to contain more obscured intersections, greater flood exposure, and more lateral vehicle movements. Alleys receive the largest baseline risk: they are modeled as uncongested, but visibility is limited, road surfaces may be poorer, and pedestrians and vehicles frequently cross the travel path.

The risk value is additionally multiplied by the vehicle-specific risk factor during cost calculation (see the Vehicle table above), so the same “risky” road is penalized differently by vehicle type: truck 1.6, motorbike 1.3, van 1.0, and car 0.8.

=== Road Class

Road class influences several model components. Free-flow speed is used to derive travel time; baseline congestion is specified in the “Congestion Level” section; baseline risk is specified in the “Risk” section; and the table below determines vehicle access and time-dependent restrictions.

#table(
  columns: (2.6cm, 5cm, 5cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left),
  [Code], [Display name], [Notes],
  [motorway], [Motorway], [Motorbikes prohibited],
  [trunk], [Trunk road], [],
  [primary], [Primary road], [],
  [secondary], [Secondary road], [Trucks prohibited during peak hours],
  [tertiary], [Tertiary road], [Trucks prohibited during peak hours],
  [residential], [Residential street], [Trucks prohibited],
  [alley], [Alley], [Motorbikes only],
)

The network detail level selected by the user determines which road classes are retrieved:

#table(
  columns: (3cm, 1fr, 2.2cm, 3.4cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, center, center),
  [Detail level], [Included road classes], [Area limit], [Maximum corridor radius],
  [Major roads (coarse)], [motorway, trunk, primary], [3000 km²], [12 km],
  [Medium roads (medium)], [motorway, trunk, primary, secondary], [700 km²], [4 km],
  [Local roads (fine)], [motorway, trunk, primary, secondary, tertiary, residential], [60 km²], [2.5 km],
  [Including alleys (alleys)], [motorway, trunk, primary, secondary, tertiary, residential, alley], [14 km²], [1.4 km],
)

The actual radius is `min(area limit, max(1.2 km, 0.25 × trip length))`. Higher detail yields a richer road network but increases retrieval volume and latency, so each detail level has a separate area limit. If the downloaded network is too fragmented for routing, the application automatically changes the detail level and informs the user of the adjustment.

Two auxiliary road-class groups are retrieved and then mapped to their corresponding primary classes. `_link` roads are connectors to grade-separated junctions, overpasses, and ramps. Without them, the graph may contain a major road but no legal way to enter or leave it, causing the network to fragment into one-way components. In measurements over the Notre-Dame Cathedral-Thao Dien region at the “Medium roads” level, adding these connectors increased the largest strongly connected component from 74.2% to 85.2%. `unclassified` and `living_street` are also genuine streets with different OSM tagging conventions and are therefore mapped to `residential`.

Alleys require a separate query clause because OpenStreetMap commonly tags them as `highway=service` together with `service=alley`. The filter must match `alley` specifically rather than all `service` roads; otherwise, it would also include parking-lot entrances and private access roads that do not contribute to through-routing.

== Data Assumptions and Constraints

=== Congestion and Risk Are Deterministic Simulated Data

=== Travel Time Is Derived

Travel time is computed from free-flow speed by road class and the jam factor described in the “Time Component” section. The model omits traffic-signal delay, turning delay, and acceleration/deceleration time. The constant 0.42 is a manually selected calibration coefficient.

=== Time Is Discretized into Three Periods

The application defines three time periods, each associated with one representative clock time (17:30, 13:00, and 22:00). This representative time is required because OpenStreetMap turn restrictions may specify actual intervals such as `06:00-09:00,16:00-19:00`. Testing whether one representative time lies inside a restricted interval yields a deterministic, explainable decision and avoids ambiguities that arise when two broad time ranges overlap only briefly.

A consequence is that the model cannot distinguish 17:00 from 18:30 even though real traffic conditions may differ. Migration toward time-dependent edge costs and continuous-time traffic modeling is discussed in “Limitations and Future Work.”

=== Only Turn Restrictions with a Node as `via` Are Modeled

OpenStreetMap turn restrictions also include a variant in which `via` is an entire way, typically used for complex multi-branch junctions. This variant represents roughly one quarter of restrictions and requires a substantially different state model. It is therefore omitted: under the current scope, missing a restriction is preferable to representing it incorrectly.

=== Values Imported from JSON Are Validated and Normalized

For user-imported graphs, the frontend clamps congestion to [1, 5] and risk to [0, 1]. Edges whose nodes do not exist or whose `km` value is non-finite are removed. User-provided `km` values must be greater than zero to remain consistent with the assumptions of the search algorithms.

When the graph is submitted to the backend, the Pydantic contract applies stricter validation: `km <= 0`, congestion outside [1, 5], or risk outside [0, 1] are rejected with HTTP 422 rather than silently clamped. This prevents the backend from solving a different problem from the one supplied by the caller and preserves the non-negative edge-cost condition required by UCS and A\*.

=== Pickup and Dropoff Coordinates Are Snapped to the Nearest Intersection from Which the Vehicle Can Depart

Users select arbitrary geographic coordinates, but the search algorithms operate only on graph nodes. Each coordinate must therefore be snapped to the nearest feasible intersection. Snapping is vehicle-aware: a truck cannot depart from an alley, so it must be mapped to the nearest intersection from which it can legally leave. Without this filtering step, choosing a truck could cause all routes to be reported as unreachable even when a major road is located nearby.

As a consequence, changing either the vehicle or the time period requires all locations to be snapped again. Time-dependent restrictions can effectively close an entire road class, meaning that a location from which a truck can depart at midday may be invalid during peak hours.

=== The Road Network Is Reduced to a Strongly Connected Component

The retrieved road network is reduced to a component capable of supporting the full trip, with excluded road segments treated as absent from the graph. Importantly, the application does not simply retain the largest component. It selects the component located near all trip locations and only then considers component size. For inter-city trips, the largest component may lie entirely within the departure city because the downloaded network is disconnected farther along the corridor. Retaining that component would snap the destination tens of kilometers away and produce an operationally meaningless route.

=== Verification Measurements

The measurements cited in this report were obtained on August 14, 2026, using live OpenStreetMap data over the corridor (10.77249, 106.69064)-(10.81321, 106.74536), which is the same corridor automatically computed by the application for the Notre-Dame Cathedral → Thao Dien trip:

#table(
  columns: (10cm, 3cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center),
  [Measurement], [Value],
  [Largest SCC, “Medium roads” level, without connector links], [74.2%],
  [$-$ after adding `_link` connectors], [85.2%],
  [Total geometry points, “Local roads” level], [16 284],
  [Corresponding intersections (graph nodes)], [3 926],
  [Intersection count using coordinates rounded to five decimal places versus node-ID counting], [Equal],
)

#pagebreak()
= Algorithm Principles

#table(
  columns: (2.6cm, 1fr, 1fr, 1fr, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Criterion], [BFS], [DFS], [UCS], [A\*],
  [Problem class], [Point-to-point], [Point-to-point], [Point-to-point], [Point-to-point],
  [Frontier], [FIFO queue], [LIFO stack], [Priority queue ordered by $g(n)$], [Priority queue ordered by $f(n) = g(n) + h(n)$],
  [State-selection rule], [Earliest discovered state], [Most recently discovered state], [State with minimum cumulative cost], [State with minimum estimated total cost],
  [`g` in the trace], [Hop depth], [Hop depth], [Cumulative cost], [Cumulative cost],
  [Heuristic], [Not used], [Not used], [Not used], [Yes, Haversine scaled through `min_cost_per_km`],
  [Completeness in this project], [Yes, on a finite graph], [Yes, on a finite graph with visited-state tracking], [Yes, with non-negative costs], [Yes, with an admissible heuristic and non-negative costs],
  [Optimality with respect to traffic cost], [No; only minimum hop count], [No], [Yes], [Yes if the heuristic is admissible/consistent],
  [Worst-case time complexity], [$O(V_s + E_s)$], [$O(V_s + E_s)$], [$O((V_s + E_s) log V_s)$], [$O((V_s + E_s) log V_s)$],
  [Memory complexity], [$O(V_s)$], [$O(V_s)$], [$O(V_s)$], [$O(V_s)$],
  [Sensitivity to adjacency order], [Affects tie-breaking among paths at the same depth], [Very high; strongly affects the first path found], [Low; mainly affects ties], [Low; mainly affects ties],
)

#table(
  columns: (2.9cm, 1fr, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Criterion], [Nearest Neighbor], [Held-Karp],
  [Problem class], [Multi-location, greedy], [Multi-location, dynamic programming],
  [Objective], [Rapidly obtain a good visit order], [Determine the globally optimal visit order],
  [Step-selection rule], [At each step, select the cheapest remaining destination according to local route search], [Evaluate all subset states $(S, j)$ using the Bellman recurrence],
  [Required supporting data], [Multiple leg searches (multi-goal A\*)], [Complete pairwise cost matrix among all locations],
  [Heuristic], [Used at the leg-search layer (A\*), not at the ordering layer], [No heuristic in the DP layer],
  [Completeness in this project], [Produces a solution when each selected local leg can be found], [Produces a solution if a feasible tour exists and sufficient computational resources are available],
  [Optimality with respect to traffic cost], [Not guaranteed], [Yes, with respect to the input cost matrix],
  [Complexity], [Typically lower and operationally practical], [$O(n^2 2^n)$ in the number of stops],
  [Execution limit], [No small hard limit], [Stop-count limit (`MAX_HELD_KARP_STOPS`)],
)


== Breadth-First Search (BFS)

=== Theoretical Foundation

==== Operating Principle

BFS explores the state space level by level. Its frontier is a FIFO (*First In, First Out*) queue, so states discovered earlier are expanded earlier. After expanding the start state at depth 0, the algorithm processes all states one edge away from the start, then all states two edges away, and so forth. Because each edge is treated as a unit step, the first time BFS removes the goal from the queue, it has found a path with the minimum number of road segments.

In `bfs.py`, the algorithm performs the following steps:

+ create `SearchMemory`, place the start state in the queue, and mark it as discovered;
+ remove the first state from the queue using `pop()`;
+ call `record_expansion()` to close the state, increment `expanded`, and record the frontier in the trace;
+ if the node associated with the state equals the goal, call `complete_leg()` to reconstruct the path;
+ call `next_states()` to obtain valid successors under vehicle, time-period, one-way, and turn-restriction constraints;
+ for each successor not already present in `memory.cost`, record its `parent`, selected `via` edge, and depth `g = depth + 1`, then append it to the queue;
+ if the queue becomes empty before the goal is reached, return a result with `found = false`.

A state is marked as discovered when it is inserted into the queue rather than when it is later removed. Because BFS treats every edge as one hop, the first discovery of a state is already the minimum-hop arrival to that state, so there is no need to insert the same state into the queue repeatedly.

For BFS, `memory.cost` is not the modeled traffic cost. In the trace, $g(n)$ represents only depth, i.e., the number of edges from the start to $n$. After BFS has found a path, the planner separately sums `edge_cost()` across the selected edges to compute route-level metrics such as cost, distance, and travel time.

==== Pseudo-code

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
BFS(problem):
    memory   ← create_search_memory(start)
    frontier ← FIFO queue containing start

    while frontier is not empty:
        current ← frontier.pop_front()
        record_expansion(current)

        if node(current) = goal:
            return reconstruct_path(current)

        next_depth ← depth[current] + 1
        for each (edge, successor) in next_states(current):
            if successor has not been discovered:
                parent[successor] ← current
                via[successor] ← edge
                depth[successor] ← next_depth
                frontier.push_back(successor)

    return no_route
```
]

=== Illustrative Example

Consider a small graph designed by the team, with outgoing edges from `S` ordered as `S → X` before `S → Y`:

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
S → X → G
│
└→ Y → Z → G
```
]

The BFS process is:

#table(
  columns: (1.2cm, 2cm, 3.2cm, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Step], [Expanded], [Frontier after successor generation], [Explanation],
  [1], [`S`], [`[X, Y]`], [Expand the start state and enqueue both depth-1 nodes],
  [2], [`X`], [`[Y, G]`], [Discover the goal through the shorter branch],
  [3], [`Y`], [`[G, Z]`], [BFS still processes the node that was ahead of the goal in the queue],
  [4], [`G`], [`[Z]`], [The goal is removed from the queue and the algorithm terminates],
)

The reconstructed parent chain is `S → X → G`, containing two hops. The branch `S → Y → Z → G` contains three hops and is therefore not selected. In Route Lab, the Map view can be used to show the final route, while the Tree view or timeline can display the corresponding expanded-node and frontier sequence.

On the diamond-shaped backend test fixture, there are three alternatives from `A` to `D`: the direct edge `A → D` has length 3 km, path `A → B → D` has length 2 km, and path `A → C → D` has length 2.5 km. BFS selects `A → D` because it contains only one hop, even though it is not the lowest-distance route. This test demonstrates that BFS minimizes edge count rather than the modeled traffic cost.

=== Heuristic Function

BFS does not use a heuristic. Although the system may construct a common heuristic function when building a `SearchProblem`, `breadth_first_search()` never calls `problem.heuristic`. Expansion order depends only on discovery order and FIFO queue semantics.

=== Evaluation

==== Completeness

BFS is complete on a finite graph provided that the goal is reachable and repeated states are prevented. Route Lab stores discovered states in `memory.cost`, so each state is inserted into the queue at most once. Cycles in the road network therefore cannot cause non-termination. If no route exists, BFS expands all reachable states and returns `no route`.

For Route Lab, the conclusion is that *BFS is complete on the finite graph obtained after applying vehicle and traffic constraints*.

==== Optimality

BFS is optimal with respect to hop count when every transition is treated as having unit cost. However, Route Lab road segments differ in length, travel time, congestion, and risk. A path with fewer edges need not have a lower modeled cost. BFS therefore does not guarantee optimality under the project's traffic cost function, and the UI labels its result as `approximate` rather than `optimal`.

For graph search, the time complexity is $O(V_s + E_s)$ and memory complexity is $O(V_s)$. Because the queue may contain many states from the same depth level, BFS often exhibits a larger `maxFrontier` than DFS.

#pagebreak()
== Depth-First Search (DFS)

=== Theoretical Foundation

==== Operating Principle

DFS prioritizes the most recently discovered state and follows one branch as deeply as possible before returning to alternatives. Its frontier is a LIFO (*Last In, First Out*) stack. If successors are read in the order `X`, then `Y`, both are pushed and `Y` is subsequently popped first. Consequently, DFS results are highly sensitive to the ordering of edges in the adjacency list.

In `dfs.py`, the procedure is structurally similar to BFS:

+ create `SearchMemory` and place the start state on the stack;
+ remove the state at the top of the stack;
+ record the expansion and test the goal;
+ generate valid successors using `next_states()`;
+ retain only successors that have not previously been discovered;
+ store `parent`, the selected `via` edge, and incremented depth;
+ push successors onto the stack in adjacency order;
+ stop when the goal is first popped from the stack, or report failure if the stack becomes empty.

DFS also marks a state at push time. This prevents the same state from entering the stack multiple times and guarantees termination on a finite cyclic graph. DFS does not perform backtracking by explicitly deleting the current path; backtracking occurs naturally when a branch has no remaining successors and earlier states still remain on the stack.

As in BFS, $g$ in the DFS trace denotes hop depth only. It is not used for state selection and does not represent cumulative traffic cost.

==== Pseudo-code

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
DFS(problem):
    memory   ← create_search_memory(start)
    frontier ← LIFO stack containing start

    while frontier is not empty:
        current ← frontier.pop()
        record_expansion(current)

        if node(current) = goal:
            return reconstruct_path(current)

        next_depth ← depth[current] + 1
        for each (edge, successor) in next_states(current):
            if successor has not been discovered:
                parent[successor] ← current
                via[successor] ← edge
                depth[successor] ← next_depth
                frontier.push(successor)

    return no_route
```
]

=== Illustrative Example

Using the same graph and adjacency ordering as in the BFS example:

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
S → X → G
│
└→ Y → Z → G
```
]

The DFS process is:

#table(
  columns: (1.2cm, 2cm, 3.2cm, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Step], [Expanded], [Stack after successor generation], [Explanation],
  [1], [`S`], [`[X, Y]`], [`Y` is on top because it was pushed after `X`],
  [2], [`Y`], [`[X, Z]`], [DFS continues down the most recently discovered branch],
  [3], [`Z`], [`[X, G]`], [The goal is discovered at depth 3],
  [4], [`G`], [`[X]`], [The goal is popped and the algorithm terminates],
)

DFS returns `S → Y → Z → G`, while the shorter path `S → X → G` remains on the stack and has not yet been considered. Reversing the adjacency order at `S` could cause DFS to select branch `X` first and produce a different result. This sensitivity explains why the final DFS route on a large road network may be long and indirect even when the implementation is correct.

=== Heuristic Function

DFS does not use a heuristic. `depth_first_search()` does not inspect `problem.heuristic`, `edge_cost()`, or the weight configuration to determine expansion order. Changing Distance, Time, Congestion, or Risk weights therefore does not change the expansion order when the graph, vehicle, period, feasible-edge set, and adjacency order are held constant.

=== Evaluation

==== Completeness

Tree-search DFS is not complete in an infinite state space or in the presence of cycles because it may descend indefinitely along one branch. Route Lab, however, implements DFS as graph search: a state is marked when pushed and is never inserted into the frontier a second time. Because the input road graph is finite, DFS will eventually visit every reachable state if it has not already found the goal.

For Route Lab, the conclusion is that *DFS is complete on a finite graph*. This conclusion depends on the implementation's visited-state mechanism and should not be generalized to every form of DFS.

==== Optimality

DFS terminates at the first goal encountered on the branch favored by the stack order. That goal need not minimize hop count, distance, or modeled traffic cost. DFS therefore provides no optimality guarantee under any of Route Lab's route-quality criteria, and the UI labels its result as `approximate`.

The implementation has time complexity $O(V_s + E_s)$ and memory complexity $O(V_s)$ because it stores the stack, visited/search memory, parent pointers, and `via` edges. The DFS frontier is often smaller than the BFS frontier because it explores deeply along one branch, although total memory usage can still grow linearly with the number of discovered states.

#pagebreak()
== Uniform Cost Search (UCS)

=== Theoretical Foundation

==== Operating Principle

Uniform Cost Search is a cumulative-cost search algorithm. Rather than expanding the state with the fewest steps, as BFS does, UCS always expands the state with the lowest known total cost from the start. For each state $n$, let $g(n)$ denote the cumulative cost from the start state to $n$.

The UCS priority function is therefore:

$ f(n) = g(n) $

In `ucs.py`, the algorithm uses a priority queue ordered by `g`. The start state is initially inserted with cost 0. At each iteration, the state with minimum `g` is removed. If it is the goal, the search terminates and the route is reconstructed. Otherwise, the algorithm examines all valid successors and computes $g'(v) = g(u) + c(u,v)$. If a lower-cost path is discovered, `parent`, `parent_edge`, and `best_cost` are updated. This implementation permits obsolete entries to remain in the heap; when a state has subsequently received a better `g` value, the stale entry is ignored when popped. This is a standard heap-based UCS technique that avoids in-place priority updates.

UCS is closely related to Dijkstra's algorithm: on a graph with non-negative edge weights, both select states according to the same cumulative-cost quantity $g(n)$. Unlike BFS, UCS does not assign unit cost to every transition; it uses the modeled cost of each edge. It is therefore appropriate for Route Lab, where edges differ in distance, travel time, congestion, and risk.

==== Pseudo-code

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
UCS(problem):
    frontier ← priority queue ordered by accumulated cost
    frontier.push(start, priority = 0)
    best_cost[start] ← 0
    parent[start] ← NONE

    while frontier is not empty:
        current ← frontier.pop_min()

        if current is a stale entry:
            continue

        if current = goal:
            return reconstruct_path(parent, goal)

        for each valid edge (current, next):
            new_cost ← best_cost[current] + cost(edge)

            if next not in best_cost or new_cost < best_cost[next]:
                best_cost[next] ← new_cost
                parent[next] ← current
                parent_edge[next] ← edge
                frontier.push(next, priority = new_cost)

    return no_route
```
]

=== Illustrative Example

Consider the following directed graph, where each edge label denotes cost:

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
A --1--> B --1--> D
 \               ^
  \1.5          1/
   v             /
   C -----------
```
]

There is also a direct edge `A → D` with cost 3. The candidate routes are:

#table(
  columns: (5cm, 5cm), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Path], [Total cost],
  [A → B → D], [2.0],
  [A → C → D], [2.5],
  [A → D], [3.0],
)

The UCS expansion sequence is:

#table(
  columns: (1.2cm, 3cm, 2.6cm, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Step], [Expanded], [g], [Explanation],
  [1], [`A`], [0.0], [Expand the start and generate `B(1.0)`, `C(1.5)`, and `D(3.0)`],
  [2], [`B`], [1.0], [Discover a lower-cost route to `D`: `1 + 1 = 2.0`],
  [3], [`C`], [1.5], [Do not update `D` because `2.5 > 2.0`],
  [4], [`D`], [2.0], [`D` is the goal, so the algorithm terminates],
)

The result is `A → B → D` with total cost 2.0. The direct edge `A → D` has only one hop but cost 3.0, so UCS does not select it. This example illustrates that UCS optimizes cumulative cost rather than hop count.

=== Heuristic Function

UCS does not use a non-zero heuristic. It can be interpreted as setting:

$ h(n) = 0 $

for every state $n$. Therefore:

$ f(n) = g(n) + h(n) = g(n) $

UCS consequently expands the state with the smallest cumulative path cost. It may expand more states than A\*, but its behavior does not depend on heuristic quality, and it guarantees an optimal path when all edge costs are non-negative.

=== Evaluation

==== Completeness

UCS is complete on a finite graph with non-negative edge costs. If a valid route from the start to the goal exists, the goal will eventually be removed from the priority queue. If no such route exists, the frontier eventually becomes empty and the algorithm returns `no route`.

In Route Lab, the graph is finite, and road-class, vehicle, period, and turn-restriction constraints are enforced before successors are generated. UCS therefore remains complete within the state space defined by the system's constraints.

==== Optimality

UCS is optimal when all edge costs are non-negative. When a state is removed from the frontier with the minimum priority, every not-yet-expanded frontier state has `g >= g(current)`. Consequently, no unexplored route can subsequently produce a lower cost for a goal already selected at minimum cost.

This property holds for point-to-point legs in Route Lab because `edge_cost()` is designed to be non-negative and the weight contract rejects negative weights. If all weights are zero, every route has `cost = 0`; in this degenerate case, cost no longer provides a meaningful basis for distinguishing route quality, so the system does not apply a substantive `optimal` label.

For a trip containing multiple stops, UCS optimizes only each individual leg under the supplied visit order. If `optimiseOrder` is disabled, UCS does not establish that the overall visit order is optimal. If the visit order is produced by Nearest Neighbor or Held-Karp, trip-level optimality depends on that ordering method as well as on the optimality of the individual leg searches.

With $V_s$ search states and $E_s$ feasible transitions, the heap-based implementation has time complexity $O((V_s + E_s) log V_s)$ and worst-case memory usage $O(V_s + E_s)$. When turn restrictions are active, a search state is defined by a node together with its incoming way; complexity should therefore be interpreted in terms of the actual number of search states rather than only the number of physical intersections.

#pagebreak()
== A\* (A-star)

=== Theoretical Foundation

A\* is an informed search algorithm for finding a minimum-cost path between a start vertex and a goal vertex in a weighted graph.

In Route Lab, the transportation network is represented as a directed graph $G=(V,E)$, where:

- $V$ is the set of vertices, each representing an intersection or map location;
- $E$ is the set of directed edges, each representing a traversable road segment;
- each edge is associated with attributes such as distance, estimated travel time, congestion, and risk.

A\* does not necessarily minimize geometric distance. Instead, it identifies a path with minimum total cost under the cost function configured in the system.

For an edge $e$, the modeled cost is:

$
"Cost"(e) = w_d dot "Distance"(e) + w_t dot "Time"(e) \
quad + w_c dot "Congestion"(e) dot "Distance"(e) \
quad + w_r dot "Risk"(e) dot "VehicleRiskFactor" dot "Distance"(e)
$

where:

- $w_d$ is the distance weight;
- $w_t$ is the travel-time weight;
- $w_c$ is the congestion weight;
- $w_r$ is the risk weight.

Accordingly, changing the weights may change which route is optimal under the model.

==== Operating Principle

A\* evaluates each state $n$ using:

$
f(n)=g(n)+h(n)
$

where:

- $g(n)$ is the lowest known actual cost from the start state to $n$;
- $h(n)$ is an estimate of the remaining cost from $n$ to the goal;
- $f(n)$ is the estimated total cost of a complete path from the start to the goal through $n$.

The algorithm maintains:

- a priority queue containing states awaiting expansion;
- the best-known cost for reaching each state;
- predecessor information for path reconstruction;
- a set of states that have already been expanded.

The search proceeds as follows:

1. Set the start state's cost to 0.
2. Insert the start state into the priority queue with priority $h("start")$.
3. Remove the state with the smallest $f(n)$ value.
4. If that state is the goal, terminate the search.
5. Otherwise, examine all valid outgoing edges from the current state.
6. For each successor, compute:

$
g_("new")(v)=g(u)+"Cost"(u,v)
$

7. If $g_("new")(v)$ is lower than the currently known cost for $v$, update:
   - the cost of $v$;
   - its predecessor;
   - its priority $f(v)=g_("new")(v)+h(v)$.
8. Continue until the goal is removed from the queue or the queue becomes empty.
9. Once the goal is reached, follow predecessor pointers backward to reconstruct the route.

The implementation also permits a previously expanded state to be reopened when a lower-cost path to that state is discovered.

==== Pseudo-code
#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
A_STAR(start, goal):
    frontier ← empty priority queue
    expanded ← empty set

    g[start] ← 0
    parent[start] ← null
    insert start into frontier with priority = h(start)

    while frontier is not empty:
        current ← remove state with minimum f

        if current = goal:
            return RECONSTRUCT_PATH(parent, goal)

        add current to expanded

        for each valid edge current → next:
            candidate_g ← g[current] + cost(current, next)

            if next has not been discovered
               or candidate_g < g[next]:

                g[next] ← candidate_g
                parent[next] ← current
                f[next] ← candidate_g + h(next)

                if next has already been expanded:
                    remove next from expanded

                insert next into frontier with priority = f[next]

    return FAILURE
```
]

In the conventional branching-factor analysis, worst-case time complexity is often expressed as:

$
O(b^d)
$

and worst-case memory complexity as:

$
O(b^d)
$

where $b$ is the branching factor and $d$ is the solution depth. In the finite graph implementation used by Route Lab, the corresponding heap-based graph-search cost can also be described in terms of the number of search states and transitions, as summarized in the comparison table above. In either formulation, practical performance depends strongly on heuristic informativeness.

=== Illustrative Example

Consider a small graph with start state $S$, goal state $G$, and two intermediate states $A$ and $B$.

The edge costs are:

$
"Cost"(S,A)=2, quad "Cost"(S,B)=1
$

$
"Cost"(A,G)=2, quad "Cost"(B,G)=6
$

The heuristic values are:

#table(
  columns: 2,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Vertex], [$ h(n) $],
  [$ S $], [4],
  [$ A $], [2],
  [$ B $], [5],
  [$ G $], [0],
)

At $S$:

$
g(S)=0, wide f(S)=0+4=4
$

After expanding $S$, the algorithm obtains:

For $A$:

$
g(A)=2, wide f(A)=2+2=4
$

For $B$:

$
g(B)=1, wide f(B)=1+5=6
$

Because $f(A)<f(B)$, A\* expands $A$ first. From $A$, it reaches $G$ with:

$
g(G)=2+2=4
$

$
f(G)=4+0=4
$

The selected path is:

$
S arrow.r A arrow.r G
$

with total cost:

$
"Cost"=4
$

By contrast, the path through $B$ has cost:

$
"Cost"(S arrow.r B arrow.r G)=1+6=7
$

This example demonstrates that selecting the edge with the lowest immediate cost does not necessarily produce the best complete path. A\* addresses this limitation by jointly considering accumulated cost and an estimate of the remaining cost.

Empirical results for A\* on the transportation dataset are presented in the Point-to-Point Results section.

=== Heuristic Function

==== Haversine Heuristic

The default A\* configuration in Route Lab uses the Haversine heuristic. It computes the great-circle distance between two points on the Earth's surface from their latitude and longitude.

Let:

- $phi _1,phi _2$ denote the latitudes of the two points;
- $lambda _1,lambda _2$ denote their longitudes;
- $R$ denote the Earth's mean radius;
- all coordinates be converted to radians before calculation.

Then:

$
Delta phi =phi _2-phi _1
$

$
Delta lambda =lambda _2-lambda _1
$

The Haversine formula is:

$
a= sin ^2((Delta phi)/(2)) + cos(phi _1) cos(phi _2) sin ^2((Delta lambda)/(2))
$

$
d_("Haversine") = 2R arcsin(sqrt a)
$

The heuristic used by A\* is:

$
h(n)=d_("Haversine")(n,"goal") times c_(min)
$

where $c_(min)$ is the minimum feasible modeled cost per kilometer in the road network:

$
c_(min)= min_(e in E) ("Cost"(e))/("Distance"(e))
$

Multiplication by $c_(min)$ converts the distance-based lower bound from kilometers into the same units as the cumulative cost $g(n)$. The two quantities can therefore be combined consistently in:

$
f(n)=g(n)+h(n)
$

The heuristic affects only the order in which states are expanded. It is not added to the actual cost reported for the final route.

Great-circle distance cannot exceed the length of any feasible road-network path connecting the same two positions. When combined with the minimum feasible cost per kilometer, it therefore yields a lower bound on the remaining modeled cost, provided the graph's geometric and cost assumptions remain valid.

=== Evaluation

==== Completeness

A search algorithm is complete if it is guaranteed to find a solution whenever one exists.

Within Route Lab, A\* is complete when:

- the graph contains a finite number of search states;
- edge costs are non-negative;
- all valid successor states can be generated;
- sufficient memory is available to maintain the frontier and search metadata.

If a route from the start to the goal exists, A\* will eventually reach the goal. If no valid route exists, the frontier becomes empty after all reachable states have been processed, and the algorithm reports failure.

==== Optimality

A\* is guaranteed to find a minimum-cost path if its heuristic is admissible:

$
0 <= h(n) <= h^*(n)
$

where $h^*(n)$ is the true optimal remaining cost from $n$ to the goal.

The Haversine heuristic is defined as:

$
h(n)=d_("Haversine")(n,"goal") times c_(min)
$

Because great-circle distance does not exceed the corresponding feasible road distance, and $c_(min)$ is a lower bound on cost per kilometer, the heuristic does not overestimate the optimal remaining modeled cost under the stated assumptions.

A heuristic is additionally *consistent* if:

$
h(n) <= "Cost"(n,n')+h(n')
$

for every edge $(n,n')$.

The Route Lab A\* implementation supports reopening a state when a lower-cost path to it is discovered. This mechanism preserves the ability to obtain an optimal solution even when an admissible heuristic is not perfectly consistent.

The guarantee applies to each point-to-point leg. A\* alone does not determine the globally optimal visit order for a multi-location trip.

#pagebreak()
== Nearest Neighbor (NN)

=== Theoretical Foundation

==== Operating Principle

Nearest Neighbor is a greedy algorithm used to determine visit order for trips with multiple stops. At each step, it considers only the currently unvisited location with the smallest route cost from the current position:

$ v^* = arg min_(v in R) C(u, v) $

where $R$ is the set of unvisited locations and $C(u,v)$ is the minimum route cost from the current location $u$ to candidate location $v$.

The NN procedure in Route Lab is:

+ initialize the unvisited list `remaining` and set `current = start`;
+ find the best leg from `current` to one location in `remaining` using multi-goal A\*, or context-aware A\* when turn restrictions require it;
+ select the destination with the lowest route cost, store that leg, and update `current`;
+ repeat until no unvisited candidate remains;
+ for an open route, append the fixed `dropoff` as the final leg; for a round trip, return to `start` at the end.

NN does not enumerate the full space of possible visit orders. It is therefore computationally efficient but does not guarantee a globally optimal solution. The method is appropriate when a high-quality route is required quickly, although a locally favorable choice may preclude a better trip-level ordering.

==== Pseudo-code

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
NN(route, start, candidates, forced_tail):
    remaining ← copy(candidates)
    current ← start
    order ← [start]

    while remaining is not empty:
        best_leg ← find_best_leg(current, remaining)

        if best_leg does not exist:
            return failure

        current ← last_node(best_leg)
        remove current from remaining
        append current to order

    for each final target in forced_tail:
        final_leg ← find_best_leg(current, [target])
        if final_leg does not exist:
            return failure
        append target to order

    return order
```
]

=== Illustrative Example

Suppose a warehouse `W` must visit three locations `A`, `B`, and `C`, with the following directed cost table:

#table(
  columns: (2.2cm, 2.2cm, 2.2cm, 2.2cm), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Current location], [To A], [To B], [To C],
  [W], [3], [1], [2],
  [B], [4], [—], [1],
  [C], [1], [—], [—],
)

The selection sequence is:

#table(
  columns: (1.2cm, 2cm, 2.4cm, 1fr), inset: (x: 5pt, y: 4pt), stroke: 0.45pt + luma(120),
  [Step], [Current location], [Unvisited locations], [Selection],
  [1], [`W`], [`A, B, C`], [`B`, because 1 is the minimum cost],
  [2], [`B`], [`A, C`], [`C`, because 1 is the minimum cost],
  [3], [`C`], [`A`], [`A`, because it is the only remaining location],
)

The resulting order is `W → B → C → A`, with total cost `1 + 1 + 1 = 3`.

Nearest Neighbor is therefore suitable when a route must be produced quickly and reasonably, but it can commit to a locally favorable choice that prevents a better global ordering.

=== Heuristic Function

NN uses heuristic reasoning at two distinct layers:

1. At the visit-order layer, it selects the destination with the lowest actual route cost from the current position:

   $ s(v) = C(u, v) $

2. At the leg-search layer, Route Lab uses multi-goal A\* with a safely scaled Haversine heuristic:

   $ h(n, R) = alpha dot min_(v in R) d_s(n, v) $

   where $R$ is the set of unvisited destinations and $alpha$ is a lower-bound cost-per-distance coefficient over feasible edges. This enables A\* to identify the cheapest reachable candidate according to the modeled route cost, while the trip-level ordering remains a greedy heuristic rather than a globally optimal optimization procedure.

=== Evaluation

==== Completeness

Completeness must be distinguished between the selection loop and the feasibility of the complete tour:

- At the selection-loop level, NN terminates after at most $k$ choices, where $k$ is the number of unvisited destinations.
- At the feasible-tour level, NN is not complete on a directed graph. A greedy decision can move the algorithm to a location from which the remaining tour cannot be completed even though another visit order would have been feasible.

In Route Lab, if all required transitions can be traversed in the necessary directions, NN returns a valid visit order. If the trip cannot be completed, the planner reports the failure explicitly and retains the constructed prefix rather than silently omitting a destination.

==== Optimality

NN is not globally optimal. It optimizes only the next decision and does not account for the total cost of the remaining trip. For example, suppose `W → A` costs 1 and `W → B` costs 2. If `A → B` is very expensive but `B → A` is inexpensive, the greedy route `W → A → B` may be substantially worse than `W → B → A`.

Accordingly, in Route Lab, NN is a greedy ordering algorithm rather than an exact optimization algorithm. The individual legs found by A\* may each be optimal for their respective endpoints, but concatenating those legs according to a greedy visit order does not preserve trip-level optimality. The planner therefore sets `optimal = false` for Nearest Neighbor.

If $m$ locations must be ordered and a complete cost table is already available, the greedy selection stage is typically $O(m^2)$. When the cost of computing actual routes between destinations is included, total runtime also depends on the number and complexity of multi-goal A\* searches. Because NN repeatedly evaluates candidate destinations, it may require more processing than a single A\* run on a fixed visit order, but it remains substantially more scalable than Held-Karp for larger instances.

#pagebreak()
== Held-Karp (Dynamic Programming)

=== Theoretical Foundation

Held-Karp is an exact dynamic-programming algorithm for determining the order in which multiple locations should be visited so that the total trip cost is minimized.

Unlike A\*, Held-Karp does not directly search through individual road intersections. Instead, it operates at the higher level of trip locations such as the start, intermediate stops, and final destination.

Within Route Lab:

- A\* determines an optimal route between two locations.
- Pairwise A\* constructs a directed cost matrix between all relevant location pairs.
- Held-Karp uses that matrix to determine the globally optimal visit order.

The overall pipeline is:

```text
Road-network graph
        ↓
A* between each relevant pair of locations
        ↓
Pairwise cost matrix
        ↓
Held-Karp Dynamic Programming
        ↓
Optimal visit order
        ↓
Concatenate the corresponding A* routes
```

Held-Karp supports both:

- an open tour that begins at a specified location and ends at a fixed destination;
- a closed tour that visits every required location and returns to the start.

==== Operating Principle

Held-Karp represents the problem using subset states and applies a Bellman recurrence.

Let:

- $W$ be the start location;
- $V=\{1,2, dots.h.c ,n\}$ be the set of locations that must be visited; for an Open Tour, the fixed destination $G$ is also included in $V$;
- $C(i,j)$ be the optimal modeled cost from location $i$ to location $j$, computed using A\*.

The dynamic-programming state is:

$
"DP"[S][j]
$

where:

- $S ⊆ V$ is the set of locations already visited;
- $j in S$ is the final location in that partial route;
- $"DP"[S][j]$ is the minimum cost of a route that starts at $W$, visits exactly the locations in $S$, and ends at $j$.

In the implementation, the subset $S$ is represented by a bitmask.

For example, with three locations A, B, and C:

#table(
  columns: 2,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Location set], [Bitmask],
  [$ \{A\} $], [001],
  [$ \{B\} $], [010],
  [$ \{C\} $], [100],
  [$ \{A,B\} $], [011],
  [$ \{A,C\} $], [101],
  [$ \{A,B,C\} $], [111],
)

*Base state.*

$
"DP"[\{j\}][j]=C(W,j)
$

This state represents a route traveling directly from the start to $j$.

*Transition recurrence.*

$
"DP"[S][j] = min_(i in S - {j}) ("DP"[S - {j}][i] + C(i,j))
$

The algorithm considers every location $i$ that may immediately precede $j$ and retains the transition with minimum total cost.

*Open tour with a fixed terminal destination.*

If the fixed destination is $G$:

$
op("OPT") = "DP"[V][G]
$

*Closed tour.*

If the route must return to the start:

$
op("OPT") = min_(j in V) ("DP"[V][j] + C(j,W))
$

A `parent` table records which predecessor state produced the minimum cost. After the terminal state has been identified, the algorithm follows this table backward to reconstruct the optimal visit order.

The time complexity is:

$
O(n^2 2^n)
$

and the memory complexity is:

$
O(n 2^n)
$

These bounds do not include the time required to construct the pairwise A\* cost matrix.

==== Pseudo-code

#block(inset: 10pt, fill: luma(245), width: 100%)[
```text
HELD_KARP(start, stops, cost):
    DP ← empty table
    parent ← empty table

    for each location j in stops:
        DP[{j}][j] ← cost(start, j)
        parent[{j}][j] ← null

    for each subset S of stops:
        for each location i in S:
            if DP[S][i] exists:
                for each location j not in S:
                    candidate ← DP[S][i] + cost(i, j)

                    if DP[S ∪ {j}][j] does not exist
                       or candidate < DP[S ∪ {j}][j]:

                        DP[S ∪ {j}][j] ← candidate
                        parent[S ∪ {j}][j] ← i

    ALL ← set containing all required locations

    if the tour is closed:
        last ← argmin j (
            DP[ALL][j] + cost(j, start)
        )
    else if the terminal destination is fixed:
        last ← fixed terminal destination
    else:
        last ← argmin j DP[ALL][j]

    order ← backtrack from last through parent
    return start + order
```
]

=== Illustrative Example

Suppose a vehicle starts at warehouse $W$, must visit locations A and B, and then return to $W$.

The directed cost matrix is:

#table(
  columns: 4,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [From/to], [$ W $], [$ A $], [$ B $],
  [$ W $], [-], [4], [2],
  [$ A $], [3], [-], [1],
  [$ B $], [5], [2], [-],
)

Initialization:

$
"DP"[\{A\}][A]=4
$

$
"DP"[\{B\}][B]=2
$

For the state that visits both A and B and ends at B:

$
"DP"[\{A,B\}][B] = "DP"[\{A\}][A]+C(A,B)
$

$
=4+1=5
$

For the state that visits both A and B and ends at A:

$
"DP"[\{A,B\}][A] = "DP"[\{B\}][B]+C(B,A)
$

$
=2+2=4
$

The costs of the two complete tours are:

$
W arrow.r A arrow.r B arrow.r W
$

$
"Cost"=5+C(B,W)=5+5=10
$

and:

$
W arrow.r B arrow.r A arrow.r W
$

$
"Cost"=4+C(A,W)=4+3=7
$

Because $7<10$, Held-Karp selects:

$
W arrow.r B arrow.r A arrow.r W
$

Empirical Held-Karp results for Open Tour and Closed Tour experiments are presented in the Multi-location Optimization section.

=== Heuristic Function

==== Indirect Role of Haversine

Held-Karp does not directly use a heuristic.

The algorithm does not prioritize DP states using an estimate. Instead, it systematically constructs subset states and retains the minimum cost associated with each state.

Haversine appears only indirectly during construction of the pairwise cost matrix:

$
C(i,j)=A^*(i,j)
$

Each matrix element $C(i,j)$ is the optimal modeled route cost from $i$ to $j$, determined by A\* using the Haversine heuristic.

The roles can therefore be distinguished as follows:

#table(
  columns: 2,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Component], [Role],
  [Haversine], [Guides each A\* leg search],
  [Pairwise A\*], [Computes route cost between every required pair of locations],
  [Held-Karp], [Determines the globally optimal visit order from the cost matrix],
)

=== Evaluation

==== Completeness

Held-Karp is complete over a finite set of destinations because it constructs DP states for every reachable subset configuration.

If a feasible trip exists that:

- begins at the specified start location;
- visits all required locations;
- ends at the required terminal destination or returns to the start;

then the algorithm constructs a state containing all destinations and returns the corresponding tour.

If no complete feasible tour exists, no valid terminal DP state is produced and the algorithm returns failure.

Completeness is guaranteed within the operational scope in which:

- the number of destinations does not exceed the system limit;
- transition costs are finite and non-negative;
- the pairwise matrix contains all required feasible transitions;
- sufficient computational resources are available to store the DP table.

The current implementation supports at most 12 destination stops. This is a practical restriction imposed by exponential complexity rather than a limitation of the Held-Karp recurrence itself.

==== Optimality

Held-Karp is an exact algorithm and guarantees a visit order with minimum total cost over the supplied pairwise cost matrix.

The guarantee follows Bellman's principle of optimality. If an optimal route to state $(S,j)$ visits $i$ immediately before $j$, then the partial route ending at $i$ must itself be optimal for state $(S-\{j\},i)$. If it were not, that partial route could be replaced by a cheaper one, producing a lower-cost route to $j$ and contradicting the assumed optimality of the original solution.

The recurrence:

$
"DP"[S][j] = min_{i in S-\{j\}} [ "DP"[S-\{j\}][i]+C(i,j) ]
$

considers every feasible predecessor of $j$, and therefore does not omit any necessary ordering represented by the state space.

System-level optimality rests on two layers:

1. A\* with an admissible Haversine heuristic produces an optimal modeled route cost for each pair of locations.
2. Held-Karp identifies the minimum total over the resulting pairwise cost matrix.

Therefore:

#block(inset: 8pt, fill: luma(245), radius: 3pt)[The combination of pairwise A\* and Held-Karp guarantees a trip with minimum total modeled cost over the specified locations and cost function, subject to the stated graph and feasibility assumptions.]

#pagebreak()
= Program Workflow

== System Overview

=== Overall Architecture

The system consists of two computational layers that communicate through a single JSON contract, together with three external services.

Three architectural characteristics are particularly important:

1. The backend is stateless. It stores neither the graph nor a user session; every request contains the complete road network required for that run. Consequently, the backend does not need to know whether the graph originated from OpenStreetMap, the built-in sample graph, or a user-imported JSON file.
2. Two planners share one contract. `lib/search.ts` executes directly in the browser, whereas `server/` executes in Python. The `VITE_API_URL` environment variable acts as the selection mechanism: when it is configured, all panes submit requests to the backend; when it is absent, computation occurs locally. Request and response structures are identical, so the remainder of the application does not need to distinguish which planner produced the result.
3. `lib/` must remain importable without React. This is a mandatory architectural convention: any functionality that requires hooks belongs in `components/` or `store.ts` rather than in the pure logic layer.

#report-figure(
  "Architecture/6.1.1-kien-truc-tong-the.png",
  [Overall architecture of Route Lab and its external services.],
  width: 96%,
) <fig:overall-architecture>

=== Lifecycle of a Request

The following workflow describes one complete user interaction, from specifying a pickup location to replaying the resulting search on the shared timeline.

Three implementation details in this workflow are deliberate design decisions:

1. The payload is reduced before transmission. `graph.adj` is a derived index that the backend can reconstruct from `edges`, and its entries reference the same edge objects already present in `edges`; transmitting it would therefore duplicate the complete edge set in JSON. `edge.shape` stores the full OpenStreetMap polyline used by the browser to draw the real geometry of each road and is typically the largest field in the request. A single Run action submits the road network once per pane, so transmitting visualization-only geometry six times to a backend that never renders it would constitute unnecessary network overhead.
2. Results are merged by `pane id`, not by array position. Requests may take time to complete, and during that interval the user may add, remove, reorder, or change the algorithm assigned to a pane. ID-based merging guarantees that an intervening UI operation cannot cause a result to overwrite the wrong pane.
3. Every input change calls `clearResults()`. The interface therefore never displays a mixture in which some panes show results from a previous configuration while others show results from the current one.

#report-figure(
  "Architecture/6.1.2-luong-request.png",
  [Lifecycle of a request from GUI configuration to synchronized visualization.],
  width: 88%,
) <fig:request-lifecycle>

== Program Modules, Functions, and Structure

=== Main Modules

Backend, located in `server/src/route_lab/`

#table(
  columns: (4.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Module], [Responsibility],
  [`api.py`], [Thin HTTP layer: POST `/plan`, GET `/health`, and CORS configuration. It does not intercept planning failures because `plan_route` converts invalid or infeasible queries into normal structured results whose `problem` field explains the issue.],
  [`planner.py`], [Orchestration layer: determines visit order, decomposes the trip into legs, dispatches each leg to the selected algorithm, concatenates results, and aggregates metrics.],
  [`diagnostics.py`], [Explains why a route leg cannot be completed.],
  [`algorithms/`], [One file per algorithm: `bfs`, `dfs`, `ucs`, `astar`, `multi_goal`, `nearest_neighbor`, and `held_karp`, together with `base` and `registry`. `ucs.py` serves as the reference implementation pattern.],
  [`shared/`], [Shared functionality: `traffic` (cost model), `search` (search framework), `problem`, `heap`, `frontier`, `graph`, `geo`, `heuristics`, `pairwise`, and `rounding`.],
  [`contract/`], [Pydantic models mirroring `web/src/lib/types.ts`; these define the JSON contract shared by frontend and backend.],
)

Frontend, located in `web/src/`

#table(
  columns: (4.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Module], [Responsibility],
  [`store.ts`], [Single Zustand store. Every value that defines a run is stored here.],
  [`lib/search.ts`], [In-browser planner implementing BFS, DFS, UCS, A\*, Nearest Neighbor, the heap, and trip decomposition.],
  [`lib/planClient.ts`], [Backend adapter: constructs the payload, invokes POST `/plan`, and validates the response.],
  [`lib/overpass.ts`], [Retrieves OpenStreetMap data and constructs the road graph; also defines `BASE_JAM` and `BASE_RISK`.],
  [`lib/traffic.ts`], [Vehicle definitions, time periods, road classes, routing criteria, and cost function.],
  [`lib/sampleGraph.ts` · `lib/sampleCases.ts`], [The 21-node sample graph and eight illustrative scenarios.],
  [`lib/explain.ts` · `lib/tree.ts`], [Generates explanatory text and lays out the search tree.],
  [`components/`], [All UI elements, including Sidebar, MapPane, TreeView, Timeline, and comparison tables.],
)

#report-figure(
  "Architecture/6.2.3-phan-tang-backend.png",
  [Layered organization and dependency direction of the Python backend.],
  width: 43%,
) <fig:backend-layers>

=== Main Functions

Backend

#table(
  columns: (5cm, 3.8cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left),
  [Function], [Location], [Role],
  [`plan_route(request)`], [`planner.py`], [Single planning entry point. Builds the graph, validates locations, measures execution time, and returns a `RouteResult`.],
  [`_plan_measured(...)`], [`planner.py`], [Contains all work included in the planning timer and centralizes algorithm-specific branching so that measured work cannot be accidentally omitted.],
  [`_leg_sequence(...)`], [`planner.py`], [Determines visit order and decomposes the trip into route legs.],
  [`_plan_greedy_route(...)`], [`planner.py`], [Shared greedy loop used by Nearest Neighbor and order-optimizing UCS.],
  [`_route_from_legs(...)`], [`planner.py`], [Combines route legs and aggregates all metrics. Every planning branch terminates here, ensuring consistent metric calculation.],
  [`build_problem(...)`], [`shared/problem.py`], [Encapsulates one leg as a `SearchProblem`: graph, endpoints, conditions, cost function, and heuristic.],
  [`create_search_memory` · `next_states` #linebreak() `remember` · `record_expansion` #linebreak() `complete_leg`], [`shared/search.py`], [Shared search framework. This framework, rather than individual algorithms, performs metric accounting.],
  [`build_pairwise(...)`], [`shared/pairwise.py`], [Constructs the directed cost matrix between all location pairs. Used by Held-Karp and by the ordering stage of point-to-point algorithms when visit-order optimization is enabled.],
  [`nearest_neighbor_` #linebreak() `multi_goal_search(...)`], [`algorithms/` #linebreak() `nearest_neighbor.py`], [Performs one multi-goal A\* search for each greedy selection step.],
  [`edge_cost` · `edge_minutes` #linebreak() `passable` · `turn_allowed`], [`shared/traffic.py`], [Implements the cost model and traffic constraints.],
  [`why_blocked(...)`], [`diagnostics.py`], [Returns a concise, actionable explanation when a leg is infeasible.],
)

Frontend

#table(
  columns: (4.0cm, 3.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left),
  [Function], [Location], [Role],
  [`buildGraph(points, detail)`], [`lib/overpass.ts`], [Retrieves and constructs the real road network.],
  [`snap` · `anchorTo`], [`lib/overpass.ts` · `store.ts`], [Maps geographic coordinates to feasible intersections from which the selected vehicle can depart.],
  [`run()`], [`store.ts`], [Executes all panes using the same input configuration.],
  [`planRouteRemote(input)`], [`lib/planClient.ts`], [Calls the backend and validates the returned response.],
  [`planRoute(input)`], [`lib/search.ts`], [Fallback planner that executes in the browser.],
)

- Design decision 1 means that the shared search framework performs metric accounting, while individual algorithms do not.

All search-effort metrics, including expanded nodes, generated states, reopened states, peak frontier size, and turns blocked by restrictions, are collected by `shared/search.py`. This design supports a fair comparison because no algorithm can under-count or over-count a metric: metric collection is centralized and independent of algorithm-specific code.

- Design decision 2 specifies that Nearest Neighbor performs one multi-goal search per greedy step.

The earlier approach constructed the complete pairwise matrix of size $|P|^2$ before executing the greedy loop, even though each greedy step only needs to identify the nearest destination among the remaining candidates. The current implementation instead performs exactly one A\* search whose goal set is the current set of unvisited destinations and terminates when the first optimal target is reached. This requires approximately $|P|$ searches rather than $|P|^2$. To remain admissible over multiple goals, the heuristic uses the minimum straight-line distance to any candidate destination and multiplies it by `min_cost_per_km` to convert the lower bound into cost units. The complete pairwise matrix is still constructed for Held-Karp, which requires all pairwise costs, and for point-to-point algorithms when `optimiseOrder` is enabled.

Design decision 3 specifies that the system reports two timing measurements rather than one.

#table(
  columns: (2.8cm, 1fr, 3cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left),
  [Field], [Measured scope], [Reported by],
  [`ms`], [Total time spent inside the route-leg search calls], [Both planners, measured under the same definition],
  [`planningMs` (backend: `planning_ms`)], [Wall-clock time for the complete planning pipeline after input validation, including pairwise matrix construction, ordering, leg searches, and route assembly], [Backend only],
)

The separation is necessary because earlier versions measured different scopes: the backend measured the complete planning pipeline, whereas the browser planner summed only leg-search time. The same trip could therefore report different timing values depending on the execution path, making comparisons misleading. Both planners now calculate `ms` consistently from the search legs that form the returned route, while the broader backend measurement is reported separately. Consequently, `ms` is the only timing field used to rank algorithms directly. `planningMs` is intentionally not ranked in the comparison table because its scope varies depending on whether a particular run performs ordering or pairwise preprocessing.

=== Program Structure

#block(width: 100%, inset: 8pt, fill: luma(245))[
```
.
├── README.md
├── CONVENTIONS.md                naming and coding conventions
├── Lab 1 - Searching.pdf         assignment specification
├── Makefile                      make dev / check / test / lint / build
├── .github/workflows/ci.yml      tests, linting, architecture-layer checks
├── docs/
│   ├── design-spec.md            UI/UX design specification with decision rationale
│   ├── ui-screenshot.png
│   └── ui-overview.svg
├── web/                          production web application
│   └── src/
│       ├── main.tsx              entry point
│       ├── App.tsx               layout: topbar, sidebar, pane grid, timeline
│       ├── store.ts              single Zustand store
│       ├── styles.css            complete design system
│       ├── components/           Sidebar · MapPane · TreeView · Timeline ·
│       │                         Compare · CompareAlgos · CompareCriteria ·
│       │                         Explain · PlaceField · Segment · HeldKarpNotice
│       ├── lib/                  pure logic without React or the DOM
│       └── icons/
└── server/                       Python backend
    ├── pyproject.toml            includes import-linter configuration
    ├── tests/                    pytest test suite
    └── src/route_lab/
        ├── contract/             Pydantic mirror of web/src/lib/types.ts
        ├── shared/               cost model, Haversine, heap, search framework
        ├── algorithms/           one file per algorithm
        ├── planner.py            leg decomposition, orchestration, RouteResult aggregation
        ├── diagnostics.py        explanations for infeasible route legs
        └── api.py                FastAPI: POST /plan, GET /health
```
]

The backend follows a layered architecture, and the dependency direction is automatically verified by import-linter in CI. Each layer may import only lower-level layers.
(Flow diagram)

Accordingly, `algorithms/` may depend on `shared/` and `contract/` but never upward on `planner.py` or `api.py`; `shared/` never imports an algorithm; and `contract/` is a pure leaf layer protected by a dedicated forbidden-import contract. This is why `shared/pairwise.py` receives the search function as an argument instead of importing A\* directly: dependency injection allows it to bridge functionality across layers without violating the architectural ordering.

Frontend architectural principles are:

1. One store, with no local copies of run-defining state. No component maintains a separate copy of the pickup location or weight configuration. Changing any run-defining input clears all results simultaneously.
2. A pane is a view, not an owner of the query. A pane stores its selected algorithm, visualization mode, and result, but not the shared query state. This structural constraint is what makes comparisons reliable: all panes are guaranteed to have executed on the same input.
3. One timeline controls all panes. Step 128 means step 128 for every pane simultaneously. Per-pane playback speed is intentionally not implemented because it would undermine synchronized comparison, which is a primary purpose of the tool.
4. The trace stores node indices rather than string IDs. A run over a network containing several hundred nodes can generate tens of thousands of frontier entries. Multiplied by six panes, storing repeated string IDs would consume substantially more memory without adding information. `RouteResult.nodeIds` maps compact indices back to node identifiers when necessary.

== Interaction Between the GUI and the Algorithms

=== Fundamental Principle: the Sidebar Is the Single Source of Run Configuration

Every value that defines a run, including pickup, dropoff, intermediate stops, network detail level, vehicle, time period, four weights, visit-order optimization, and round-trip mode, is stored in `store.ts` and is entered through the sidebar. No component maintains an independent copy. Any modification triggers `clearResults()`, clearing the results of every pane.

This property gives the algorithm comparison experimental validity: when six panes display results simultaneously, the viewer can be confident that they were produced from the same input because the program architecture does not permit otherwise.

=== Data Sent from the GUI to the Algorithms

The `planInput()` function in `store.ts` collects the shared state into a single input object used by every pane:

#block(width: 100%, inset: 8pt, fill: luma(245))[
`{ graph, start, goal, stops, optimiseOrder, returnToStart, conditions }`
]

where `conditions = { vehicle, period, weights }`. Only `algo` differs across panes; all other fields are shared. If the run prerequisites are not satisfied, for example, when no graph is available or the pickup/dropoff has not been successfully snapped, the function returns `null` and Run does not execute.

=== Data Returned from the Algorithms to the GUI

Each run returns a `RouteResult`. Different interface components consume different fields for specific purposes:

#table(
  columns: (2.7cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Field], [GUI use],
  [`path`], [Draws the selected route on the map],
  [`order`], [Displays the order in which locations are visited],
  [`trace`], [Replays the search process; each element represents one node expansion and records the frontier at that moment, together with `g`, `h`, and parent information],
  [`reveal`], [Determines which portion of the route is visible at a given timeline step],
  [`metrics`], [Provides the numerical values shown at the bottom of each pane and in comparison tables],
  [`problem`], [Displays an explanation when a query is invalid or a route leg is blocked],
)

The `trace` field is the key mechanism supporting the assignment requirement for step-by-step visualization of the search process. The `parent -> node` relationship recorded at each step forms the search tree, whose structure characterizes the behavior of the algorithm and is visualized in Tree view.

=== Shared Timeline Synchronization Mechanism

#report-figure(
  "Architecture/6.3.4-timeline-dong-bo.png",
  [Shared-timeline mechanism used to synchronize all algorithm panes.],
  width: 100%,
) <fig:shared-timeline>

After all runs complete, the store computes `maxStep` as the maximum trace length among the panes, sets `step = 0`, and enables `playing = true`. From that point, one shared `step` variable controls every pane: each pane renders its own trace prefix from the beginning through the current step.

A pane that finishes earlier remains at its final state while other panes continue advancing, and this contrast is itself informative. In the Cross-town haul scenario, for example, A\* finishes at step 12 with a 12.4 km route and an optimality guarantee; UCS continues searching until approximately step 20 before returning the same route; DFS terminates at step 9 with a 22.9 km route, which is almost twice as long.

=== Two Planners, One Contract

The GUI is agnostic to which planner produced a result. The same `RouteResult` structure is rendered identically whether it originates from browser-side `lib/search.ts` or backend `planner.py`. The choice is controlled by the build-time `VITE_API_URL` variable.

Two differences are handled explicitly:

1. Held-Karp is available only on the backend. The browser planner does not implement it and rejects the request explicitly rather than silently substituting a heuristic solution. If a pane selects Held-Karp without an available backend, it displays the appropriate message through `components/HeldKarpNotice.tsx`.
2. `planningMs` is available only in backend results, where the corresponding Pydantic field is named `planning_ms` (see Design decision 3 concerning the two timing measurements above). It is therefore optional in the frontend contract.

On receipt, `planClient.ts` validates the response shape before using it. This provides a version-safety boundary between frontend and backend: a missing field should produce a clear runtime validation error at the API boundary rather than an obscure `TypeError` during later rendering.

=== Handling Infeasible Routes

When a route leg cannot be found, the system performs two additional graph traversals to distinguish among failure causes because different causes require different corrective actions:

#table(
  columns: (4.0cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Cause], [Message presented to the user],
  [The network is genuinely disconnected], [Rebuild the network using a different detail level or choose locations that are geographically closer],
  [One-way trap], [The locations are topologically connected, but only through one-way roads oriented in the opposite direction],
  [Turn restriction], [Every otherwise traversable option for the current vehicle is blocked by a turn restriction during the selected period],
  [Vehicle- or time-dependent prohibition], [Identify the vehicle and prohibited road class explicitly, and suggest an alternative vehicle or time period that would permit travel],
)

The explanation is stored in the `problem` field of `RouteResult` and displayed directly in the affected pane. The design principle is that the explanation should be concise and actionable.

=== Interface Components That Consume Results

#table(
  columns: (3.0cm, 3.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, left),
  [Component], [Fields consumed], [Presentation],
  [MapPane], [`path`, `trace`, `reveal`, `metrics`], [Real map or search-tree view, together with pane-level metrics],
  [TreeView], [`trace` (parent-child pairs)], [Radial tree layout that exposes the characteristic search shape of the algorithm],
  [Timeline], [`maxStep`, `step`], [Shared playback control for all panes],
  [Explain], [`metrics`, `path`, `order`], [Generates an explanation of why the route was selected],
  [CompareAlgos], [`metrics` from all panes], [Cross-algorithm comparison table with best values highlighted],
  [CompareCriteria], [Re-runs under each weight configuration], [Comparison across optimization criteria],
  [Compare], [Re-runs for each vehicle type], [Comparison across vehicles],
)

The final three comparison tables hold one algorithm fixed, specifically the algorithm assigned to the leftmost pane, and vary exactly one experimental dimension at a time, following the principle of controlled comparison.
#pagebreak()
= Algorithm Comparison

== Experimental Setup

This section evaluates six algorithms on the same point-to-point routing problem in order to compare route quality, search effort, frontier memory usage, and processing time under controlled conditions.

All algorithms use the same origin, destination, vehicle, time period, road type, and graph. The only factor varied across the three experimental cases is the congestion weight $w_c$.

=== Test Dataset

#table(
  columns: 2,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Attribute], [Value],
  [Start location], [Ben Thanh Market],
  [Goal location], [Notre-Dame Cathedral Basilica of Saigon],
  [Vehicle], [Car],
  [Period], [Peak],
  [Road type], [Minor roads],
  [Number of nodes], [558],
  [Number of edges], [1135],
  [Graph], [Held constant],
)

Three weight configurations are used:

#table(
  columns: 5,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Case], [Distance], [Time], [Congestion], [Risk],
  [Congestion Min], [1.00], [0.50], [0.00], [1.50],
  [Balanced], [1.00], [0.50], [0.80], [1.50],
  [Congestion Max], [1.00], [0.50], [3.00], [1.50],
)

The edge-cost function is:

$
"Cost"(e)= w_d dot "Distance"(e)+w_t dot "Time"(e) \
+w_c dot "Congestion"(e) dot "Distance"(e) \
+w_r dot "Risk"(e) dot "VehicleRiskFactor" dot "Distance"(e)
$

As $w_c$ increases, highly congested segments receive a larger direct penalty. This can affect both the final route cost and the expansion priority of algorithms that use edge cost during search.

=== Evaluation Metrics

The following metrics are reported:

- `Route`: final selected route;
- `Cost`: total route cost under the objective function;
- `Distance`: total physical distance;
- `Time`: estimated travel time;
- `Hops`: number of edges in the final route;
- `Expanded`: number of states expanded;
- `Generated`: number of states generated and inserted into the frontier;
- `Reopened`: number of times a previously generated state is discovered again with a lower cost and reinserted into the frontier;
- `Peak Frontier`: maximum frontier size;
- `Runtime`: time spent inside the search calls that construct the route;
- `Planning`: wall-clock time for the complete planning pipeline after validation;
- `Verdict`: `Optimal` or `Approximate`, according to the formal guarantee of the algorithm.

The Runtime and Planning values in the present tables are obtained from individual runs and are therefore used only to characterize observed processing time, not as statistically rigorous benchmarks. Runtime excludes OpenStreetMap retrieval, network transmission, map rendering, and frontend animation.

For BFS, DFS, UCS, and Nearest Neighbor, the current experimental dataset does not include a complete sequence of street names. Accordingly, the `Route` column reports only the trip endpoints; the detailed `path` data or route screenshots should be consulted when verification of the exact edge sequence is required.

== Comparison of Theoretical Properties

The theoretical principles, complexity, completeness, and optimality of all six algorithms were established in the preceding section. This section therefore focuses on the empirical point-to-point results under three congestion-weight settings, organized by Route Quality, Search Performance, and Processing Time.

For a problem with only one destination, Nearest Neighbor reduces to a multi-goal A\* search with a singleton goal set, while Held-Karp has no nontrivial visit-order decision to optimize. Point-to-point experiments are therefore most informative for comparing BFS, DFS, UCS, and A\*. The visit-order capabilities of Nearest Neighbor and Held-Karp are evaluated separately in the Multi-location Optimization section.

== Point-to-Point Results

=== Congestion Min

==== Experimental Conditions

With $w_c=0$, congestion contributes no direct penalty to the objective function. All other conditions remain fixed: Car, Peak, Minor roads, and a graph containing 558 nodes and 1135 edges.

#table(
  columns: 5,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: center,
  [Distance], [Time], [Congestion], [Risk], [Congestion setting],
  [1.00], [0.50], [0.00], [1.50], [No direct penalty],
)

==== Route Quality

#table(
  columns: (2.2cm, 1fr, 1.1cm, 1.5cm, 1.2cm, 1.1cm, 2.5cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Route], [Cost], [Distance], [Time], [Hops], [Verdict],
  [BFS], [Ben Thanh Market → Notre-Dame Cathedral], [4.6], [1.07 km], [6 min], [8], [Approximate],
  [DFS], [Ben Thanh Market → Notre-Dame Cathedral], [41.9], [11.19 km], [52 min], [148], [Approximate],
  [UCS], [Ben Thanh Market → Notre-Dame Cathedral], [4.4], [1.15 km], [6 min], [13], [Optimal],
  [A\*], [Ben Thanh Market → Notre-Dame Cathedral], [4.4], [1.15 km], [6 min], [13], [Optimal],
  [Nearest Neighbor], [Ben Thanh Market → Notre-Dame Cathedral], [4.4], [1.15 km], [6 min], [13], [Approximate],
  [Held-Karp DP], [Ben Thanh Market → Notre-Dame Cathedral], [4.4], [1.15 km], [6 min], [13], [Optimal],
)

==== Search Performance

#table(
  columns: 7,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: center,
  [Algorithm], [Expanded], [Generated], [Reopened], [Peak Frontier], [Runtime], [Planning],
  [BFS], [122], [163], [0], [44], [2.0 ms], [4.2 ms],
  [DFS], [448], [570], [0], [124], [8.4 ms], [10.8 ms],
  [UCS], [623], [650], [2], [87], [14.5 ms], [15.8 ms],
  [A\*], [102], [132], [0], [34], [2.7 ms], [4.1 ms],
  [Nearest Neighbor], [106], [140], [0], [35], [3.3 ms], [6.4 ms],
  [Held-Karp DP], [102], [132], [0], [34], [2.7 ms], [5.5 ms],
)

==== Discussion

UCS, A\*, Nearest Neighbor, and Held-Karp all achieve the minimum observed cost of 4.4. BFS uses fewer hops but does not optimize the weighted objective, whereas DFS produces both the longest route and the highest cost. A\* expands only 102 states compared with 623 for UCS, illustrating that the Haversine heuristic substantially reduces search effort. Held-Karp provides no route-quality advantage in this degenerate point-to-point case and introduces additional planning overhead.

==== Evidence

#grid(
  columns: 1,
  gutter: 10pt,
  report-figure("bfs/min.png", [BFS result under Congestion Min.], width: 100%),
  report-figure("dfs/min.png", [DFS result under Congestion Min.], width: 100%),
  report-figure("UCS/min.png", [UCS result under Congestion Min.], width: 100%),
  report-figure("a_star/min.png", [A\* result under Congestion Min.], width: 100%),
  report-figure("Nearest Neighbor/min.png", [Nearest Neighbor result under Congestion Min.], width: 100%),
  report-figure("dp/min.png", [Held-Karp DP result under Congestion Min.], width: 100%),
)

=== Balanced

==== Experimental Conditions

With $w_c=0.8$, congestion contributes directly to the objective function. Vehicle, period, road type, and graph remain identical to the Congestion Min case.

#table(
  columns: 5,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: center,
  [Distance], [Time], [Congestion], [Risk], [Congestion setting],
  [1.00], [0.50], [0.80], [1.50], [Balanced penalty],
)

==== Route Quality

#table(
  columns: (2.2cm, 1fr, 1.1cm, 1.5cm, 1.2cm, 1.1cm, 2.5cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Route], [Cost], [Distance], [Time], [Hops], [Verdict],
  [BFS], [Ben Thanh Market → Notre-Dame Cathedral], [7.3], [1.07 km], [6 min], [8], [Approximate],
  [DFS], [Ben Thanh Market → Notre-Dame Cathedral], [69.9], [11.19 km], [52 min], [148], [Approximate],
  [UCS], [Ben Thanh Market → Notre-Dame Cathedral], [7.2], [1.15 km], [6 min], [13], [Optimal],
  [A\*], [Ben Thanh Market → Notre-Dame Cathedral], [7.2], [1.15 km], [6 min], [13], [Optimal],
  [Nearest Neighbor], [Ben Thanh Market → Notre-Dame Cathedral], [7.2], [1.15 km], [6 min], [13], [Approximate],
  [Held-Karp DP], [Ben Thanh Market → Notre-Dame Cathedral], [7.2], [1.15 km], [6 min], [13], [Optimal],
)

==== Search Performance

#table(
  columns: 7,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: center,
  [Algorithm], [Expanded], [Generated], [Reopened], [Peak Frontier], [Runtime], [Planning],
  [BFS], [122], [163], [0], [44], [1.8 ms], [3.9 ms],
  [DFS], [448], [570], [0], [124], [8.6 ms], [11.4 ms],
  [UCS], [630], [665], [1], [87], [15.4 ms], [16.8 ms],
  [A\*], [131], [170], [0], [41], [3.2 ms], [4.2 ms],
  [Nearest Neighbor], [134], [175], [0], [43], [3.2 ms], [5.6 ms],
  [Held-Karp DP], [131], [170], [0], [41], [4.0 ms], [7.9 ms],
)

==== Discussion

UCS, A\*, Nearest Neighbor, and Held-Karp again achieve the minimum cost, now 7.2, while each algorithm's distance, travel time, and hop count remain unchanged from Congestion Min. Although the final route is unchanged, A\* increases from 102 to 131 expanded states and from a peak frontier of 34 to 41, showing that the modified edge-cost landscape changes the search order. BFS and DFS retain the same search effort because their frontiers are not ordered by weighted cost.

==== Evidence

#grid(
  columns: 1,
  gutter: 10pt,
  report-figure("bfs/balance.png", [BFS result under the Balanced configuration.], width: 100%),
  report-figure("dfs/balance.png", [DFS result under the Balanced configuration.], width: 100%),
  report-figure("UCS/balanced.png", [UCS result under the Balanced configuration.], width: 100%),
  report-figure("a_star/balance.png", [A\* result under the Balanced configuration.], width: 100%),
  report-figure("Nearest Neighbor/balanced.png", [Nearest Neighbor result under the Balanced configuration.], width: 100%),
  report-figure("dp/balance.png", [Held-Karp DP result under the Balanced configuration.], width: 100%),
)

=== Congestion Max

==== Experimental Conditions

With $w_c=3.0$, congestion receives the largest weight among the three runs. All other experimental variables remain fixed in order to isolate the effect of congestion weighting.

#table(
  columns: 5,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: center,
  [Distance], [Time], [Congestion], [Risk], [Congestion setting],
  [1.00], [0.50], [3.00], [1.50], [High penalty],
)

==== Route Quality

#table(
  columns: (2.2cm, 1fr, 1.1cm, 1.5cm, 1.2cm, 1.1cm, 2.5cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Route], [Cost], [Distance], [Time], [Hops], [Verdict],
  [BFS], [Ben Thanh Market → Notre-Dame Cathedral], [15.0], [1.07 km], [6 min], [8], [Approximate],
  [DFS], [Ben Thanh Market → Notre-Dame Cathedral], [146.8], [11.19 km], [52 min], [148], [Approximate],
  [UCS], [Ben Thanh Market → Notre-Dame Cathedral], [14.8], [1.15 km], [6 min], [13], [Optimal],
  [A\*], [Ben Thanh Market → Notre-Dame Cathedral], [14.8], [1.15 km], [6 min], [13], [Optimal],
  [Nearest Neighbor], [Ben Thanh Market → Notre-Dame Cathedral], [14.8], [1.15 km], [6 min], [13], [Approximate],
  [Held-Karp DP], [Ben Thanh Market → Notre-Dame Cathedral], [14.8], [1.15 km], [6 min], [13], [Optimal],
)

==== Search Performance

#table(
  columns: 7,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: center,
  [Algorithm], [Expanded], [Generated], [Reopened], [Peak Frontier], [Runtime], [Planning],
  [BFS], [122], [163], [0], [44], [1.9 ms], [4.3 ms],
  [DFS], [448], [570], [0], [124], [8.3 ms], [10.8 ms],
  [UCS], [640], [670], [3], [82], [16.7 ms], [18.0 ms],
  [A\*], [213], [262], [0], [58], [6.1 ms], [7.2 ms],
  [Nearest Neighbor], [219], [274], [0], [58], [12.3 ms], [15.8 ms],
  [Held-Karp DP], [213], [262], [0], [58], [5.9 ms], [10.3 ms],
)

==== Discussion

UCS, A\*, Nearest Neighbor, and Held-Karp continue to attain the minimum cost of 14.8. BFS differs only slightly at 15.0, whereas DFS rises to 146.8. A\* expands 213 states, which is more than twice its Congestion Min count, while UCS rises from 623 to 640 expanded states. These results indicate that congestion weighting can substantially alter search effort and planning time even when the final route remains unchanged.

==== Evidence

#grid(
  columns: 1,
  gutter: 10pt,
  report-figure("bfs/max.png", [BFS result under Congestion Max.], width: 100%),
  report-figure("dfs/max.png", [DFS result under Congestion Max.], width: 100%),
  report-figure("UCS/max.png", [UCS result under Congestion Max.], width: 100%),
  report-figure("a_star/max.png", [A\* result under Congestion Max.], width: 100%),
  report-figure("Nearest Neighbor/max.png", [Nearest Neighbor result under Congestion Max.], width: 100%),
  report-figure("dp/max.png", [Held-Karp DP result under Congestion Max.], width: 100%),
)

== Cross-Algorithm Synthesis

=== Route Quality and Optimality

Rather than evaluating each algorithm independently in every case, the following table summarizes route-quality trends across all three congestion settings.

#table(
  columns: 6,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Distance / Time / Hops], [Cost Min → Balanced → Max], [Verdict], [Strength], [Limitation in Group 1],
  [BFS], [1.07 km / 6 min / 8], [4.6 → 7.3 → 15.0], [Approximate], [Minimum hop count], [Does not optimize weighted cost],
  [DFS], [11.19 km / 52 min / 148], [41.9 → 69.9 → 146.8], [Approximate], [Simple traversal mechanism], [Route quality strongly depends on adjacency order],
  [UCS], [1.15 km / 6 min / 13], [4.4 → 7.2 → 14.8], [Optimal], [Guarantees minimum weighted cost], [Expands many states because no heuristic is used],
  [A\*], [1.15 km / 6 min / 13], [4.4 → 7.2 → 14.8], [Optimal], [Minimum cost with heuristic guidance], [Performance depends on heuristic informativeness],
  [Nearest Neighbor], [1.15 km / 6 min / 13], [4.4 → 7.2 → 14.8], [Approximate at the tour level], [Efficient one-goal search in this case], [Greedy visit ordering is not exercised with only one destination],
  [Held-Karp DP], [1.15 km / 6 min / 13], [4.4 → 7.2 → 14.8], [Optimal], [Exact visit-order optimization method], [Point-to-point routing is a degenerate case that does not demonstrate the benefit of DP],
)

BFS produces the fewest-hop route but does not attain the minimum weighted cost. DFS yields the longest route and the highest cost, illustrating that traversal order can produce poor solutions when the objective function is not used to guide search. UCS and A\* attain the minimum weighted cost in all three cases, but A\* requires substantially fewer expansions because of heuristic guidance.

Nearest Neighbor and Held-Karp produce the same route quality as A\* in Group 1, but this should not be interpreted as evidence regarding their multi-location optimization capability. With only one destination, there is no substantive visit-order optimization problem.

=== Search Effort and Memory

#table(
  columns: 6,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Expanded Min → Balanced → Max], [Generated Min → Balanced → Max], [Reopened Min → Balanced → Max], [Peak Frontier Min → Balanced → Max], [Interpretation],
  [BFS], [122 → 122 → 122], [163 → 163 → 163], [0 → 0 → 0], [44 → 44 → 44], [Queue order does not depend on weighted edge cost, so the search structure is unchanged],
  [DFS], [448 → 448 → 448], [570 → 570 → 570], [0 → 0 → 0], [124 → 124 → 124], [LIFO traversal is independent of weighted cost],
  [UCS], [623 → 630 → 640], [650 → 665 → 670], [2 → 1 → 3], [87 → 87 → 82], [Changing edge cost modifies priority ordering and slightly changes search effort],
  [A\*], [102 → 131 → 213], [132 → 170 → 262], [0 → 0 → 0], [34 → 41 → 58], [Heuristic guidance is effective, but effort remains sensitive to the cost landscape],
  [Nearest Neighbor], [106 → 134 → 219], [140 → 175 → 274], [0 → 0 → 0], [35 → 43 → 58], [With one goal, multi-goal A\* behaves similarly to ordinary A\*],
  [Held-Karp DP], [102 → 131 → 213], [132 → 170 → 262], [0 → 0 → 0], [34 → 41 → 58], [Reflects only the selected A\* leg and does not represent general Pairwise + DP effort],
)

BFS and DFS exhibit identical search effort across all three cases because their frontiers are not ordered according to weighted edge cost. UCS, A\*, and the multi-goal A\* used by NN, in contrast, use cost-based priorities, so changing $w_c$ can alter their expansion sequence.

A\* expands fewer states than UCS in every case: 102 versus 623 under Congestion Min, 131 versus 630 under Balanced, and 213 versus 640 under Congestion Max. This demonstrates the benefit of an informative heuristic in focusing the search toward the goal.

Held-Karp metrics in Group 1 should not be interpreted as representative of its multi-location computational effort. With only one destination, the final route contains only one A\* leg, and the costs of constructing a full pairwise matrix and performing nontrivial DP become relevant only when multiple locations are present.

=== Processing Time

#table(
  columns: 4,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Runtime Min → Balanced → Max], [Planning Min → Balanced → Max], [Interpretation],
  [BFS], [2.0 → 1.8 → 1.9 ms], [4.2 → 3.9 → 4.3 ms], [Search effort is unchanged; small differences are treated as measurement variation],
  [DFS], [8.4 → 8.6 → 8.3 ms], [10.8 → 11.4 → 10.8 ms], [Search effort is unchanged; time fluctuates slightly around the same level],
  [UCS], [14.5 → 15.4 → 16.7 ms], [15.8 → 16.8 → 18.0 ms], [Processing time increases consistently with search effort],
  [A\*], [2.7 → 3.2 → 6.1 ms], [4.1 → 4.2 → 7.2 ms], [The largest increase occurs under Congestion Max],
  [Nearest Neighbor], [3.3 → 3.2 → 12.3 ms], [6.4 → 5.6 → 15.8 ms], [Large increase under Congestion Max due to greater search effort and NN planner overhead],
  [Held-Karp DP], [2.7 → 4.0 → 5.9 ms], [5.5 → 7.9 → 10.3 ms], [Planning exceeds A\* because the visit-order pipeline adds overhead],
)

Absolute speed rankings should not be inferred from these timing values because each cell represents only one execution. `Runtime` is the appropriate like-for-like metric for direct algorithm ranking because it uses a consistent measurement scope. `Planning` remains useful for exposing end-to-end planner overhead, but it should be interpreted with care because the amount of preprocessing and ordering work differs across planners. For example, A\* and Held-Karp return the same route quality in Group 1, while Held-Karp reports higher Planning time in all three cases because its pipeline includes additional visit-order-related processing.

== Congestion Sensitivity

The effect of congestion weighting is most clearly observed by comparing the same algorithm across:

$
w_c: 0 arrow.r 0.8 arrow.r 3.0
$

For BFS and DFS, Distance, Time, Hops, and search effort remain unchanged in the current dataset; only Cost changes because the already-selected route is reevaluated under the new objective. This is consistent with the fact that BFS and DFS do not use weighted edge costs to order their frontiers.

The sensitivity measurements are summarized in the order Congestion Min → Balanced → Congestion Max:

#table(
  columns: 6,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Cost], [Expanded], [Generated], [Peak Frontier], [Planning],
  [BFS], [4.6 → 7.3 → 15.0], [122 → 122 → 122], [163 → 163 → 163], [44 → 44 → 44], [4.2 → 3.9 → 4.3 ms],
  [DFS], [41.9 → 69.9 → 146.8], [448 → 448 → 448], [570 → 570 → 570], [124 → 124 → 124], [10.8 → 11.4 → 10.8 ms],
  [UCS], [4.4 → 7.2 → 14.8], [623 → 630 → 640], [650 → 665 → 670], [87 → 87 → 82], [15.8 → 16.8 → 18.0 ms],
  [A\*], [4.4 → 7.2 → 14.8], [102 → 131 → 213], [132 → 170 → 262], [34 → 41 → 58], [4.1 → 4.2 → 7.2 ms],
  [Nearest Neighbor], [4.4 → 7.2 → 14.8], [106 → 134 → 219], [140 → 175 → 274], [35 → 43 → 58], [6.4 → 5.6 → 15.8 ms],
  [Held-Karp DP], [4.4 → 7.2 → 14.8], [102 → 131 → 213], [132 → 170 → 262], [34 → 41 → 58], [5.5 → 7.9 → 10.3 ms],
)

For UCS, Cost increases from 4.4 to 7.2 and then 14.8, while Expanded rises modestly from 623 to 630 and then 640. The modified objective changes priority ordering by $g(n)$, although final route metrics remain unchanged. Peak Frontier is not monotonic, so it would be incorrect to infer that a larger congestion weight necessarily increases every memory-related quantity.

A\* continues to return a 1.15 km route requiring 6 minutes and 13 hops in all three cases, but Expanded increases from 102 to 131 and then 213. Because $f(n)=g(n)+h(n)$, changing edge costs modifies $g(n)$ and therefore frontier priorities, requiring more states to be considered before the minimum-cost route is certified.

Nearest Neighbor follows a similar pattern to A\* in this one-goal case, but under Congestion Max it reaches 219 Expanded, 274 Generated, and 15.8 ms Planning, exceeding A\*. Held-Karp shows the same selected-leg search effort as A\*, while Planning increases from 5.5 to 10.3 ms because of visit-order pipeline overhead. These values do not yet represent the full cost of pairwise A\* and DP in a genuine multi-destination problem.

The principal experimental finding is that an unchanged final route does not imply unchanged search behavior. In the current dataset, each algorithm retains the same Distance, Time, and Hops across the three configurations, while Cost, Expanded, Generated, Peak Frontier, and Planning may change with congestion weighting. Small timing fluctuations for BFS and DFS are treated as measurement noise because their search effort is exactly unchanged.

== Conclusion

The point-to-point results indicate that each algorithm is appropriate for a different purpose:

#table(
  columns: 3,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Algorithm], [Primary observation], [Appropriate role],
  [BFS], [Few hops but no weighted-cost optimality], [Hop-count baseline],
  [DFS], [Low route quality and strong adjacency-order dependence], [Traversal baseline],
  [UCS], [Weighted-cost optimal but expands many states], [Heuristic-free cost-optimal search],
  [A\*], [Weighted-cost optimal with lower search effort than UCS in the test data], [Point-to-point cost-optimal routing],
  [Nearest Neighbor], [The one-goal case does not exercise greedy visit ordering], [Requires evaluation in multi-location settings],
  [Held-Karp DP], [The one-goal case does not exercise DP visit-order optimization], [Requires evaluation in multi-location settings],
)

Two main conclusions follow from Group 1. First, BFS and DFS do not react to congestion weighting at the search-order level because their frontier policies are independent of weighted edge cost, whereas UCS and A\* change their search behavior as $w_c$ changes. Second, A\* and UCS are the most appropriate algorithms for evaluating point-to-point cost-optimal routing, while Nearest Neighbor and Held-Karp should primarily be assessed in multi-location problems where visit order materially affects total trip cost.

#pagebreak()
= Multi-location Optimization

== Problem Description

The multi-location routing problem requires a vehicle to depart from a specified location, visit multiple intermediate locations, and complete the trip with minimum total modeled cost.

Unlike point-to-point routing, in which the principal task is to identify an optimal path between one start and one goal, multi-location routing must address two coupled subproblems:

1. Find low-cost routes between relevant locations.
2. Determine a visit order that minimizes the total cost of the complete trip.

Within Route Lab, the cost of an edge is:

$
"Cost"(e)= w_d dot "Distance"(e)+w_t dot "Time"(e) \
+w_c dot "Congestion"(e) dot "Distance"(e) \
+w_r dot "Risk"(e) dot "VehicleRiskFactor" dot "Distance"(e)
$

The objective is therefore not merely to minimize geometric distance, but to minimize the aggregate cost defined by the selected objective function.

Three approaches are compared:

- Original Order + A\*;
- Nearest Neighbor;
- Held-Karp Dynamic Programming.

Two trip formulations are evaluated: Open Tour and Closed Tour.

=== Open Tour

An Open Tour begins at a fixed start location, visits all intermediate locations, and terminates at a fixed goal:

$
"Start" arrow.r "Stop"_1 arrow.r ... arrow.r "Stop"_n arrow.r "Goal"
$

The vehicle is not required to return to the start location.

=== Closed Tour

A Closed Tour begins at a fixed start, visits all required locations, and finally returns to the start:

$
"Start" arrow.r "Stop"_1 arrow.r ... arrow.r "Stop"_n arrow.r "Start"
$

This formulation corresponds to a closed Traveling Salesman Problem (TSP) over the selected locations, with pairwise costs induced by the underlying road network and traffic objective.

== Methods Compared

#table(
  columns: 3,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Principle], [Guarantee],
  [Original Order + A\*], [Preserves the user-specified visit order and uses A\* to optimize each individual leg], [No trip-level optimality guarantee],
  [Nearest Neighbor], [At each step, selects the best currently unvisited location], [Approximate],
  [Held-Karp DP], [Constructs a pairwise cost matrix using A\* and applies dynamic programming to optimize visit order], [Optimal],
)

=== Original Order + A\*

Original Order + A\* is used as the baseline.

The location order entered by the user is preserved. A\* is used only to determine the minimum-cost route between each consecutive pair of locations.

For example, with the order:

$
A arrow.r B arrow.r C arrow.r D
$

the system executes:

$
"A*"(A,B), quad "A*"(B,C), quad "A*"(C,D)
$

A\* can optimize each individual leg but does not change the order $B,C,D$.

Therefore:

$
"Optimal individual legs"
arrow.r.double.not
"Optimal complete tour"
$

This baseline does not guarantee that the total trip cost is minimal.

=== Nearest Neighbor

Nearest Neighbor is a greedy visit-order method.

At each step, it chooses the best unvisited location from the current position:

$
"next"="argmin"_(g in "Unvisited") "Cost"("current",g)
$

Here, $"Cost"("current",g)$ is the shortest-path cost on the road graph according to the same distance, time, congestion, and risk objective used throughout the system.

In the current implementation, NN performs *one multi-goal A\** search from `current` to the complete set `Unvisited`. The search directly returns the destination with the smallest route cost, and the winning leg is retained for route assembly. This avoids running a separate A\* for every candidate, avoids recomputing the winning leg, and avoids creating independent frontier traces for candidates that are ultimately rejected.

The NN-specific multi-goal heuristic is:

$
h(n,R)=alpha min_(v in R)d_("Haversine")(n,v)
$

with:

$
alpha =min_(e "traversable", d_s(e)>0)
("Cost"(e))/(d_s(e))
$

where $d_s(e)$ is the Haversine distance between the endpoints of edge $e$. The coefficient $alpha$ ensures that $h(n,R)$ does not exceed the remaining cost to the cheapest goal in $R$, making the heuristic admissible for multi-goal search under the stated assumptions. If no safe geometric lower bound can be constructed, $alpha =0$ and the search reduces to cost-only search.

The procedure is:

```text
Current Location
      ↓
Multi-goal A*
      ↓
Choose Next Location
      ↓
Remove From Unvisited
      ↓
Repeat
      ↓
Route Assembly
```

After selecting a destination, the planner removes it from `Unvisited`, updates `current`, and passes the final edge of the selected leg into the next iteration as the new `incoming` context. This preserves turn-restriction semantics across boundaries between consecutive trip locations.

- For an *Open Tour*, intermediate stops participate in greedy selection, while the dropoff is retained as a mandatory final leg.
- For a *Closed Tour*, the dropoff participates in the candidate set as an ordinary destination; after all required locations have been visited, the planner must return to the start.

Let $m$ denote the number of locations participating in greedy selection. NN performs $m$ multi-goal searches and at most one additional tail search. Each search is complete on a finite graph with non-negative edge costs, but the greedy tour itself may become trapped on a directed graph even when a different ordering would still be feasible.

Nearest Neighbor scales comparatively well as the number of destinations grows. However, because it optimizes only the current decision, it does not enumerate all possible orders, does not backtrack, and does not guarantee a global optimum.

Its result is therefore classified as `Approximate`.

=== Held-Karp Dynamic Programming

Held-Karp is an exact optimization method used to determine the visit order with minimum total modeled cost.

First, A\* computes the route cost between location pairs:

$
C(i,j)="Cost"("A*"(i,j))
$

These values form the Pairwise Cost Matrix. Held-Karp then applies dynamic programming to this matrix to determine the optimal visit order.

The overall pipeline is:

```text
Locations
    ↓
Pairwise A*
    ↓
Pairwise Cost Matrix
    ↓
Held-Karp DP
    ↓
Optimal Visit Order
    ↓
Route Reconstruction
```

The time complexity of the dynamic-programming stage is:

$
O(n^2 2^n)
$

and its memory complexity is:

$
O(n 2^n)
$

Held-Karp therefore provides an optimality guarantee at the cost of limited scalability as the number of locations increases.

== Experimental Setup

The experiment uses a trip containing 13 locations:

- 1 start location;
- 11 intermediate locations;
- 1 final location.

The experimental configuration is:

#table(
  columns: 2,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Attribute], [Value],
  [Start location], [Independence Palace],
  [Final location], [Saigon Zoo and Botanical Gardens],
  [Number of intermediate stops], [11],
  [Total number of locations], [13],
  [Vehicle], [Car],
  [Period], [Peak],
  [Road detail], [Medium],
  [Graph nodes], [2293],
  [Graph edges], [3637],
  [Distance weight], [1.00],
  [Time weight], [0.50],
  [Congestion weight], [0.80],
  [Risk weight], [1.50],
)

These conditions are held constant across methods so that differences in the results primarily reflect how each method handles visit ordering.

The original user-entered order is:

$
"Independence Palace"
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Russian Market" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Takashimaya" \
 arrow.r "Saigon Garden" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Zoo and Botanical Gardens"
$

The system records two timing measures:

- `Runtime`: time spent within the leg-search calls;
- `Planning`: wall-clock time for the complete backend planning process.

Because the three methods perform substantially different amounts of preprocessing and ordering work, `Planning` is used in this section as the principal indicator of end-to-end planning latency. It is not interpreted as a pure search-kernel benchmark; rather, it captures the computational cost experienced by the complete planning pipeline.

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  report-figure(
    "part 8/trip_open.png",
    [Trip and locations used in the multi-location experiment.],
    width: 72%,
  ),
  report-figure(
    "part 8/conditions.png",
    [Traffic conditions, vehicle type, and weight configuration.],
    width: 72%,
  ),
)
== Group 2: Open Tour

In the Open Tour experiment, the trip begins at Independence Palace, visits 11 intermediate locations, and terminates at the Saigon Zoo and Botanical Gardens.

The same graph and operating conditions are used for all three methods:

- Original Order + A\*;
- Nearest Neighbor;
- Held-Karp DP.

=== Experimental Results

#table(
  columns: 7,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Cost], [Distance], [Time], [Runtime], [Planning], [Verdict],
  [Original Order + A\*], [182.5], [28.17 km], [120 min], [61.0 ms], [100.9 ms], [Approximate],
  [Nearest Neighbor], [109.2], [17.18 km], [69 min], [30.6 ms], [38.3 ms], [Approximate],
  [Held-Karp DP], [98.4], [15.66 km], [62 min], [21.3 ms], [1145.2 ms], [Optimal],
)

The search-effort metrics observed during the same runs are:

#table(
  columns: 6,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Hops], [Expanded], [Generated], [Reopened], [Peak Frontier],
  [Original Order + A\*], [274], [3154], [3581], [190], [54],
  [Nearest Neighbor], [170], [1603], [1854], [103], [54],
  [Held-Karp DP], [139], [1109], [1292], [74], [34],
)

#report-figure(
  "part 8/open_comparison.png",
  [Comparison of Original Order + A\*, Nearest Neighbor, and Held-Karp DP for the Open Tour problem.],
  width: 100%,
) <fig:open-comparison>

#block(inset: 8pt, fill: luma(245), radius: 3pt)[Note: `Runtime` measures time spent inside the recorded leg-search calls, whereas `Planning` measures the complete planning pipeline. Accordingly, `Planning` is used as the primary end-to-end processing-time indicator in this comparison.]

=== Original Order + A\*

Original Order + A\* preserves the initial location sequence:

$
"Independence Palace"
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Russian Market" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Takashimaya" \
 arrow.r "Saigon Garden" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Zoo and Botanical Gardens"
$

The result is:

$
"Cost"=182.5
$

$
"Distance"=28.17" km"
$

$
"Time"=120" min"
$

$
"Runtime"=61.0" ms"
$

$
"Planning"=100.9" ms"
$

The route contains 274 hops, expands 3154 states, generates 3581 states, reopens 190 states, and reaches a Peak Frontier of 54.

Although A\* optimizes each individual route leg, the visit order remains unchanged. Consequently, this method produces the largest cost, distance, and estimated travel time among the three tested methods.

The result demonstrates that optimizing each leg independently is insufficient to optimize the complete trip. Because no visit-order optimization is performed, the overall tour is classified as `Approximate`.

=== Nearest Neighbor

Nearest Neighbor changes the visit order to:

$
"Independence Palace"
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Garden" \
 arrow.r "Takashimaya" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Russian Market" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Saigon Zoo and Botanical Gardens"
$

The result is:

$
"Cost"=109.2
$

$
"Distance"=17.18" km"
$

$
"Time"=69" min"
$

$
"Runtime"=30.6" ms"
$

$
"Planning"=38.3" ms"
$

For this Open Tour, NN executes one multi-goal A\* search at each iteration over the remaining intermediate stops and then performs a tail search to the Saigon Zoo and Botanical Gardens. The winning leg from each iteration is reused directly in the final route; the implementation does not execute separate A\* searches for every candidate and then discard the traces of unsuccessful candidates. `Runtime` is the sum of the multi-goal and tail-search times, whereas `Planning` additionally includes greedy state updates and route assembly.

The metrics, namely 170 hops, 1603 Expanded, 1854 Generated, 103 Reopened, and a Peak Frontier of 54, describe the multi-goal searches that actually contribute to the planned trip. `Reopened` counts cases in which a previously generated state is later discovered with a lower cost and reinserted into the frontier; it does not necessarily imply that the state had already been expanded.

Relative to Original Order + A\*, the reduction in cost is:

$
182.5-109.2=73.3
$

The percentage improvement is:

$
"Improvement"_("NN")
=(182.5-109.2)/(182.5) times 100%
approx 40.2%
$

Distance decreases by:

$
28.17-17.18=10.99" km"
$

Estimated travel time decreases by:

$
120-69=51" min"
$

Planning time decreases relative to the baseline by:

$
(100.9-38.3)/(100.9) times 100%
approx 62.0%
$

Nearest Neighbor also reduces the route from 274 to 170 hops and reduces Expanded from 3154 to 1603 across the leg searches that form the selected route.

Thus, Nearest Neighbor substantially improves route quality over the original order and has the lowest Planning time among the three methods. Nevertheless, it remains classified as `Approximate` because greedy decisions do not guarantee a global optimum.

=== Held-Karp DP

Held-Karp selects the following visit order:

$
"Independence Palace"
 arrow.r "Takashimaya" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Russian Market" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Garden" \
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Saigon Zoo and Botanical Gardens"
$

The result is:

$
"Cost"=98.4
$

$
"Distance"=15.66" km"
$

$
"Time"=62" min"
$

$
"Runtime"=21.3" ms"
$

$
"Planning"=1145.2" ms"
$

Relative to Original Order + A\*, the cost reduction is:

$
182.5-98.4=84.1
$

The percentage improvement is:

$
"Improvement"_("HK")
=(182.5-98.4)/(182.5) times 100%
approx 46.1%
$

Distance decreases by:

$
28.17-15.66=12.51" km"
$

Estimated travel time decreases by:

$
120-62=58" min"
$

Held-Karp produces the lowest cost, shortest distance, and lowest estimated travel time among the three methods. The result is classified as `Optimal` because Held-Karp evaluates the subset states required to identify the visit order with minimum total modeled cost.

Although the `Runtime` of the selected route legs is only 21.3 ms, total `Planning` reaches 1145.2 ms because the method must additionally construct the Pairwise Cost Matrix, execute bitmask Dynamic Programming, backtrack the visit order, and assemble the final route.

#report-figure(
  "part 8/open_visit_order.png",
  [Differences in visit order among Original Order + A\*, Nearest Neighbor, and Held-Karp DP.],
  width: 72%,
) <fig:open-visit-order>

#report-figure(
  "part 8/open_held_karp_map.png",
  [Open Tour optimized using Held-Karp DP.],
  width: 100%,
) <fig:open-held-karp-map>

=== Trade-off Between Route Quality and Processing Time

The results reveal a clear trade-off between route quality and computational cost.

Nearest Neighbor has a Planning time of:

$
38.3" ms"
$

whereas Held-Karp requires:

$
1145.2" ms"
$

The ratio is:

$
(1145.2)/(38.3) approx 29.9
$

Thus, in this run, Held-Karp's end-to-end Planning time is approximately 29.9 times that of Nearest Neighbor.

In exchange, Held-Karp reduces cost relative to Nearest Neighbor by:

$
109.2-98.4=10.8
$

which corresponds to approximately:

$
(109.2-98.4)/(109.2) times 100% approx 9.9%
$

Distance decreases by:

$
17.18-15.66=1.52" km"
$

and estimated travel time decreases by:

$
69-62=7" min"
$

A notable result is that Held-Karp's `Runtime` (21.3 ms) is lower than Nearest Neighbor's (30.6 ms), while its `Planning` time is substantially higher. This is not contradictory because the two metrics cover different scopes: `Runtime` includes only the recorded selected-leg searches, whereas Held-Karp's `Planning` additionally includes pairwise A\* computation and the complete DP stage.

The `Expanded`, `Generated`, `Reopened`, and `Peak Frontier` values reported for Held-Karp describe only the searches associated with legs in the final route; they do not represent all pairwise A\* work or the DP state-space computation. It would therefore be incorrect to infer from `Expanded=1109` alone that Held-Karp performs less total computational work than NN or A\*.

The trade-off can be summarized as follows:

#table(
  columns: 4,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Route Quality], [Planning Time], [Optimality],
  [Original Order + A\*], [Poorest among the tested methods], [100.9 ms], [Approximate at the trip level],
  [Nearest Neighbor], [Good], [38.3 ms], [Approximate],
  [Held-Karp DP], [Best], [1145.2 ms], [Optimal],
)

Nearest Neighbor is appropriate when rapid route generation is important and a near-optimal solution is acceptable. Held-Karp is appropriate when the number of destinations remains within the computational limit and obtaining an exact optimum is more important than planning latency.
== Group 3: Closed Tour / TSP

In the Closed Tour experiment, the vehicle begins at Independence Palace, visits all required locations, and finally returns to Independence Palace:

$
"Independence Palace"
 arrow.r
"intermediate locations"
 arrow.r
"Independence Palace"
$

The experimental conditions are identical to those used for the Open Tour:

#table(
  columns: 2,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Attribute], [Value],
  [Start], [Independence Palace],
  [Vehicle], [Car],
  [Period], [Peak],
  [Road detail], [Medium],
  [Distance weight], [1.00],
  [Time weight], [0.50],
  [Congestion weight], [0.80],
  [Risk weight], [1.50],
)

The same three methods are compared:

- Original Order + A\*;
- Nearest Neighbor;
- Held-Karp DP.

=== Closed Tour Results

#table(
  columns: 7,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Cost], [Distance], [Time], [Runtime], [Planning], [Verdict],
  [Original Order + A\*], [194.3], [29.94 km], [128 min], [78.2 ms], [117.1 ms], [Approximate],
  [Nearest Neighbor], [119.4], [18.89 km], [76 min], [100.3 ms], [107.4 ms], [Approximate],
  [Held-Karp DP], [103.2], [16.47 km], [65 min], [19.4 ms], [1211.0 ms], [Optimal],
)

The search-effort metrics observed in the same runs are:

#table(
  columns: 6,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Hops], [Expanded], [Generated], [Reopened], [Peak Frontier],
  [Original Order + A\*], [299], [3257], [3698], [190], [54],
  [Nearest Neighbor], [172], [1722], [1999], [104], [59],
  [Held-Karp DP], [159], [1072], [1245], [59], [29],
)

#report-figure(
  "part 8/closed_comparison.png",
  [Comparison of Original Order + A\*, Nearest Neighbor, and Held-Karp DP for the Closed Tour problem.],
  width: 100%,
) <fig:closed-comparison>

#block(inset: 8pt, fill: luma(245), radius: 3pt)[Note: `Runtime` represents time spent within the recorded leg searches, while `Planning` represents the complete planning pipeline. Accordingly, `Planning` is used as the principal end-to-end processing-time indicator for the three methods.]

=== Original Order + A\*

Original Order + A\* preserves the original visit order and then returns to the start:

$
"Independence Palace"
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Russian Market" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Takashimaya" \
 arrow.r "Saigon Garden" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Zoo and Botanical Gardens" \
 arrow.r "Independence Palace"
$

The result is:

$
"Cost"=194.3
$

$
"Distance"=29.94" km"
$

$
"Time"=128" min"
$

$
"Runtime"=78.2" ms"
$

$
"Planning"=117.1" ms"
$

The method traverses 299 hops, expands 3257 states, generates 3698 states, reopens 190 states, and reaches a Peak Frontier of 54.

Although A\* optimizes each individual leg, the visit order remains fixed. Original Order + A\* therefore produces the highest cost, longest distance, and greatest estimated travel time among the three Closed Tour methods and is classified as `Approximate` at the complete-tour level.

=== Nearest Neighbor

Nearest Neighbor selects the following visit order:

$
"Independence Palace"
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Garden" \
 arrow.r "Takashimaya" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Russian Market" \
 arrow.r "Saigon Zoo and Botanical Gardens" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Independence Palace"
$

The result is:

$
"Cost"=119.4
$

$
"Distance"=18.89" km"
$

$
"Time"=76" min"
$

$
"Runtime"=100.3" ms"
$

$
"Planning"=107.4" ms"
$

In the Closed Tour formulation, the Saigon Zoo and Botanical Gardens participates in the candidate set as an ordinary destination. After NN completes its greedy ordering, the planner performs a mandatory tail search back to Independence Palace. The final edge of each selected leg is passed into the next iteration so that turn restrictions are evaluated correctly at stop boundaries.

The reported 172 hops, 1722 Expanded, 1999 Generated, 104 Reopened, and Peak Frontier 59 arise from the multi-goal searches and the final return leg that actually form the tour. `Runtime` sums the search time of those legs, while `Planning` measures the complete NN pipeline.

Relative to Original Order + A\*, the cost reduction is:

$
194.3-119.4=74.9
$

The percentage improvement is:

$
"Improvement"_("NN")
=
(194.3-119.4)/(194.3) times 100%
approx 38.5%
$

Distance decreases by:

$
29.94-18.89=11.05" km"
$

Estimated travel time decreases by:

$
128-76=52" min"
$

Nearest Neighbor reduces the route from 299 to 172 hops and reduces Expanded from 3257 to 1722. Planning time also decreases from 117.1 ms to 107.4 ms.

These results show that Nearest Neighbor substantially improves the original ordering. Nevertheless, it remains classified as `Approximate` because a greedy choice at each step does not guarantee a global optimum.

=== Held-Karp DP

Held-Karp selects the visit order:

$
"Independence Palace"
 arrow.r "Takashimaya" \
 arrow.r "Ben Thanh Market" \
 arrow.r "Ho Chi Minh City Museum of Fine Arts" \
 arrow.r "Russian Market" \
 arrow.r "Bitexco Financial Tower" \
 arrow.r "Saigon Garden" \
 arrow.r "Tan Dinh Market" \
 arrow.r "Saigon Zoo and Botanical Gardens" \
 arrow.r "Ton Duc Thang Museum" \
 arrow.r "Vincom Center Dong Khoi" \
 arrow.r "Saigon Central Post Office" \
 arrow.r "Notre-Dame Cathedral Basilica of Saigon" \
 arrow.r "Independence Palace"
$

The result is:

$
"Cost"=103.2
$

$
"Distance"=16.47" km"
$

$
"Time"=65" min"
$

$
"Runtime"=19.4" ms"
$

$
"Planning"=1211.0" ms"
$

Relative to Original Order + A\*, the cost reduction is:

$
194.3-103.2=91.1
$

The percentage improvement is:

$
"Improvement"_("HK")
=
(194.3-103.2)/(194.3) times 100%
approx 46.9%
$

Distance decreases by:

$
29.94-16.47=13.47" km"
$

Estimated travel time decreases by:

$
128-65=63" min"
$

Held-Karp produces the lowest cost, shortest distance, and lowest estimated travel time among the three methods. The final selected legs contain 159 hops, expand 1072 states, generate 1245 states, reopen 59 states, and reach a Peak Frontier of 29.

Although the `Runtime` of the selected route legs is only 19.4 ms, total `Planning` reaches 1211.0 ms because Held-Karp must additionally construct the Pairwise Cost Matrix, perform Dynamic Programming, backtrack the optimal visit order, and assemble the final route.

#report-figure(
  "part 8/closed_held_karp_map.png",
  [Closed Tour optimized using Held-Karp DP.],
  width: 100%,
) <fig:closed-held-karp-map>

=== Trade-off Between Route Quality and Processing Time

Relative to Nearest Neighbor, Held-Karp further reduces cost by:

$
119.4-103.2=16.2
$

which corresponds to:

$
(119.4-103.2)/(119.4) times 100%
approx 13.6%
$

Distance is further reduced by:

$
18.89-16.47=2.42" km"
$

and estimated travel time by:

$
76-65=11" min"
$

The computational trade-off is substantial:

$
(1211.0)/(107.4) approx 11.3
$

In this Closed Tour run, Held-Karp requires approximately 11.3 times the Planning time of Nearest Neighbor.

The trade-off can be summarized as follows:

#table(
  columns: 4,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Route Quality], [Planning Time], [Optimality],
  [Original Order + A\*], [Poorest among the tested methods], [117.1 ms], [Approximate at the trip level],
  [Nearest Neighbor], [Good], [107.4 ms], [Approximate],
  [Held-Karp DP], [Best], [1211.0 ms], [Optimal],
)

The `Expanded`, `Generated`, `Reopened`, and `Peak Frontier` values for Held-Karp describe only the selected route legs and do not include the complete workload of pairwise A\* construction and DP. `Planning` is therefore more informative for comparing end-to-end processing cost among these heterogeneous planning methods.

== Comparison Between the Original and Optimized Visit Orders

Improvement is evaluated primarily through total cost because cost is the system's explicit optimization objective:

$
"Improvement"=
("Cost"_("original")-"Cost"_("optimized"))/("Cost"_("original"))
 times 100%
$

The aggregate results are:

#table(
  columns: 4,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Scenario], [Method], [Cost], [Improvement],
  [Open Tour], [Original Order + A\*], [182.5], [-],
  [Open Tour], [Nearest Neighbor], [109.2], [40.2%],
  [Open Tour], [Held-Karp DP], [98.4], [46.1%],
  [Closed Tour], [Original Order + A\*], [194.3], [-],
  [Closed Tour], [Nearest Neighbor], [119.4], [38.5%],
  [Closed Tour], [Held-Karp DP], [103.2], [46.9%],
)

For the Open Tour, changing the visit order produces substantial improvements. Original Order + A\* has cost 182.5. Nearest Neighbor reduces this to 109.2, a decrease of 73.3 cost units or approximately 40.2% relative to the baseline. Held-Karp reduces cost further to 98.4, a decrease of 84.1 cost units or approximately 46.1%.

Relative to Nearest Neighbor, Held-Karp reduces cost by an additional 10.8, equivalent to approximately 9.9% of the NN cost. Distance is reduced by a further 1.52 km and estimated travel time by 7 minutes. This improvement is accompanied by an increase in Planning time from 38.3 ms to 1145.2 ms.

For the Closed Tour, Original Order + A\* has cost 194.3. Nearest Neighbor reduces this to 119.4, an improvement of approximately 38.5%. Held-Karp further reduces cost to 103.2, corresponding to an improvement of approximately 46.9% over the baseline. Relative to NN, Held-Karp lowers cost by an additional 16.2, or approximately 13.6%, while also saving 2.42 km and 11 minutes. Planning time, however, rises from 107.4 ms to 1211.0 ms.

The results demonstrate that optimizing each leg independently with A\* is insufficient to guarantee minimum trip-level cost:

$
"Optimal individual legs"
arrow.r.double.not
"Optimal complete tour"
$

Visit-order optimization is therefore a distinct and necessary component of the multi-location routing problem.

== Evaluation of Optimality and Scalability

The three methods provide different guarantees and exhibit different scalability characteristics.

=== Original Order + A\*

A\* can guarantee an optimal route for each individual leg when its heuristic satisfies the required optimality conditions. However, A\* does not modify the order in which destinations are visited.

Therefore:

$
"Leg Optimality"
!=
"Tour Optimality"
$

Original Order + A\* does not guarantee minimum total trip cost and is classified as `Approximate` at the full-tour level.

=== Nearest Neighbor

Nearest Neighbor uses multi-goal A\* to identify the reachable destination with the minimum route cost at each iteration. Because the underlying heuristic is admissible, the selected leg is optimal with respect to the current cost function for the destination chosen by that greedy step.

However, the greedy decision evaluates only the next destination, does not optimize the entire visit order, and does not backtrack. A locally optimal choice can make subsequent legs more expensive or even infeasible despite the existence of another feasible ordering. Thus:

$
"Optimal selected leg"
arrow.r.double.not
"Optimal complete tour"
$

NN is therefore classified as `Approximate` and is not complete as a method for finding a feasible complete tour on every directed graph. When all required location-to-location transitions are reachable, the algorithm completes after a number of greedy iterations linear in the number of candidates, with the dominant computational cost arising from the multi-goal graph searches.

In the Open Tour, NN achieves cost 109.2 with Planning time 38.3 ms. In the Closed Tour, it achieves cost 119.4 with Planning time 107.4 ms. These results show that the method can substantially improve the original order on the evaluated instances, but they do not alter its formal guarantee: the solution remains approximate.

=== Held-Karp DP

Held-Karp applies Dynamic Programming over the Pairwise Cost Matrix to evaluate the required subset states and identify the visit order with minimum total modeled cost.

Its result is therefore classified as `Optimal` within the modeled problem.

However, its time complexity:

$
O(n^2 2^n)
$

and memory complexity:

$
O(n 2^n)
$

limit scalability as the number of destinations grows.

The Open Tour results illustrate this trade-off directly:

$
"Cost"_("HK")=98.4 < "Cost"_("NN")=109.2 < "Cost"_("A*")=182.5
$

but:

$
"Planning"_("NN")=38.3" ms"
<"Planning"_("A*")=100.9" ms"
 lt.double "Planning"_("HK")=1145.2" ms"
$

Held-Karp improves cost by approximately 46.1% relative to Original Order + A\* and by approximately 9.9% relative to Nearest Neighbor, while requiring approximately 29.9 times the Planning time of NN in the Open Tour experiment.

In summary:

#table(
  columns: 6,
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Method], [Cost], [Planning], [Route Quality], [Global Optimality], [Scalability],
  [Original Order + A\*], [182.5], [100.9 ms], [Poorest among the tested methods], [Approximate at the full-tour level], [Good],
  [Nearest Neighbor], [109.2], [38.3 ms], [Good], [Approximate], [Good],
  [Held-Karp DP], [98.4], [1145.2 ms], [Best], [Optimal], [Limited for large $n$],
)

All optimality claims are understood within the scope of the graph, cost function, traffic conditions, and set of locations represented by the system.

#pagebreak()
= Program Instructions

== Installation and Setup

=== System Requirements

#table(
  columns: (4.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Requirement], [Description],
  [Runtime / tools], [Bun ≥ 1.0; the project does not use npm or yarn, and its lockfile is `bun.lock`.],
  [Browser], [A recent version of Chrome, Edge, Firefox, or Safari.],
  [Network], [An Internet connection is required to retrieve road data from Overpass, address data from Nominatim, CARTO basemap tiles, and web fonts.],
  [Python / backend], [`uv + Python` is required only when the backend is enabled, particularly for Held-Karp.],
)

#block(width: 100%, inset: 8pt, fill: luma(245))[
`curl -fsSL https://bun.sh/install | bash
# macOS / Linux - install Bun if it is not already available`
]

=== Running the Frontend Only

#block(width: 100%, inset: 8pt, fill: luma(245))[
`cd web && bun install && bun run dev
# open http://localhost:51735`
]

Five of the six algorithms (BFS, DFS, UCS, A\*, and Nearest Neighbor) can run directly in the browser through `lib/search.ts`. Held-Karp is unavailable in frontend-only mode because its implementation resides exclusively on the backend.

=== Running with the Backend Using Two Terminals

The backend is required to use Held-Karp or to populate the Generated, Reopened, Peak frontier, and Planning columns in the algorithm-comparison table, because these four metrics are measured only by the Python backend.

#block(width: 100%, inset: 8pt, fill: luma(245))[
`cd server && uv run uvicorn route_lab.api:app --reload    # Terminal 1 → :8000`

`cd web && VITE_API_URL=http://localhost:8000 bun run dev    # Terminal 2`
]

The execution mode is controlled by a single variable: `backendEnabled = !!import.meta.env.VITE_API_URL`. If it is unset, computation is performed in the browser. If it is set, every graph, including the sample graph, is sent to the backend. This design ensures that panes displayed side by side are never generated by two different computational implementations (Section 6.3.5).

If the frontend port is changed, the corresponding origin must also be declared; otherwise, the browser will block all `POST /plan` requests because of CORS restrictions:

#block(width: 100%, inset: 8pt, fill: luma(245))[
`ROUTELAB_CORS_ORIGINS="http://localhost:5180" uv run uvicorn route_lab.api:app --reload`
]

=== Additional Commands (from `web/`)

#table(
  columns: (3.4cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Command], [Function],
  [`bun run dev`], [Starts the development server with hot reload.],
  [`bun test`], [Runs the frontend test suite, which currently contains 55 passing tests across 7 files; these tests also lock the expected values for the predefined sample scenarios.],
  [`bun run build`], [Runs `tsc -b` and then produces the production build in `web/dist`.],
  [`bunx tsc --noEmit`], [Performs a fast type check without emitting files.],
)

== Graphical User Interface Guide

=== Four Main Interface Regions

1. The top bar contains the sidebar-collapse button (`⌘B/Ctrl+B`), the map-synchronization control for all panes, and a color legend divided into three groups according to when symbols appear: network (always visible: pickup, drop-off, uncongested roads, congested roads), while searching (frontier and expanded nodes), and result (selected route).
2. The sidebar is the single source of truth for one planning run. It contains five configuration blocks: Trip, Road network, Conditions, Criterion, and Cost weights. Changing any value invokes `clearResults()` and clears all pane results, preventing a mixed state in which some panes reflect old settings while others reflect new ones.
3. The pane grid allows each pane to execute one algorithm on the same trip. Pane headers can be dragged to reorder them, and at most six panes can be displayed (`MAX_PANES = ALGOS.length`). Each pane provides two tabs: Map, which shows the real CARTO basemap, real road names, and edges colored by congestion level; and Tree, which renders the search tree radially. The tree structure acts as a visual signature of the algorithm (see @fig:gui-tree).
4. The shared timeline uses a single slider to control every pane simultaneously. Separate playback speeds are intentionally disallowed because asynchronous playback would undermine direct visual comparison (Section 6.3.4).

=== Visual Language

The interface follows two design principles. First, the interface itself has no decorative color: the application frame uses only white, gray, and black, while every saturated color conveys data semantics. Second, machine-generated quantitative information is typeset in monospace, whereas explanatory text uses a conventional sans-serif font. Accordingly, numerical values use IBM Plex Mono and prose uses IBM Plex Sans.

#table(
  columns: (3.6cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Node state], [Visual representation],
  [Unvisited], [Small gray dot.],
  [In the frontier], [Hollow circle with a light-blue outline.],
  [Currently expanding], [Large circle with a dark-blue outline.],
  [Expanded], [Solid blue dot that progressively fades through four opacity levels, making the propagation direction visible rather than showing only the explored region.],
)

Roads are colored by congestion level on a green-to-red scale from 1 to 5. Once a route is selected, it is rendered as a thick amber path with a dark outline, while the congestion layer fades to one-quarter opacity so that the route becomes the only fully saturated element. Pickup, intermediate stop, and drop-off points are distinguished by shape (circle, diamond, and square) rather than by introducing additional colors. For networks with more than 600 nodes, node markers are reduced in size and the final route no longer marks every individual intersection.

=== Selecting Locations and Building the Road Network

- Entering an arbitrary place name queries Nominatim with results restricted to Vietnam. The query is issued 350 ms after typing stops, and any earlier request is canceled when a new query is started. Recently selected locations are cached for convenience.
- Build network queries Overpass for all roads within the corridor connecting the selected points, simplifies the graph to relevant intersections, and retains the largest strongly connected component.
- During anchoring, each selected place is snapped to the nearest intersection from which the currently selected vehicle can legally depart. The interface explicitly displays the snapping distance in meters, clarifying that the routing algorithm operates between graph intersections rather than directly from door to door.

#table(
  columns: (3.6cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Detail level], [Loaded road classes],
  [Main roads], [motorway, trunk, primary],
  [Medium roads], [secondary],
  [Minor roads], [tertiary, residential],
  [With alleys], [alleys (`service = alley`)],
)

If the network exceeds 900 nodes, the interface displays a warning that animation may become lengthy and computationally slower, together with a recommendation to reduce the detail level when recording demonstrations. If no live network is available, the user can select Sample graph to load the predefined graph and its scenario set.

=== Operating Procedure

1. Select the pickup point under Trip, for example, Ben Thanh Market, and choose one of the suggested search results.
2. Select the drop-off point, for example, Hang Xanh Intersection.
3. Optionally, add intermediate locations using Add a stop. Once at least one stop exists, the Optimise visit order option becomes available.
4. Optionally, enable Round trip to construct a closed tour. When enabled, the nominal drop-off location is no longer treated as the mandatory final destination; instead, it becomes an ordinary stop that may be visited at any position in the tour.
5. Select the road-network detail level and click Build network. This is typically the slowest operation and has a hard timeout of 75 seconds. If a live network cannot be obtained, use Sample graph. Clicking the control again opens the scenario list; selecting a scenario configures the complete trip, vehicle, time period, and criterion at once.
6. Configure Conditions by choosing the time period (peak, off-peak, or night) and vehicle type (motorcycle, van, car, or truck). The interface then displays the vehicle's capability bar and a concise statement describing its principal limitation.
7. Choose an optimization criterion under Criterion, or directly adjust the four sliders under Cost weights. Moving any weight slider automatically changes the mode to Custom.
8. Add panes as required. Each new pane automatically selects an algorithm that is not already in use; the algorithm can subsequently be changed, and pane headers can be dragged to reorder the layout.
9. Click Run algorithms. The button becomes active only after a road network exists, at least one pane is present, and both endpoint locations have been successfully anchored.
10. Use the shared Timeline to replay the search process step by step. All panes remain synchronized at the same global step. If a pane finishes earlier, it displays `done at step N` and remains stationary while the other algorithms continue.
11. Switch between Map and Tree views. In Tree view, use the mouse wheel to zoom, drag to pan, and double-click to fit the search tree to the pane.
12. Review the explanation in Why this route was chosen and the three comparison tables. Export data saves the complete network and all results as JSON.
13. Use `⌘B / Ctrl+B` to collapse the sidebar. The shortcut is disabled while the cursor is inside a text input so that it cannot intercept characters intended for a location field.

Configuration changes form a deliberate edit-rerun cycle: changing any sidebar value, including even a minor adjustment to a weight slider, clears all pane results and requires the algorithms to be run again.

=== Explainability Component: “Why This Route Was Chosen”

The project requires the system to explain why a particular route was selected. `Explain.tsx` automatically generates a natural-language explanation from the quantitative results of the current run. The actual content shown in @fig:gui-explain is summarized below:

#table(
  columns: (3.5cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left),
  [Line], [Content],
  [Opening statement], [A\* produced a 12.40 km route taking 37 minutes with a total cost of 69.1, making it the lowest-cost, shortest, and fastest route among the algorithms currently being compared.],
  [Roads taken], [A-D → D-E → E-F → F-K → J-K],
  [Most congested segment], [E-F · 1.60 km · congestion 5/5 · 6.1 minutes; F-K · 2.00 km · congestion 4/5 · 6.7 minutes.],
  [Compared with alternatives], [BFS is 1.00 km longer and 7 minutes slower; DFS is 10.50 km longer and 36 minutes slower; UCS returns exactly the same route but differs by 8 expanded nodes (12 versus 20).],
  [Optimality], [A\* guarantees optimality: every alternative route on this modeled network has cost greater than or equal to the selected route.],
)

All explanatory text is regenerated immediately when the time period is changed or a cost-weight slider is adjusted; no additional action is required.

The interface also handles two cases in which an apparently confident explanation would be misleading. First, if all four weights are set to zero, every route has cost zero and therefore every feasible route is formally “optimal.” The `costIsFlat` function detects this degenerate objective, removes the optimal label from all algorithms, and explains why the guarantee is not meaningful. The application does not prevent the user from selecting this configuration; it simply refuses to present a vacuous guarantee as informative. Second, when no route can be found, the application does not display artificial zeros for distance, time, or cost. A value of zero in that situation would not represent a short route but the absence of any route. The pane therefore retains only the genuinely observed quantities, namely the number of expanded nodes and execution time.

=== Three Comparison Tables

Because the application exposes three independent dimensions of comparison, it provides exactly three corresponding tables, ordered according to the way a user constructs a trip:

#table(
  columns: (5cm, 6cm, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, center),
  [Table], [Held constant], [Varied across rows],
  [Compare algorithms], [trip, cost function], [algorithm],
  [Compare cost functions], [trip, algorithm, vehicle, time period], [weight set],
  [Compare vehicles], [trip, algorithm, time period, weights], [vehicle],
)

- The algorithm-comparison table performs no additional searches; it reads the results already held by the active panes. Re-running the algorithms would incur unnecessary requests containing the entire graph and, more importantly, could make the table inconsistent with the panes above if the user changed configuration values between executions.

- Runtime and Planning answer different performance questions. Runtime measures only route search on individual legs and is measured consistently across both computational implementations, so relative ranking is meaningful. Planning covers the complete backend pipeline, including the pairwise searches required by Held-Karp and by visit-order optimization. Because different rows therefore represent different amounts of end-to-end work, the interface deliberately does not highlight a “best” value in this column.

- The Own cost column is likewise not ranked. Each row is evaluated under its own weight set, so the values are not necessarily expressed on a directly comparable scale. For example, the Shortest criterion is effectively measured in kilometers whereas the Fastest criterion is effectively measured in minutes.

- The vehicle-comparison table must re-anchor locations separately for each vehicle type. This effect is visible in the Farthest snap column of @fig:gui-vehicles: motorcycle, van, and car are anchored 59 m away, whereas the truck must be snapped back to a point 96 m away. Ignoring re-anchoring would result in a comparison between different routing problems rather than a controlled vehicle comparison.

- The Route column assigns a group letter to each distinct route. Rows sharing the same letter follow the same road sequence, allowing the reader to identify immediately when two configurations produce an identical path.

The two lower comparison tables are evaluated lazily only when opened, with a 350 ms debounce after the final user interaction. Consequently, dragging a slider across its entire range triggers one recomputation rather than dozens of redundant runs.

=== Intermediate Stops and Held-Karp

When intermediate stops are present, Optimise visit order reorders them using a nearest-neighbor heuristic based on the actual modeled shortest-path cost between each pair of locations rather than straight-line distance. This is explicitly presented as an approximate solution. Held-Karp behaves differently: it always computes the minimum-cost visit order regardless of the state of the optimization checkbox and is the only implemented multi-location method that can formally certify that no cheaper tour exists within the modeled problem. Because its complexity is $O(n^2 2^n)$, it is limited to 12 intermediate stops (`MAX_HELD_KARP_STOPS`) and runs only on the Python backend. All constraints are validated again by the backend, so frontend warnings are advisory rather than the sole enforcement mechanism; the Run button remains available and other panes can continue to execute normally.

== Input and Output Examples

=== Example 1: Comparing Four Algorithms on a Point-to-Point Trip

Input (Cross-town haul scenario): the sample graph, from A: Ben Thanh Market to J: Thu Duc Market; vehicle: motorcycle; time period: peak; criterion: Balanced (`1.00 · 0.50 · 0.80 · 1.50`); Python backend enabled.

The output is taken directly from the Compare algorithms table (@fig:gui-algorithms):

#table(
  columns: (1.6cm, 1.2cm, 1.5cm, 1.2cm, 1.2cm, 1.6cm, 1.6cm, 1.6cm, 1.6cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (center, center, center, center, center, center, center, center, center),
  [Algorithm], [Cost], [Distance], [Time], [Hops], [Expanded], [Generated], [Reopened], [Peak frontier],
  [A\*], [69.1], [12.40 km], [37 min], [5], [12], [19], [3], [7],
  [UCS], [69.1], [12.40 km], [37 min], [5], [20], [21], [2], [8],
  [BFS], [78.9], [13.40 km], [44 min], [5], [20], [19], [0], [9],
  [DFS], [133.3], [22.90 km], [73 min], [5], [9], [14], [0], [7],
)

UCS and A\* return exactly the same route because both are optimal under the same cost function. The principal difference is computational effort: A\* expands 12 nodes, whereas UCS expands 20. In this example, the Haversine heuristic therefore reduces the number of expanded nodes by 40% while preserving the optimality guarantee.

BFS performs worse because it optimizes the wrong quantity for this objective. Its route also contains five hops, exactly like the A\* route, yet it is 1.00 km longer and 7 minutes slower. Thus, minimizing the number of edges is not equivalent to minimizing modeled route cost.

DFS expands the fewest nodes (9) but returns the poorest route: 22.90 km, almost twice the distance of the optimal solution. This distinction is important because a smaller expansion count is meaningful only when comparing algorithms that provide solutions of comparable quality. A\* expanding 12 nodes versus UCS expanding 20 represents a genuine efficiency gain because both return an optimal route. By contrast, comparing A\*'s 12 expansions with DFS's 9 does not establish that DFS is more efficient for the routing objective; DFS terminates earlier because it commits to a depth-first path without an optimality requirement.

=== Example 2: Same Endpoints under Different Time Periods

Input: A: Ben Thanh Market → T: Crescent Mall, car, sample graph, evaluated under Rush hour and Same trip at night scenarios.

#table(
  columns: (3.2cm, 1fr, 2.3cm, 2.3cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, left, center, center),
  [Time period], [Route], [Distance], [Time],
  [Peak 17:30], [Detour via Chu Y Bridge], [7.2 km], [23 min],
  [Night 22:00], [Direct route via Bach Dang Wharf], [6.6 km], [13 min],
)

With identical endpoints and the same vehicle, the travel-time difference is ten minutes and the selected route changes completely. During peak conditions, the system accepts an additional 600 m of travel to avoid severe congestion; at night, once congestion decreases, the more direct route becomes preferable.

=== Example 3: Multiple Stops and a Closed Tour

Input: A → J, visiting C: Independence Palace, M: Tan Son Nhat International Airport, and Q: Binh Tay Market; motorcycle; peak period (Three-stop run scenario).

#table(
  columns: (1fr, 4cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center),
  [Configuration], [Total distance],
  [Optimise visit order enabled], [30.8 km],
  [Disabled, which preserves the user-entered order], [37.9 km],
)

The 7.1 km difference (approximately 19%) is obtained solely by reordering the visit sequence; the set of locations is unchanged. Nearest Neighbor does not depend on this checkbox because determining a greedy visit order is itself the algorithm's primary function.

Enabling Round trip changes the problem formulation. Thu Duc Market is no longer a mandatory final destination and instead becomes an ordinary stop that may, for example, be visited third rather than last. The greedy panes produce a 43.2 km tour, whereas Held-Karp produces a 41.6 km tour and is the only implemented method that can certify that no shorter closed tour exists under the modeled costs.

=== Example 4: Vehicle Comparison on a Real OpenStreetMap Network

Input: Ben Thanh Market → Hang Xanh Intersection, Minor roads detail level, yielding 2,125 intersections and 4,425 road segments; peak period; A\* algorithm.

The output is shown in the Compare vehicles table (@fig:gui-vehicles):

#table(
  columns: (2.2cm, 2.1cm, 1.6cm, 1.2cm, 1fr, 1.4cm, 1.8cm),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: (left, center, center, center, center, center, center),
  [Vehicle], [Distance], [Time], [Cost], [Blocked edges], [Turn restrictions], [Farthest snap],
  [Motorcycle], [4.16 km], [16 min], [35.0], [-], [14], [59 m],
  [Van], [4.16 km], [19 min], [36.4], [-], [70], [59 m],
  [Car], [4.23 km], [18 min], [35.8], [-], [74], [59 m],
  [Truck], [5.76 km], [37 min], [57.5], [3496 / 4425], [119], [96 m],
)

This example provides direct evidence that vehicle-specific constraints materially affect the routing model. Peak-hour truck restrictions block 79% of the edges, increasing the truck route from approximately 4.2 km to 5.76 km and increasing travel time from 16 to 37 minutes. Notably, the motorcycle and van follow exactly the same 4.16 km route but differ by 3 minutes because their modeled speeds and congestion sensitivities differ. The number of applicable turn restrictions also varies substantially across vehicle types (14 for motorcycles versus 74 for cars).

For the car on this real network, the individual A\* run shown in @fig:gui-real-map produces a 4.2 km route in 18 minutes, expands 1,466 nodes, records 21.6 ms of runtime and 24.2 ms of planning time, applies 74 turn restrictions, and is marked OPTIMAL. Compared with the 12 expanded nodes on the sample graph, this result illustrates the substantially greater computational burden of a realistic road network.

== System Screenshots

#report-figure(
  "gui (i)/01-overview-running.png",
  [Full application during synchronized execution; A\* has finished while UCS continues.],
  width: 100%,
) <fig:gui-overview>

#report-figure(
  "gui (i)/02-empty-state.png",
  [Initial empty state with guidance and a disabled Run control.],
  width: 100%,
) <fig:gui-empty>

#report-figure(
  "gui (i)/03-real-map.png",
  [A\* result on a real OpenStreetMap road network.],
  width: 94%,
) <fig:gui-real-map>

#report-figure(
  "gui (i)/04-tree-portraits.png",
  [Search-tree signatures of A\*, UCS, BFS, and DFS.],
  width: 100%,
) <fig:gui-tree>

#report-figure(
  "gui (i)/05-explain.png",
  [The “Why this route was chosen” explainability component.],
  width: 100%,
) <fig:gui-explain>

#report-figure(
  "gui (i)/06-compare-algorithms.png",
  [Algorithm-comparison table with the final verdict and timing note.],
  width: 100%,
) <fig:gui-algorithms>

#report-figure(
  "gui (i)/07-compare-cost-functions.png",
  [Comparison of cost functions and route groups.],
  width: 100%,
) <fig:gui-cost-functions>

#report-figure(
  "gui (i)/07b-compare-vehicles.png",
  [Vehicle comparison on the real road network.],
  width: 100%,
) <fig:gui-vehicles>

#report-figure(
  "gui (i)/08-scenario-list.png",
  [Sidebar with the predefined scenario list expanded.],
  width: 46%,
) <fig:gui-scenarios>

#pagebreak()
= Limitations and Future Work

The system has achieved its objective of providing an interactive environment for comparing six search algorithms on realistic transportation graphs and multi-location routing problems. Nevertheless, Route Lab remains an experimental educational prototype. Its results are optimal only with respect to the graph, objective function, traffic conditions, and constraints represented within the system.

== Development Challenges

#table(
  columns: (4.2cm, 1fr, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Challenge], [Issue encountered], [Current system response],
  [Constructing a graph from real-world data], [OpenStreetMap data includes one-way roads, bridge ramps, multiple road classes, unnamed segments, and disconnected components. Incorrect node mapping or edge direction can create nonexistent routes or prevent the planner from finding a valid route.], [The system uses OSM node IDs, preserves road geometry, processes `oneway` information, includes relevant `*_link` road classes, and reduces the graph to its largest strongly connected component.],
  [Acquiring road-network data], [Overpass is a public service and may return HTTP 429/503/504 responses, become slow, or time out when the requested area is too large. Highly detailed networks also increase node count, edge count, and browser-memory consumption substantially.], [The queried corridor is bounded according to detail level, failed requests are retried with backoff, a 75-second cutoff is enforced, and a sample graph is provided when online retrieval is unavailable.],
  [Modeling traffic regulations], [Turn restrictions depend jointly on the incoming road segment, outgoing road segment, time period, and vehicle type. Storing only the current node is therefore insufficient for exact validation.], [The search state retains incoming-way context and evaluates `no`/`only` restrictions, their active periods, and vehicle-exemption lists.],
  [Maintaining frontend-backend consistency], [The TypeScript frontend and Python backend must use the same graph schema, cost function, rounding rules, and metric definitions. Even small inconsistencies can cause the two planners to return different results.], [A shared JSON data contract defines the common representation, Pydantic validates backend input, and contract tests are maintained on both sides.],
  [Comparing six algorithms fairly], [The algorithms address different optimization tasks: BFS/DFS are traversal-oriented, A\*/UCS solve point-to-point routing, whereas NN/Held-Karp determine visit order. Runtime and Planning also measure different scopes of computation.], [All panes use the same graph and conditions; Route Quality, Search Effort, Runtime, and Planning are reported separately; and the scope of each algorithm's optimality guarantee is stated explicitly.],
  [Multi-location optimization], [Pairwise A\* must compute costs between many location pairs; Held-Karp's dynamic-programming state space grows exponentially, and reconstructed route legs must preserve turn context.], [The implementation caches Pairwise Cost values, uses bitmask dynamic programming and parent reconstruction, and limits the number of stops to keep time and memory requirements tractable.],
  [Visualizing the search process], [An OSM graph may contain thousands of nodes, making simultaneous animation, search-tree rendering, and multiple panes computationally expensive and visually dense.], [The interface uses a shared timeline, bounds graph detail according to geographic area, warns users when graphs are large, and separates Map and Tree views.],
)

The principal development difficulty was not implementing any single search algorithm in isolation, but ensuring that every algorithm operated on the same transportation model and that the reported metrics remained meaningfully comparable. Consequently, data-contract validation, input verification, and consistency of the cost function were as important as the search algorithms themselves.

== Current System Limitations

=== Dataset Limitations

- *Dependence on OpenStreetMap.* Graph completeness and accuracy depend on community-contributed data. Road classes, `oneway` attributes, turn restrictions, and geometries may be incomplete or outdated.
- *Inconsistent road naming.* Some road segments lack a `name` field, causing route descriptions to contain `Unnamed segment`; spelling and Unicode representation may also vary. This primarily affects readability rather than route computation, provided that topology and edge weights remain correct.
- *Dependence on external services.* The Overpass API is rate-limited and subject to a 75-second cutoff; Nominatim is a public geocoding service with query-rate constraints; and map tiles require an Internet connection. A valid query can therefore fail because of service availability rather than because of the routing algorithm.
- *Congestion and risk are not real-time observations.* These attributes are deterministically simulated from road class and way ID to ensure experimental reproducibility. They do not represent actual incidents, roadworks, weather conditions, or live traffic congestion.
- *Time is discretized.* The system supports only Peak, Off-peak, and Night, with each category represented by a single reference time. It cannot distinguish different moments within the same period and does not model continuously changing traffic conditions while a vehicle is in transit.
- *The graph is corridor-bounded.* Each detail level imposes an area limit to protect the Overpass service and browser memory; With alleys permits the smallest geographic region. A valid detour lying outside the selected corridor may therefore be absent from the graph.
- *Input locations must be snapped.* Pickup, drop-off, and intermediate stops are anchored to the nearest feasible intersection. The distance between the actual address and its snapped graph node is not included in the route, so the current result is not a complete door-to-door model.
- *Reduction to the strongly connected component.* Retaining the largest strongly connected component reduces the risk of starting in a graph region from which no valid departure is possible, but it can also remove small roads or local areas that may be useful for a particular trip.

=== Cost-Function Limitations

The current objective function is a weighted sum:

$
"Cost"(e) = w_d dot "Distance"(e) + w_t dot "Time"(e) \
quad + w_c dot "Congestion"(e) dot "Distance"(e) \
quad + w_r dot "Risk"(e) dot "VehicleRiskFactor" dot "Distance"(e)
$

- The weights are designed to illustrate trade-offs and permit interactive adjustment; they have not been calibrated using behavioral data, user studies, or empirical logistics costs.
- Distance, Time, Congestion, and Risk represent quantities with different meanings and units but are scalarized into one objective value. Consequently, modeled cost should be compared only under the same weight configuration and should not be interpreted as directly comparable across different criteria.
- Travel time is inferred from road class, base speed, vehicle type, and congestion factor rather than from directly observed segment-level speeds.
- Each edge cost is treated as fixed throughout one request. The system does not yet support time-dependent edge costs and therefore cannot represent congestion changing between trip departure and arrival at a particular road segment.
- The model does not include tolls, fuel or electricity consumption, emissions, road-surface quality, slope, intersection waiting time, delivery-service time, order priority, or U-turn penalties.
- If all four weights are zero, every route has a cost of zero. The application detects this flat-objective case and avoids presenting a meaningful optimality label, but the objective itself still cannot distinguish route quality.

=== Algorithmic and Experimental Limitations

- BFS minimizes only the number of hops, while DFS is highly sensitive to adjacency ordering; neither optimizes the weighted transportation cost.
- UCS and A\* guarantee optimality only with respect to the modeled graph and cost function. A route that is optimal within the system is not necessarily the best real-world route if the data or objective function omits relevant conditions.
- A\* depends on the informativeness of its Haversine heuristic. When scaled appropriately, the heuristic remains admissible, but in networks with substantial barriers or one-way constraints, straight-line distance may be weak and A\* can approach UCS-like behavior.
- Nearest Neighbor is a greedy method. It scales well but does not guarantee a global optimum and may select an early prefix that makes the remainder of a directed tour infeasible.
- Held-Karp requires $O(n^2 2^n)$ time and $O(n 2^n)$ memory. The current implementation supports at most 12 stops in addition to Start, runs only on the backend, and also incurs the cost of constructing the Pairwise Cost Matrix through repeated A\* searches.
- Turn-restriction parsing currently supports relations whose `via` member is a node. Restrictions whose `via` member is an entire way, constraints such as `maxweight`/`maxheight`, and truck-restricted administrative zones are not yet modeled comprehensively.
- The system can compare several vehicle types, but each planning request still assumes a single vehicle. It does not allocate multiple orders among multiple vehicles or model vehicle capacity, depots, time windows, or inter-vehicle conflicts.
- Runtime and Planning values reported in this study are obtained from individual executions. They may be affected by CPU scheduling, caches, garbage collection, background processes, and service state and therefore should not be interpreted as a statistical performance benchmark.
- The search trace and final-route metrics for Held-Karp describe only the selected route legs and do not represent the complete computational work of Pairwise A\* plus dynamic programming. Planning is a more appropriate end-to-end pipeline metric, although it is not yet decomposed into Pairwise-search, DP, and route-assembly components.

== Future Development Directions

#table(
  columns: (4cm, 1fr, 1fr),
  inset: (x: 5pt, y: 4pt),
  stroke: 0.45pt + luma(120),
  align: left,
  [Extension], [Proposed implementation], [Expected value],
  [Real-time traffic data], [Integrate timestamped traffic sources, store historical segment-level speeds, and move toward time-dependent edge costs. Routes could be periodically updated or recomputed when congestion changes materially.], [Routing results would better reflect road conditions at the actual time of travel rather than relying on fixed simulated congestion.],
  [Map API integration], [Add adapters for commercial mapping/geocoding APIs or open traffic-data sources. These services can be used to validate travel-time estimates and route baselines while retaining the project's own algorithm implementations as the primary planner.], [Improved geocoding, coverage, road-name quality, and external validation against operational mapping systems.],
  [Multiple-vehicle support], [Extend single-vehicle routing to a Vehicle Routing Problem formulation with multiple depots or vehicles, capacity constraints, delivery demand, service times, time windows, and vehicle skills.], [Closer alignment with practical delivery operations by optimizing both order assignment and visit sequence.],
  [Large-scale multi-location algorithms], [Combine NN with 2-opt/3-opt, local search, or metaheuristics; use branch-and-bound or specialized solvers for medium-sized instances and bounded heuristics for larger instances.], [Overcome the 12-stop Held-Karp limit while achieving substantially better route quality than a purely greedy method.],
  [More complete traffic-rule modeling], [Support turn restrictions whose `via` member is a way, `maxweight`, `maxheight`, tolls, low-emission zones, truck zones, and schedule-dependent restrictions.], [Reduce the gap between the modeled graph and legally feasible real-world travel.],
  [Business-oriented cost models], [Incorporate fuel consumption, emissions, tolls, service time, order delay, and Pareto optimization rather than relying exclusively on a single weighted sum.], [Enable route selection under operational objectives and provide clearer explanations of trade-offs among competing goals.],
  [Data and performance optimization], [Cache graphs by geographic region, cache Pairwise Cost values, store normalized graphs on the backend, execute browser-side search in Web Workers, and transmit only the trace data required for animation.], [Reduce Overpass retrieval time, request size, memory usage, and latency when running many panes or planning many stops.],
  [More rigorous empirical evaluation], [Perform warm-up runs and repeat each configuration multiple times; report medians, percentiles, and standard deviations across multiple graphs, vehicle types, time periods, and trip lengths.], [Separate algorithmic effects from measurement noise and establish a more reproducible benchmark.],
  [Offline capability], [Package sample regions or permit previously downloaded OSM graphs to be stored locally, with geocoding and map-tile caching implemented in accordance with provider policies.], [Reduce dependence on Internet connectivity and public services during demonstrations or deployment in unstable-network environments.],
)

In the short term, the three highest-value priorities are repeated benchmark standardization, graph and Pairwise Cost caching, and the introduction of time-varying traffic data. In the longer term, the system could evolve into a multi-vehicle VRP platform with time windows and dynamic traffic conditions. At that stage, Route Lab would move beyond comparing search algorithms and provide a stronger foundation for operational delivery-routing decisions under realistic constraints.
