/** A place the user picked — not yet snapped to the road network. */
export interface Place {
  name: string
  detail?: string
  lat: number
  lng: number
}

/** An intersection in the road network built from OpenStreetMap data. */
export interface GraphNode {
  id: string
  lat: number
  lng: number
  /** Short letter used to name the node when explaining. Only the sample graph has this. */
  label?: string
  /** Place name. Only the sample graph has this; nodes from OpenStreetMap have no name. */
  name?: string
}

/** A road segment connecting two intersections, with the road's real shape. */
export interface GraphEdge {
  from: string
  to: string
  km: number
  /** Road class per OpenStreetMap: motorway, primary, residential… */
  roadClass: RoadClass
  /** Congestion level 1-5, simulated from road class (see lib/traffic.ts). */
  congestion: number
  /** Risk factor 0-1: narrow road, hard intersection, flooding. */
  risk: number
  /** Street name from OpenStreetMap, used to name the congested segment when explaining. */
  name?: string
  /** Coordinates along the real road, so it draws in the road's true shape. */
  shape: [number, number][]
  /** OpenStreetMap way id. Turn restrictions are recorded as pairs of ways, so
   *  without this id there is nothing to match against. The sample graph has none. */
  wayId?: number
}

/**
 * A turn restriction at one intersection.
 *
 * A "no left turn" sign in Vietnam is rarely in force all day and rarely
 * bans every vehicle. Measured on OpenStreetMap data for central HCMC: of
 * 757 turn-restriction relations, 491 use `restriction:conditional` —
 * restricted by time period — and 459 carry
 * `except=motorcycle;bicycle;mofa;moped`, meaning motorbikes are exempt.
 *
 * Those are exactly the two axes the app already has: time period and vehicle.
 */
export interface TurnRule {
  /** no_left_turn, no_u_turn, only_straight_on… The two prefixes are the whole
   *  distinction the lookup table is built around, so they are in the type. */
  kind: `no_${string}` | `only_${string}`
  /** Time period this applies to, in minutes since midnight. Empty means restricted all day. */
  hours: [number, number][]
  /** Vehicle types exempted, per OpenStreetMap keyword. */
  except: string[]
  /** For an `only_*` rule: the single way id allowed to continue onto. */
  onlyTo?: number
}

/**
 * Turn-restriction lookup table.
 * `no`   keyed by `${node}|${from way}|${to way}` — the banned pair.
 * `only` keyed by `${node}|${from way}`            — only one direction allowed.
 */
export interface TurnTable {
  no: Record<string, TurnRule[]>
  only: Record<string, TurnRule[]>
}

export type RoadClass =
  | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'alley'

export interface Graph {
  nodes: Record<string, GraphNode>
  edges: GraphEdge[]
  adj: Record<string, GraphEdge[]>
  bounds: [[number, number], [number, number]]
  /** Road class used when built, so it can be shown back to the user. */
  detail: Detail
  /** Turn restrictions from OpenStreetMap. The sample graph has none. */
  turns?: TurnTable
}

export type Detail = 'coarse' | 'medium' | 'fine' | 'alleys'
export type AlgoKey = 'bfs' | 'dfs' | 'ucs' | 'astar' | 'nearest' | 'held_karp'
export type VehicleKey = 'bike' | 'van' | 'car' | 'truck'
export type PeriodKey = 'peak' | 'offpeak' | 'night'
export type CriterionKey = 'balanced' | 'distance' | 'time' | 'avoid' | 'custom'

export interface Weights {
  distance: number
  time: number
  congestion: number
  risk: number
}

/**
 * One node-expansion step of the algorithm.
 * Nodes are stored by index rather than by string id: a single run over a
 * network of a few hundred nodes produces tens of thousands of queue
 * entries, and multiplied across a full grid of panes, storing strings would
 * waste memory for nothing. Convert back via RouteResult.nodeIds.
 */
export interface TraceStep {
  expanded: number
  frontier: number[]
  g: number
  h: number | null
  /** The node that led to this node. The set of parent-child pairs forms the
   *  search tree, and the shape of that tree is the portrait of the algorithm. */
  parent: number | null
}

export interface Metrics {
  km: number
  minutes: number
  cost: number
  expanded: number
  /** Time inside algorithm search calls, summed. NN includes one multi-goal A*
   *  per greedy step; candidate-based ordering includes every candidate call.
   *  Both planners use this same boundary, although JavaScript and Python will
   *  not take equal wall time. */
  ms: number
  optimal: boolean
  /** Number of times the algorithm had to drop a direction because of a turn restriction. */
  turnsBlocked: number
  /** Number of road segments in the chosen route (path length in hops).
   *  Optional: supplied by the Python backend, absent from the local planner. */
  hops?: number
  /** Search-effort metrics gathered by the backend harness — states pushed onto
   *  the frontier, states re-reached more cheaply, and the peak frontier size.
   *  Optional: the local TypeScript planner does not report them. */
  generated?: number
  reopened?: number
  maxFrontier?: number
  /** Wall-clock time for the backend's whole post-validation pipeline — the
   *  ordering search and its pairwise matrix as well as the legs, so it counts
   *  work the search-effort figures beside it deliberately leave out.
   *  Optional: only the Python planner publishes this wider measurement. */
  planningMs?: number
}

export interface RouteResult {
  algo: AlgoKey
  /** Reason it could not run, when the query itself is meaningless. Explicitly
   *  `null` over the wire — FastAPI serialises `str | None` as a present null,
   *  so a reader testing `problem !== undefined` would see one on every result. */
  problem?: string | null
  /** Order of the stops to visit, after optimising if the user enabled it.
   *  For Held–Karp this is the closed tour, so it opens and closes on the
   *  warehouse. Always read the visit order from here — never re-derive it from
   *  `path`, which is the road-by-road route and knows nothing about stops. */
  order: string[]
  path: string[]
  trace: TraceStep[]
  /** Lookup table from a trace node index back to the node id. */
  nodeIds: string[]
  /** Which leg finished at which step — to reveal each road segment progressively. */
  reveal: { upto: number; path: string[] }[]
  found: boolean
  metrics: Metrics
}
