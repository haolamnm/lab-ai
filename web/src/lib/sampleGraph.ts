import { boundsOf } from './geo'
import type { Graph, GraphEdge, GraphNode, Place, RoadClass } from './types'

/**
 * Sample graph designed by the team.
 *
 * The assignment separates out the algorithm-explanation section and
 * requires the team to **build its own illustrative example, not copy one
 * from a tutorial**. A network loaded from OpenStreetMap can't serve that
 * purpose: hundreds to thousands of nodes, node ids that are coordinate
 * strings, nobody can trace it by eye. An explanatory example needs the
 * opposite — small, named, controllable.
 *
 * Twenty-one nodes named after real places in HCMC, each node tagged with
 * a letter so a route can be described as "route A -> C -> F -> H", exactly
 * like the sample paragraph in the assignment. Thirty-six edges, above the
 * assignment's minimum of twenty nodes and thirty edges, so this dataset can
 * be submitted as-is.
 *
 * The numbers aren't picked at random. They're chosen so the four
 * algorithms produce four visibly different results: there's a short route
 * that cuts through the heavy-congestion cluster at Hàng Xanh, a longer but
 * freer route swinging past Landmark 81, and a few dead-end branches to the
 * west so DFS has somewhere to plunge deep and then have to backtrack.
 *
 * Every scenario in `sampleCases.ts` is a trip across this one network — the
 * network is the constant, and each case changes only where you are going and
 * under what conditions. Anything added here has to keep all of them working.
 */

interface Row {
  label: string
  name: string
  lat: number
  lng: number
}

const NODES: Row[] = [
  { label: 'A', name: 'Chợ Bến Thành',        lat: 10.7725, lng: 106.6980 },
  { label: 'B', name: 'Nhà thờ Đức Bà',       lat: 10.7797, lng: 106.6990 },
  { label: 'C', name: 'Dinh Độc Lập',         lat: 10.7772, lng: 106.6957 },
  { label: 'D', name: 'Bến Bạch Đằng',        lat: 10.7745, lng: 106.7060 },
  { label: 'E', name: 'Thảo Cầm Viên',        lat: 10.7880, lng: 106.7050 },
  { label: 'F', name: 'Ngã tư Hàng Xanh',     lat: 10.8010, lng: 106.7100 },
  { label: 'G', name: 'Landmark 81',          lat: 10.7947, lng: 106.7218 },
  { label: 'H', name: 'Cầu Sài Gòn',          lat: 10.7960, lng: 106.7280 },
  { label: 'I', name: 'Thảo Điền',            lat: 10.8060, lng: 106.7370 },
  { label: 'J', name: 'Chợ Thủ Đức',          lat: 10.8500, lng: 106.7550 },
  { label: 'K', name: 'Bến xe Miền Đông',     lat: 10.8145, lng: 106.7115 },
  { label: 'L', name: 'Chợ Bà Chiểu',         lat: 10.8018, lng: 106.6968 },
  { label: 'M', name: 'Sân bay Tân Sơn Nhất', lat: 10.8188, lng: 106.6520 },
  { label: 'N', name: 'Chợ Tân Bình',         lat: 10.7936, lng: 106.6473 },
  { label: 'O', name: 'ĐH Bách Khoa',         lat: 10.7725, lng: 106.6580 },
  { label: 'P', name: 'Bệnh viện Chợ Rẫy',    lat: 10.7556, lng: 106.6595 },
  { label: 'Q', name: 'Chợ Bình Tây',         lat: 10.7500, lng: 106.6500 },
  { label: 'R', name: 'Công viên Đầm Sen',    lat: 10.7680, lng: 106.6350 },
  { label: 'S', name: 'Cầu Chữ Y',            lat: 10.7480, lng: 106.6870 },
  { label: 'T', name: 'Crescent Mall Q7',     lat: 10.7290, lng: 106.7180 },
  // The one node that is not a landmark. It exists so the network has a stretch
  // only a motorbike can use, which is the single most Vietnamese thing about
  // this problem and was otherwise unrepresented: every edge in the original
  // twenty was a road every vehicle could legally drive. Its two legs run
  // C -> U -> L alongside the C-L major road, 100 m shorter end to end and less
  // than half the speed — so a motorbike takes it under every criterion except
  // Fastest, and no other vehicle can take it at all. Placed on the real Đinh
  // Tiên Hoàng corridor between Đa Kao and Bà Chiểu, so the detour it draws on
  // the map is where those alleys actually are.
  { label: 'U', name: 'Hẻm Đinh Tiên Hoàng',  lat: 10.7930, lng: 106.6923 },
]

/** [from, to, km, congestion 1-5, risk 0-1, road class] */
const EDGES: [string, string, number, number, number, RoadClass][] = [
  ['A', 'C', 0.7, 4, 0.10, 'secondary'],
  ['A', 'D', 1.0, 3, 0.10, 'primary'],
  ['A', 'S', 3.2, 3, 0.30, 'secondary'],
  ['A', 'O', 4.4, 4, 0.20, 'primary'],
  ['B', 'C', 0.5, 2, 0.05, 'tertiary'],
  ['B', 'D', 1.0, 2, 0.05, 'tertiary'],
  ['B', 'E', 1.1, 3, 0.10, 'secondary'],
  ['C', 'L', 3.0, 4, 0.20, 'primary'],
  ['D', 'E', 1.6, 2, 0.10, 'primary'],
  ['D', 'T', 5.6, 3, 0.20, 'primary'],
  ['E', 'F', 1.6, 5, 0.40, 'primary'],
  ['E', 'G', 2.1, 3, 0.10, 'primary'],
  ['F', 'G', 1.5, 5, 0.50, 'primary'],
  ['F', 'K', 2.0, 4, 0.30, 'primary'],
  ['F', 'L', 1.5, 4, 0.30, 'secondary'],
  ['G', 'H', 0.8, 3, 0.10, 'primary'],
  ['H', 'I', 1.4, 2, 0.10, 'motorway'],
  ['H', 'K', 2.4, 3, 0.20, 'primary'],
  ['I', 'J', 5.5, 2, 0.10, 'motorway'],
  ['J', 'K', 5.2, 3, 0.20, 'primary'],
  ['K', 'M', 6.5, 4, 0.30, 'primary'],
  ['L', 'M', 5.3, 4, 0.30, 'secondary'],
  ['L', 'N', 5.6, 3, 0.20, 'secondary'],
  ['M', 'N', 3.0, 3, 0.20, 'primary'],
  ['N', 'O', 2.7, 3, 0.20, 'secondary'],
  ['N', 'R', 3.5, 2, 0.10, 'tertiary'],
  ['O', 'P', 2.0, 4, 0.30, 'secondary'],
  ['O', 'R', 2.6, 3, 0.20, 'tertiary'],
  ['P', 'Q', 1.8, 5, 0.50, 'residential'],
  ['P', 'S', 2.2, 4, 0.40, 'secondary'],
  ['Q', 'R', 2.4, 3, 0.20, 'residential'],
  ['Q', 'S', 4.3, 3, 0.30, 'secondary'],
  ['S', 'T', 4.0, 2, 0.10, 'primary'],
  ['T', 'H', 6.0, 2, 0.10, 'motorway'],
  // The alley cut-through. Congestion 1 because alleys do not queue, risk high
  // because they are narrow and full of parked bikes — so it is cheap on the
  // congestion term and dear on the risk term, and which way that lands is
  // exactly what the cost-function comparison is for.
  ['C', 'U', 1.80, 1, 0.35, 'alley'],
  ['U', 'L', 1.10, 1, 0.35, 'alley'],
]

export function buildSampleGraph(): Graph {
  const byLabel = new Map(NODES.map(r => [r.label, r]))
  const nodes: Record<string, GraphNode> = {}
  for (const r of NODES) nodes[r.label] = { id: r.label, lat: r.lat, lng: r.lng, label: r.label, name: r.name }

  const edges: GraphEdge[] = []
  for (const [from, to, km, congestion, risk, roadClass] of EDGES) {
    const a = byLabel.get(from)
    const b = byLabel.get(to)
    // Both tables are in this file, so a miss is a typo in `EDGES` rather than
    // anything the running app can produce — but dropping the row keeps the
    // network buildable instead of taking the whole pane down over it.
    if (!a || !b) continue
    const shape: [number, number][] = [[a.lat, a.lng], [b.lat, b.lng]]
    // The edge name just uses the letter pair, so the explanation reads
    // exactly like the sample paragraph in the assignment: "segment E–F is
    // congested 5/5".
    const name = `${from}–${to}`
    edges.push({ from, to, km, roadClass, congestion, risk, name, shape })
    edges.push({ from: to, to: from, km, roadClass, congestion, risk, name, shape: [...shape].reverse() })
  }

  const adj: Record<string, GraphEdge[]> = {}
  for (const id of Object.keys(nodes)) adj[id] = []
  for (const e of edges) adj[e.from]?.push(e)

  return { nodes, edges, adj, detail: 'coarse', bounds: boundsOf(NODES) }
}

/** Place data for a sample node, to feed directly into the start-point and destination-point picker. */
export function samplePlace(label: string): Place {
  const r = NODES.find(n => n.label === label)
  // Only the scenarios call this, and every label they name is a row above. A
  // fallback coordinate would be worse than a stop: it would pin the trip
  // somewhere real and wrong, and the scenario would look merely disappointing
  // rather than broken.
  if (!r) throw new Error(`The sample graph has no node labelled "${label}"`)
  return { name: `${r.label} · ${r.name}`, detail: 'Sample graph', lat: r.lat, lng: r.lng }
}
