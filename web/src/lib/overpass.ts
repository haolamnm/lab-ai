import { boundsOf, hash, haversine, paddedBounds, pathKm, type LatLng } from './geo'
import { clampCongestion, clampRisk } from './traffic'
import type { Detail, Graph, GraphEdge, GraphNode, RoadClass, TurnRule, TurnTable } from './types'

/** Road classes fetched for each detail level. */
const CLASSES: Record<Detail, RoadClass[]> = {
  coarse: ['motorway', 'trunk', 'primary'],
  medium: ['motorway', 'trunk', 'primary', 'secondary'],
  fine:   ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'],
  alleys: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'alley'],
}

/**
 * Secondary road classes that must be fetched alongside the main ones, then
 * folded back onto their proper main road class.
 *
 * Ramps (`*_link`) are the branches connecting flyovers and grade-separated
 * intersections. Without them there's no way up onto a major road and no way
 * down off it, and the network breaks into many fragments only reachable one
 * way. Measured on the Đức Bà – Thảo Điền area, the largest strongly
 * connected component at the "Medium roads" level jumps from 74% to 85%
 * just from adding these 199 ramp branches.
 *
 * `unclassified` and `living_street` are real streets, just tagged differently.
 */
const ALIAS: Record<string, RoadClass> = {
  motorway_link: 'motorway', trunk_link: 'trunk', primary_link: 'primary',
  secondary_link: 'secondary', tertiary_link: 'tertiary',
  unclassified: 'residential', living_street: 'residential',
}

/** Road classes actually queried from Overpass, including the secondary
 *  classes that fold onto an enabled one. Alleys are handled separately
 *  because OpenStreetMap tags them as `highway=service` + `service=alley`,
 *  which doesn't fit the same expression pattern as the other classes. */
function osmClasses(detail: Detail): string[] {
  const want = new Set<string>(CLASSES[detail].filter(c => c !== 'alley'))
  for (const [alias, main] of Object.entries(ALIAS)) if (want.has(main)) want.add(alias)
  return [...want]
}

export const DETAIL_LABEL: Record<Detail, string> = {
  coarse: 'Main roads',
  medium: 'Medium roads',
  fine:   'Minor roads',
  alleys: 'With alleys',
}

/** Baseline congestion level by road class, before adding noise. */
const BASE_JAM: Record<RoadClass, number> = {
  motorway: 2, trunk: 3, primary: 4, secondary: 4, tertiary: 3, residential: 2, alley: 1,
}
/** Baseline risk: the smaller the road, the more blind intersections, flooding, and vehicles cutting across. */
const BASE_RISK: Record<RoadClass, number> = {
  motorway: 0.10, trunk: 0.20, primary: 0.25, secondary: 0.30, tertiary: 0.40, residential: 0.55,
  // Alleys don't jam up, but sight lines are blocked, the surface is poor,
  // and people and vehicles constantly cut across.
  alley: 0.70,
}

/** One element returned by Overpass. The query asks for both ways and turn-
 *  restriction relations in a single pass, so both types come back in one array. */
interface OsmElement {
  type: 'way' | 'relation' | 'node'
  id: number
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
  /** OpenStreetMap node id, matching one-to-one with each point in `geometry`. */
  nodes?: number[]
  members?: { type: string; ref: number; role: string }[]
}
type OsmWay = OsmElement
type OsmRelation = OsmElement

const key = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`

/** "06:00-09:00,16:00-19:00" -> [[360,540],[960,1140]], in minutes since midnight. */
function parseHours(spec: string): [number, number][] {
  const out: [number, number][] = []
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
    if (!m) continue
    out.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]])
  }
  return out
}

/**
 * Reads turn-restriction relations into a lookup table.
 *
 * Only accepts relations whose `via` is a single node. The variant where
 * `via` is an entire way — used for complex multi-branch intersections —
 * makes up roughly a quarter of them and needs an entirely different model,
 * so it's skipped; better to miss a restriction than build a wrong one.
 */
function readTurns(relations: OsmRelation[]): TurnTable {
  const table: TurnTable = { no: {}, only: {} }
  for (const rel of relations) {
    const tags = rel.tags ?? {}
    const cond = tags['restriction:conditional']
    const plain = tags.restriction

    let kind = plain
    let hours: [number, number][] = []
    if (!kind && cond) {
      // "no_left_turn @ (06:00-09:00,16:00-19:00)"
      const m = cond.match(/^\s*([a-z_]+)\s*@\s*\((.+)\)\s*$/)
      if (!m) continue
      kind = m[1]
      hours = parseHours(m[2])
      if (!hours.length) continue
    }
    if (!kind || !/^(no|only)_/.test(kind)) continue

    const from = rel.members?.find(m => m.role === 'from' && m.type === 'way')
    const to = rel.members?.find(m => m.role === 'to' && m.type === 'way')
    const via = rel.members?.find(m => m.role === 'via' && m.type === 'node')
    if (!from || !to || !via) continue

    const except = (tags.except ?? '').split(';').map(s => s.trim()).filter(Boolean)
    const rule: TurnRule = { kind, hours, except }

    if (kind.startsWith('only_')) {
      const k = `n${via.ref}|${from.ref}`
      ;(table.only[k] ??= []).push({ ...rule, onlyTo: to.ref })
    } else {
      const k = `n${via.ref}|${from.ref}|${to.ref}`
      ;(table.no[k] ??= []).push(rule)
    }
  }
  return table
}

/**
 * Identifies a point on a way.
 *
 * Uses the node id assigned by OpenStreetMap, because that's the real
 * identity: two ways connect if and only if they share the same node id.
 * Rounded coordinates are only a fallback for when the server doesn't
 * return a `nodes` array.
 *
 * Measured on 16,224 points around Đức Bà – Thảo Điền: rounding coordinates
 * to five decimal places (about 1.1 m) counts exactly 3,929 intersections —
 * no more, no fewer than counting by node id — so it doesn't miss any
 * intersections. But it wrongly merges 17 pairs of nodes that are actually
 * separate, meaning it fabricates 17 connections that don't exist, usually
 * where a flyover and the road beneath it happen to share coordinates.
 * Using node ids makes that whole class of error disappear at no extra cost.
 */
const pointId = (w: OsmWay, i: number): string =>
  w.nodes?.[i] != null ? `n${w.nodes[i]}` : key(w.geometry![i].lat, w.geometry![i].lon)

export class GraphBuildError extends Error {
  constructor(
    message: string,
    /** True when the error can be self-resolved by changing the detail level. */
    readonly needsMoreDetail = false,
  ) { super(message) }
}

/** Maximum corridor area for each detail level, in km². */
// Calibrated against real measurements: a 454 km² corridor at the "add
// medium roads" level returns 732 road segments, 0.8 MB, twenty seconds —
// so the old limit was set too tight. Area is only a rough proxy since
// inner-city road density is many times denser than in the provinces; the
// real backstop is the seventy-five-second timeout.
const AREA_LIMIT: Record<Detail, number> = { coarse: 3000, medium: 700, fine: 60, alleys: 14 }

/**
 * Corridor width around the route, in km.
 *
 * Too narrow and the algorithm has no road to detour onto, and worse, the
 * network gets cut: a highway connecting two provinces rarely hugs the
 * straight line between two points — it swings outside the narrow band and
 * back in, leaving two disconnected fragments. Too wide and it downloads
 * whole areas that are irrelevant.
 *
 * So the width cap depends on the detail level. The "Main roads" level is
 * very light — seven hundred road segments for seventy kilometres — so it
 * gets a wide band to capture the full highway. High detail levels must be
 * kept tight, or the download volume explodes.
 */
const RADIUS_CAP: Record<Detail, number> = { coarse: 12, medium: 4, fine: 2.5, alleys: 1.4 }

export function corridorRadius(points: LatLng[], detail: Detail): number {
  return Math.min(RADIUS_CAP[detail], Math.max(1.2, 0.25 * routeSpan(points)))
}

function routeSpan(points: LatLng[]): number {
  let km = 0
  for (let i = 0; i + 1 < points.length; i++) km += haversine(points[i], points[i + 1])
  return km
}

/** Corridor area: a long rectangle plus two half-circles at the ends. */
function corridorArea(points: LatLng[], detail: Detail): number {
  const r = corridorRadius(points, detail)
  return 2 * r * routeSpan(points) + Math.PI * r * r
}

/**
 * Checks whether the volume to fetch is manageable, before calling Overpass.
 *
 * Fetching a wide area at a high detail level means hundreds of thousands
 * of road segments: Overpass times out, the browser runs out of memory, and
 * the user just gets a meaningless error message. Better to block it early
 * and say clearly how to fix it.
 */
export function areaProblem(points: LatLng[], detail: Detail): string | null {
  const km2 = corridorArea(points, detail)
  if (km2 <= AREA_LIMIT[detail]) return null

  // Suggest the highest detail level that still fits, not the coarsest one.
  const fits = (['alleys', 'fine', 'medium', 'coarse'] as Detail[])
    .find(d => corridorArea(points, d) <= AREA_LIMIT[d])
  const len = Math.round(routeSpan(points))
  const wide = corridorRadius(points, detail).toFixed(1)
  return fits
    ? `The route is ${len} km long, which needs a ${wide} km-wide corridor on each side — too much `
      + `for the "${DETAIL_LABEL[detail]}" level. Switch to "${DETAIL_LABEL[fits]}" to make it work.`
    : `The route is ${len} km long, beyond what even the "${DETAIL_LABEL.coarse}" level can fetch. `
      + `Pick two points closer together.`
}


/** The public Overpass server, when busy, sometimes aborts mid-query with a
 *  504 even though the query is perfectly valid — the same question fails
 *  once and succeeds in four seconds the next time. So retry a few times
 *  before giving up, so a demo recording doesn't die needlessly just
 *  because the server happened to be busy. */
const RETRY_WAITS = [0, 4_000, 9_000]

async function fetchElements(query: string, signal?: AbortSignal): Promise<OsmElement[]> {
  // The timeout covers the whole retry sequence, not each individual attempt.
  const cutoff = AbortSignal.timeout(75_000)
  const merged = signal ? AbortSignal.any([signal, cutoff]) : cutoff
  let last: GraphBuildError | null = null

  for (const wait of RETRY_WAITS) {
    if (wait) await new Promise(r => setTimeout(r, wait))
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(query), signal: merged,
        // Overpass rejects Node's default User-Agent with a 406. Browsers
        // always send a real User-Agent on their own so this isn't strictly
        // needed, but declaring it here lets tests also run outside the
        // browser — a real browser will just ignore this line.
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'vn-route-lab/0.1 (bai tap mon Nhap mon Tri tue nhan tao)',
        },
      })
      if (res.status === 504 || res.status === 429 || res.status === 503) {
        last = new GraphBuildError(
          'OpenStreetMap is overloaded. Retried a few times but it still failed — wait a minute then '
          + 'click rebuild, or lower the detail level.')
        continue
      }
      if (!res.ok) throw new GraphBuildError(`OpenStreetMap returned status ${res.status}. Wait a few minutes and try again.`)
      const data = await res.json()
      // Overpass returns 200 with a `remark` when the query died partway
      // through on the server side (out of memory, timed out). Without
      // catching that here, an empty `elements` would be misread as "this
      // area has no roads", telling the user to change the detail level
      // when all they actually need is to click again.
      if (!data.elements?.length && data.remark) {
        last = new GraphBuildError(`OpenStreetMap reported an error mid-query: ${data.remark}`)
        continue
      }
      return data.elements || []
    } catch (e) {
      if (e instanceof GraphBuildError) throw e
      const name = (e as Error).name
      if (name === 'TimeoutError')
        throw new GraphBuildError('Loading the network took longer than 75 seconds and was stopped. Lower the detail level or pick two points closer together.')
      if (name === 'AbortError') throw e
      // A flaky connection is also worth retrying.
      last = new GraphBuildError(`Could not reach OpenStreetMap: ${(e as Error).message}`)
    }
  }
  throw last ?? new GraphBuildError('Could not load the road network.')
}

/**
 * Builds a real road network from OpenStreetMap for the area surrounding
 * the points the user picked. Returns a reduced graph: only intersections
 * are kept as nodes, and the straight stretches in between are merged into
 * a single edge carrying the road's real shape.
 */
export async function buildGraph(points: LatLng[], detail: Detail, signal?: AbortSignal): Promise<Graph> {
  const tooBig = areaProblem(points, detail)
  if (tooBig) throw new GraphBuildError(tooBig)

  // Two ways to bound the area, chosen by trip length.
  //
  // An in-city trip uses a bounding box: Overpass has a built-in spatial
  // index for bounding boxes so it answers almost instantly, whereas the
  // around filter has to measure the distance to every road segment, and on
  // a busy public server that's slow enough to get cut off mid-query with a
  // 504 — even when the area is only a few km².
  //
  // An interprovincial trip is the opposite, and requires a corridor: a
  // bounding box around two provinces spans thousands of km² while the road
  // band actually needed is only a few hundred. The around filter accepts a
  // whole polyline, so a multi-stop trip only fetches the band hugging the
  // visit order.
  const filter = osmClasses(detail).join('|')
  const span = routeSpan(points)
  let area: string
  if (span < 8) {
    const b = paddedBounds(points)
    area = `(${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)})`
  } else {
    const line = points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(',')
    area = `(around:${Math.round(corridorRadius(points, detail) * 1000)},${line})`
  }
  // Also fetch turn-restriction relations touching the ways just fetched.
  // `rel(bw.roads)` filters right on the server so it costs no extra call.
  // Alleys have to be queried with a separate clause. In OpenStreetMap
  // they're `highway=service` with `service=alley`, and the filter must
  // match `alley` specifically, not all of `service` — otherwise it would
  // sweep in parking-lot entrances and driveways too, things that don't
  // connect anywhere.
  const wantAlleys = CLASSES[detail].includes('alley')
  const alleyClause = wantAlleys
    ? `way["highway"="service"]["service"="alley"]["access"!~"^(private|no)$"] ${area}->.alleys;`
    : ''

  const query = `[out:json][timeout:60];
way["highway"~"^(${filter})$"]["access"!~"^(private|no)$"]
  ${area}->.main;
${alleyClause}
(.main;${wantAlleys ? ' .alleys;' : ''})->.roads;
(
  .roads;
  rel(bw.roads)["type"="restriction"];
);
out geom;`

  const elements = await fetchElements(query, signal)
  const ways = elements.filter(e => e.type === 'way' && (e.geometry?.length ?? 0) > 1)
  const turns = readTurns(elements.filter(e => e.type === 'relation'))
  if (!ways.length)
    throw new GraphBuildError('This area has no roads at the selected detail level. Try increasing the detail level.')

  // A point shared by multiple ways is an intersection.
  const waysAtPoint = new Map<string, Set<number>>()
  for (const w of ways)
    for (let i = 0; i < w.geometry!.length; i++) {
      const k = pointId(w, i)
      if (!waysAtPoint.has(k)) waysAtPoint.set(k, new Set())
      waysAtPoint.get(k)!.add(w.id)
    }

  const nodes: Record<string, GraphNode> = {}
  const edges: GraphEdge[] = []

  for (const w of ways) {
    const tags = w.tags ?? {}
    const raw = tags.highway || 'residential'
    // An alley explicitly tagged as car-accessible is treated as an
    // ordinary residential road — measured in the central area this
    // matches only one way, but the data is respected as given.
    const cls: RoadClass = raw === 'service'
      ? (tags.motorcar === 'yes' ? 'residential' : 'alley')
      : ((ALIAS[raw] ?? raw) as RoadClass)
    const g = w.geometry!

    // One-way. Three sources: the oneway tag, roundabouts, and
    // OpenStreetMap's implicit convention that a motorway defaults to
    // one-way even when untagged. `oneway=-1` means the direction of travel
    // is reversed from the way's point order, and must be flipped, not
    // skipped. Measured around Đức Bà – Thảo Điền, the latter two cases are
    // both zero, but they're real elsewhere and handling them correctly
    // costs only one line.
    const reversed = tags.oneway === '-1' || tags.oneway === 'reverse'
    const oneway = reversed
      || ['yes', 'true', '1'].includes(tags.oneway)
      || tags.junction === 'roundabout' || tags.junction === 'circular'
      || (cls === 'motorway' && tags.oneway !== 'no')

    const isJunction = (i: number) =>
      i === 0 || i === g.length - 1 || (waysAtPoint.get(pointId(w, i))?.size ?? 0) > 1

    let anchorIdx = 0
    for (let i = 1; i < g.length; i++) {
      if (!isJunction(i)) continue
      const head = g[anchorIdx], tail = g[i]
      const a = pointId(w, anchorIdx)
      const bk = pointId(w, i)
      const shape = g.slice(anchorIdx, i + 1).map(p => [p.lat, p.lon] as [number, number])
      anchorIdx = i
      if (a === bk) continue

      const km = pathKm(shape)
      if (km < 0.001) continue

      nodes[a]  ??= { id: a,  lat: head.lat, lng: head.lon }
      nodes[bk] ??= { id: bk, lat: tail.lat, lng: tail.lon }

      // Simulated traffic conditions, but fixed per way: running it again
      // any number of times gives the same result, which is what makes
      // comparisons meaningful.
      const r = hash(`${w.id}:${a}`)
      const congestion = clampCongestion(Math.round(BASE_JAM[cls] + (r - 0.5) * 2.2))
      const risk = clampRisk(+(BASE_RISK[cls] + (hash(`r${w.id}:${a}`) - 0.5) * 0.3).toFixed(2))

      const name = tags.name
      const rest = { km: +km.toFixed(4), roadClass: cls, congestion, risk, name, wayId: w.id }
      const back = [...shape].reverse()

      if (reversed) edges.push({ from: bk, to: a, ...rest, shape: back })
      else edges.push({ from: a, to: bk, ...rest, shape })
      if (!oneway) edges.push({ from: bk, to: a, ...rest, shape: back })
    }
  }

  const adj: Record<string, GraphEdge[]> = {}
  for (const id of Object.keys(nodes)) adj[id] = []
  for (const e of edges) adj[e.from].push(e)

  const kept = bestComponent(nodes, adj, points)
  if (kept.size < 8)
    throw new GraphBuildError('The fetched network is too fragmented to route through. Try increasing the detail level or picking two points closer together.')

  const worst = worstReach(points, kept, nodes)
  if (worst > 3)
    throw new GraphBuildError(
      `At the "${DETAIL_LABEL[detail]}" level the network is fragmented: the largest connected `
      + `cluster is still ${worst.toFixed(0)} km from one of the points.`, true)

  const fNodes: Record<string, GraphNode> = {}
  kept.forEach(id => (fNodes[id] = nodes[id]))
  const fEdges = edges.filter(e => kept.has(e.from) && kept.has(e.to))
  const fAdj: Record<string, GraphEdge[]> = {}
  kept.forEach(id => (fAdj[id] = []))
  for (const e of fEdges) fAdj[e.from].push(e)

  return {
    nodes: fNodes, edges: fEdges, adj: fAdj, detail, turns,
    bounds: boundsOf(Object.values(fNodes)),
  }
}

/**
 * How far the worst-served of `points` is from its nearest node in `ids`, in km.
 *
 * This one number decides two different things — whether a network is too
 * fragmented to use at all, and which component to keep when several are
 * candidates — so the two callers have to measure it exactly the same way. They
 * used to carry a copy each, which is how the two decisions drift apart.
 */
function worstReach(points: LatLng[], ids: Iterable<string>, nodes: Record<string, GraphNode>): number {
  return Math.max(...points.map(p => {
    let best = Infinity
    for (const id of ids) { const d = haversine(p, nodes[id]); if (d < best) best = d }
    return best
  }))
}

/**
 * Splits the network into **strongly connected** components: within one
 * component, following the direction of travel from any node reaches every
 * other node.
 *
 * It has to be strongly connected, not just connected, because one-way
 * roads make the two very different. Measured on central Sài Gòn itself:
 * 73% of the fetched ways carry `oneway=yes`, because boulevards with a
 * median strip are drawn as two parallel one-way ways. Ignoring direction,
 * all 506 nodes look like a single block, but following the real direction
 * of travel, only 374 nodes are reachable from the starting point — the
 * remaining 132 sit in the graph with no road actually leading to them.
 *
 * Keeping them means building the network reports success and only the
 * algorithm later reports unreachable, and the explanation wrongly blames a
 * fragmented network when the roads are in fact connected, just one-way in
 * the wrong direction.
 *
 * Uses Kosaraju's algorithm, traversed with an explicit stack since the
 * network has thousands of nodes.
 */
function stronglyConnected(
  nodes: Record<string, GraphNode>,
  adj: Record<string, GraphEdge[]>,
): Set<string>[] {
  const ids = Object.keys(nodes)
  const rev: Record<string, string[]> = {}
  for (const id of ids) rev[id] = []
  for (const list of Object.values(adj)) for (const e of list) rev[e.to]?.push(e.from)

  // Pass one: record the finish order of the traversal.
  const done = new Set<string>()
  const order: string[] = []
  for (const root of ids) {
    if (done.has(root)) continue
    const stack: { id: string; at: number }[] = [{ id: root, at: 0 }]
    done.add(root)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const out = adj[top.id] ?? []
      if (top.at < out.length) {
        const next = out[top.at++].to
        if (!done.has(next)) { done.add(next); stack.push({ id: next, at: 0 }) }
      } else {
        order.push(top.id)
        stack.pop()
      }
    }
  }

  // Pass two: traverse the reversed graph in reverse finish order.
  const seen = new Set<string>()
  const out: Set<string>[] = []
  for (let i = order.length - 1; i >= 0; i--) {
    const root = order[i]
    if (seen.has(root)) continue
    const comp = new Set([root])
    const queue = [root]
    seen.add(root)
    for (let head = 0; head < queue.length; head++)
      for (const back of rev[queue[head]] ?? [])
        if (!seen.has(back)) { seen.add(back); comp.add(back); queue.push(back) }
    out.push(comp)
  }
  return out
}

/**
 * Keeps the road cluster that can serve the whole trip, drops the loose
 * fragments.
 *
 * Does not take the largest cluster. On an interprovincial trip, the
 * largest cluster usually sits entirely within the starting city because
 * the network is cut in the middle; keeping it would snap the destination
 * dozens of kilometres away and the returned route would be entirely
 * meaningless. Instead pick the cluster that comes close to **every**
 * point in the trip, and only then consider its size.
 */
function bestComponent(
  nodes: Record<string, GraphNode>,
  adj: Record<string, GraphEdge[]>,
  points: LatLng[],
): Set<string> {
  const components = stronglyConnected(nodes, adj)
  if (!components.length) return new Set()

  // Every point in the trip must be reachable; use the worst-case distance as the score.
  const reach = (comp: Set<string>) => worstReach(points, comp, nodes)

  let winner = components[0], score = reach(winner)
  for (const comp of components.slice(1)) {
    const s = reach(comp)
    // Under 200m difference counts as a tie, in which case prefer the denser cluster.
    if (s < score - 0.2 || (Math.abs(s - score) <= 0.2 && comp.size > winner.size)) {
      winner = comp; score = s
    }
  }
  return winner
}

/**
 * Nearest intersection to a coordinate, with distance in metres.
 *
 * Can filter by vehicle: a truck can't stop inside an alley, so it must be
 * snapped to the nearest intersection it can actually leave from. Without
 * this filtering step, choosing a truck would make every route report
 * unreachable, even with a major road right next door.
 */
export function snap(
  graph: Graph,
  p: LatLng,
  usable?: (nodeId: string) => boolean,
): { nodeId: string; metres: number } {
  let nodeId = '', best = Infinity
  for (const n of Object.values(graph.nodes)) {
    if (usable && !usable(n.id)) continue
    const d = haversine(p, n)
    if (d < best) { best = d; nodeId = n.id }
  }
  // If no node passes the filter, snapping to any node beats returning nothing.
  if (!nodeId) return snap(graph, p)
  return { nodeId, metres: Math.round(best * 1000) }
}
