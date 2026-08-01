import type {
  CriterionKey, GraphEdge, PeriodKey, RoadClass, TurnRule, TurnTable, VehicleKey, Weights,
} from './types'

/* ------------------------------------------------------------------
   Delivery vehicles.
   Each vehicle type is strong and weak in different places, so the same
   pickup and dropoff still produce different routes — this is where the
   problem is most distinctly Vietnamese, because a motorbike courier and
   a truck driver don't actually take the same road in real life.
   ------------------------------------------------------------------ */
export interface Vehicle {
  key: VehicleKey
  name: string
  /** Speed multiplier on an open road. A motorbike is NOT faster than a car
   *  here — on an open road a car is faster; a motorbike's advantage lies in
   *  `jamSensitivity`. */
  speed: number
  /** How much this vehicle is slowed by congestion. A motorbike can weave
   *  through, so it's below 1. */
  jamSensitivity: number
  /** Multiplied against a road segment's risk factor. */
  riskFactor: number
  /** Road classes this vehicle can never use, regardless of time period. */
  banned: RoadClass[]
  /** Road classes banned only during certain time periods — the inner-city
   *  truck curfew. */
  curfew?: { periods: PeriodKey[]; classes: RoadClass[]; note: string }
  /** OpenStreetMap keyword for this vehicle type, used to match turn-
   *  restriction exemptions. */
  osmExcept: string[]
  strength: string
  weakness: string
}

export const VEHICLES: Vehicle[] = [
  {
    key: 'bike', name: 'Motorbike',
    // The only vehicle type that can use alleys. Measured in central HCMC:
    // 4,345 alleys, and 37% of them are explicitly tagged `motorcar=no` or
    // `motorcar=destination`.
    speed: 0.95, jamSensitivity: 0.55, riskFactor: 1.3, banned: ['motorway'],
    osmExcept: ['motorcycle', 'moped', 'mofa'],
    strength: 'The only type that can use alleys, can weave through congestion, exempt from most turn restrictions',
    weakness: 'Banned from motorways, carries little, higher risk, loses to a car on an open road',
  },
  {
    key: 'van', name: 'Van',
    speed: 1.0, jamSensitivity: 1.0, riskFactor: 1.0, banned: ['alley'],
    osmExcept: [],
    strength: 'Can use every street, not subject to the truck curfew',
    weakness: 'Not faster than anything under any condition, cannot enter alleys',
  },
  {
    key: 'car', name: 'Car',
    speed: 1.10, jamSensitivity: 1.15, riskFactor: 0.8, banned: ['alley'],
    osmExcept: [],
    strength: 'Fastest on an open road, safe, can use motorways',
    weakness: 'Badly hurt by congestion, cannot enter alleys, subject to every turn restriction',
  },
  {
    // A light delivery truck can still use branch roads, it just can't fit
    // into alleys — so the all-day ban only covers `residential`. The real
    // constraint downtown is the truck curfew, and that's a time-based
    // restriction, not a road-class one.
    key: 'truck', name: 'Truck',
    speed: 0.75, jamSensitivity: 1.25, riskFactor: 1.6, banned: ['residential', 'alley'],
    curfew: {
      periods: ['peak'], classes: ['tertiary', 'secondary'],
      note: 'Truck curfew: not allowed on inner-city branch roads and major roads during peak hours',
    },
    osmExcept: ['hgv', 'goods'],
    strength: 'Carries the largest load',
    weakness: 'Banned from alleys and residential roads, subject to the truck curfew, slow, heavily penalised on risky segments',
  },
]
export const vehicleOf = (k: VehicleKey) => VEHICLES.find(v => v.key === k)!

/**
 * Four scales for comparing vehicles, all derived directly from the same
 * coefficients used in the cost function. No number here is hand-set: if
 * someone adjusts one vehicle's coefficient, the scale updates automatically,
 * so the interface can never misrepresent the model.
 */
export interface Trait { name: string; value: number; hue: string; hint: string }

const scale = (v: number, lo: number, hi: number) =>
  Math.round(1 + 4 * Math.min(1, Math.max(0, (v - lo) / (hi - lo))))

/** The bounds of a coefficient, taken from the vehicle table itself — hard-
 *  coding it risks a day where the coefficient changes but the scale doesn't,
 *  and the interface ends up misrepresenting the model. */
const span = (pick: (v: Vehicle) => number): [number, number] =>
  [Math.min(...VEHICLES.map(pick)), Math.max(...VEHICLES.map(pick))]

export function traitsOf(key: VehicleKey): Trait[] {
  const v = vehicleOf(key)
  return [
    {
      name: 'Speed', value: scale(v.speed, ...span(x => x.speed)), hue: '#0a736f',
      hint: 'Speed on an open road, before accounting for congestion',
    },
    {
      name: 'Weaves through traffic', value: scale(-v.jamSensitivity, ...span(x => -x.jamSensitivity)), hue: '#b0651c',
      hint: 'How little congestion slows it down',
    },
    {
      name: 'Safety', value: scale(-v.riskFactor, ...span(x => -x.riskFactor)), hue: '#2a6b8f',
      hint: 'How little it is penalised on risky road segments',
    },
    {
      // An all-day ban is penalised more heavily than a time-based one, since
      // a time-based ban can still be dodged by changing the time period.
      name: 'Road access',
      value: Math.max(1, 5 - v.banned.length * 2 - (v.curfew?.classes.length ?? 0)),
      hue: '#6d4aa8',
      hint: v.curfew
        ? `Banned from ${v.banned.length} road classes, plus ${v.curfew.classes.length} more during the truck curfew`
        : v.banned.length ? `Banned from ${v.banned.length} road classes` : 'Can use every road class',
    },
  ]
}

/* ------------------------------------------------------------------ */

/**
 * Time period acts through **congestion level**, not through base speed.
 *
 * An earlier version multiplied base speed directly by the time period, and
 * that was wrong in a subtle way: multiplying speed multiplies equally for
 * every vehicle type, so a motorbike's weaving advantage became a fixed
 * ratio, exactly the same at every hour. The measured slowdown factor from
 * congestion came out to ×1.92 for a motorbike and ×2.93 for a car —
 * **identical at both peak and off-peak**. That means the model claims a
 * motorbike beats a car by exactly the same percentage at two in the
 * morning, which isn't true.
 *
 * What actually changes with the hour is whether the road is congested. So
 * the time period multiplies into the congestion term: at night congestion
 * nearly vanishes, every vehicle runs at open-road speed, and at that point
 * a car is faster than a motorbike — exactly as in real life.
 */
export const PERIODS: { key: PeriodKey; name: string; jam: number; hue: string }[] = [
  { key: 'peak',    name: 'Peak',     jam: 1.00, hue: '#e85d5d' },
  { key: 'offpeak', name: 'Off-peak', jam: 0.55, hue: '#c98a2e' },
  { key: 'night',   name: 'Night',    jam: 0.18, hue: '#4f5d9e' },
]
export const periodOf = (k: PeriodKey) => PERIODS.find(p => p.key === k)!

/** Open-road speed by road class, km/h — before subtracting congestion. */
const CLASS_SPEED: Record<RoadClass, number> = {
  motorway: 60, trunk: 45, primary: 32, secondary: 26, tertiary: 22, residential: 16,
  // Alleys don't jam up, but they're narrow, winding, and blocked by
  // pedestrians and parked vehicles.
  alley: 11,
}

export const CRITERIA: Record<Exclude<CriterionKey, 'custom'>, { name: string; weights: Weights }> = {
  balanced: { name: 'Balanced',         weights: { distance: 1.0, time: 0.5, congestion: 0.8, risk: 1.5 } },
  distance: { name: 'Shortest',         weights: { distance: 1.0, time: 0.0, congestion: 0.0, risk: 0.0 } },
  time:     { name: 'Fastest',          weights: { distance: 0.0, time: 1.0, congestion: 0.0, risk: 0.0 } },
  avoid:    { name: 'Avoid congestion', weights: { distance: 0.3, time: 0.6, congestion: 2.5, risk: 1.0 } },
}

export interface Conditions {
  vehicle: VehicleKey
  period: PeriodKey
  weights: Weights
}

/**
 * If all four weights are 0, the cost function returns 0 for every road
 * segment, and every route ends up with the same cost — namely 0.
 *
 * At that point UCS is still "correct": it finds the minimum-cost route,
 * it's just that every route is minimum-cost. It can return a 20.7 km route
 * while an 11.4 km one sits right there, and still stamp it OPTIMAL. Nothing
 * here is mathematically wrong, but a user reading "optimal" next to a
 * winding route will simply conclude the app is broken.
 *
 * A* dies the same way: its heuristic multiplies by the lowest cost per
 * kilometre, and that number is now 0, so h = 0 and A* degenerates into UCS.
 * Greedy does too.
 */
export const costIsFlat = (w: Weights) =>
  w.distance === 0 && w.time === 0 && w.congestion === 0 && w.risk === 0

/**
 * The valid range of a road segment's congestion level and risk factor.
 *
 * These bounds were previously spelled out as bare numbers in three unrelated
 * places — the OpenStreetMap builder, the JSON importer, and a comment on the
 * type — so the ranges the cost model assumes lived nowhere it could be
 * imported from. They belong here, beside the cost function that relies on
 * them: a congestion level below 1 makes `edgeCost` negative, and a negative
 * edge cost breaks the guarantee UCS and A* are built on.
 */
export const clampCongestion = (n: number) => Math.min(5, Math.max(1, n))
export const clampRisk = (n: number) => Math.min(1, Math.max(0, n))

/** Display name for each road class, so we can explain why a vehicle is blocked. */
export const ROAD_LABEL: Record<RoadClass, string> = {
  motorway: 'expressway',
  trunk: 'national highway',
  primary: 'main road',
  secondary: 'major road',
  tertiary: 'branch road',
  residential: 'residential road',
  alley: 'alley',
}

/**
 * The representative clock time for each period, in minutes since midnight.
 *
 * Turn-restriction signs in OpenStreetMap record real clock times —
 * "06:00-09:00,16:00-19:00" — while the app only has three periods. Take one
 * representative moment for each period and ask whether that moment falls
 * inside the restriction. This gives a clear-cut result explainable in one
 * sentence, far better than comparing two overlapping time ranges — where
 * even a fifteen-minute overlap would mark the whole period as restricted.
 */
const PERIOD_CLOCK: Record<PeriodKey, number> = {
  peak: 17 * 60 + 30,   // 17:30, evening peak
  offpeak: 13 * 60,     // 13:00
  night: 22 * 60,       // 22:00
}

const within = (minute: number, [from, to]: [number, number]) =>
  from <= to ? minute >= from && minute < to : minute >= from || minute < to

/** Whether this vehicle is banned from that road class during that time period, with the reason. */
export function banReason(edge: GraphEdge, vehicle: VehicleKey, period: PeriodKey): string | null {
  const v = vehicleOf(vehicle)
  if (v.banned.includes(edge.roadClass)) return `${v.name} is banned from ${ROAD_LABEL[edge.roadClass]}s`
  if (v.curfew?.periods.includes(period) && v.curfew.classes.includes(edge.roadClass))
    return v.curfew.note
  return null
}

/** Whether this vehicle can use this road segment during this time period. */
export function passable(edge: GraphEdge, vehicle: VehicleKey, period: PeriodKey): boolean {
  return banReason(edge, vehicle, period) === null
}

/**
 * Whether turning from this road segment onto that one is allowed at that
 * intersection.
 *
 * A turn restriction is a constraint on a **pair** of road segments, not on
 * a node — that's why it can't be folded into `passable`.
 */
export function turnAllowed(
  turns: TurnTable | undefined,
  via: string,
  from: GraphEdge,
  to: GraphEdge,
  c: Conditions,
): boolean {
  if (!turns || from.wayId == null || to.wayId == null) return true
  const clock = PERIOD_CLOCK[c.period]
  const mine = vehicleOf(c.vehicle).osmExcept

  const active = (r: TurnRule) =>
    (!r.hours.length || r.hours.some(h => within(clock, h)))
    && !r.except.some(x => mine.includes(x))

  if (turns.no[`${via}|${from.wayId}|${to.wayId}`]?.some(active)) return false

  // An "only direction X" rule bans every other direction.
  const only = turns.only[`${via}|${from.wayId}`]
  if (only?.some(r => active(r) && r.onlyTo !== to.wayId)) return false

  return true
}

/** Time to traverse the road segment, in minutes. */
export function edgeMinutes(edge: GraphEdge, c: Conditions): number {
  const v = vehicleOf(c.vehicle)
  // Congestion pulls speed down; a motorbike is affected less because it can
  // weave through, and the time period determines whether this segment is
  // actually congested right now.
  const jam = 1 + (edge.congestion - 1) * 0.42 * v.jamSensitivity * periodOf(c.period).jam
  const speed = (CLASS_SPEED[edge.roadClass] * v.speed) / jam
  return (edge.km / speed) * 60
}

/**
 * The cost of a road segment.
 *
 * The congestion and risk terms are both multiplied by length, not added as
 * a flat lump. Enduring three hundred metres of heavy congestion cannot
 * count the same as three kilometres of it, and the network fetched from
 * OpenStreetMap has a great many segments only a few dozen metres long —
 * adding a flat lump would wrongly penalise any route with many
 * intersections. Multiplying by length also brings a second benefit: every
 * cost component then scales with distance, so the lower bound A* uses for
 * its heuristic becomes tight, and A* genuinely expands fewer nodes.
 */
export function edgeCost(edge: GraphEdge, c: Conditions): number {
  const w = c.weights, v = vehicleOf(c.vehicle)
  return w.distance * edge.km
       + w.time * edgeMinutes(edge, c)
       + w.congestion * edge.congestion * edge.km
       + w.risk * edge.risk * v.riskFactor * edge.km
}
