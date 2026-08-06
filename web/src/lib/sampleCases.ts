import type { CriterionKey, PeriodKey, VehicleKey } from './types'

/**
 * The scenarios the sample graph exists to demonstrate.
 *
 * One trip proves one thing. The sample network used to load with a single
 * hard-coded pair — Chợ Bến Thành to Chợ Thủ Đức — and everything else about
 * the model had to be found by hand: you had to already know that a truck is
 * shut out of branch roads at peak, or that congestion is nearly gone at
 * night, in order to think of setting those controls and looking. Anything
 * nobody thought to try looked like it was not there.
 *
 * So each case fixes a whole situation — where you are going, in what, at what
 * hour, optimising for what — chosen so that exactly one thing about the model
 * is the reason the answer comes out the way it does. Together they cover the
 * axes the app can vary: trip shape, vehicle class, time of day, and cost
 * function. `about` says what to look at, because a route that is correct for
 * a reason you cannot see teaches nothing.
 *
 * No case sets the dropoff to the pickup, which is what Held-Karp needs to run.
 * That is not an oversight: on a closed tour the planner's optional ordering
 * folds the return leg away, so five of the six panes come back with a route
 * that never reaches the warehouse. Once that is fixed upstream this set wants
 * a closed tour, because Held-Karp is the one algorithm nothing else here
 * demonstrates.
 *
 * They all run on the same network, so two cases can be compared directly:
 * `rush-hour` and `after-dark` are the same two points in the same car under
 * the policy a courier would actually use at that hour, and reading them back
 * to back is the demonstration. They deliberately change both the hour and the
 * criterion rather than isolating one. Holding the criterion fixed does still
 * flip this trip between off-peak and night, but by around a hundredth of a
 * cost point — true, and far too fine a margin to teach anything. Isolating a
 * single variable is what the comparison tables are for; a scenario is a
 * situation.
 */
export interface SampleCase {
  key: string
  name: string
  /** What this case is here to show — displayed beside it, not just in code. */
  about: string
  /** Node labels in the sample graph. */
  start: string
  stops: string[]
  goal: string
  vehicle: VehicleKey
  period: PeriodKey
  criterion: Exclude<CriterionKey, 'custom'>
  optimiseOrder: boolean
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    key: 'two-blocks',
    name: 'Two blocks',
    about: 'Chợ Bến Thành to Nhà thờ Đức Bà. Everything sensible goes A–C–B in 1.2 km; DFS commits to the first road it sees and comes back 23 km later, having been right across the city.',
    start: 'A', stops: [], goal: 'B',
    vehicle: 'bike', period: 'offpeak', criterion: 'balanced', optimiseOrder: true,
  },
  {
    key: 'cross-town',
    name: 'Cross-town haul',
    about: 'Chợ Bến Thành to Chợ Thủ Đức, the full width of the network. A* and UCS agree on 11.4 km; BFS takes 12.4 km chasing the fewest hops, DFS 21.8 km.',
    start: 'A', stops: [], goal: 'J',
    vehicle: 'bike', period: 'peak', criterion: 'balanced', optimiseOrder: true,
  },
  {
    key: 'rush-hour',
    name: 'Rush hour',
    about: 'Chợ Bến Thành to Crescent Mall by car at 17:30, avoiding congestion. It gives up 600 m to go round by Cầu Chữ Y: 7.2 km, 23 minutes.',
    start: 'A', stops: [], goal: 'T',
    vehicle: 'car', period: 'peak', criterion: 'avoid', optimiseOrder: true,
  },
  {
    key: 'after-dark',
    name: 'Same trip at night',
    about: 'The rush-hour trip again at 22:00, now chasing time. With the jams gone the direct road through Bến Bạch Đằng wins: 6.6 km, 13 minutes — ten minutes less for the same two points.',
    start: 'A', stops: [], goal: 'T',
    vehicle: 'car', period: 'night', criterion: 'time', optimiseOrder: true,
  },
  {
    key: 'alley',
    name: 'Alley shortcut',
    about: 'Chợ Bến Thành to Tân Sơn Nhất by motorbike, shortest distance. It cuts through the Bà Chiểu alley for 8.9 km where every other vehicle is stuck with 9.0 km on the road — then switch to Fastest and even the motorbike abandons it, because 100 m saved costs nine minutes.',
    start: 'A', stops: [], goal: 'M',
    vehicle: 'bike', period: 'offpeak', criterion: 'distance', optimiseOrder: true,
  },
  {
    key: 'truck-curfew',
    name: 'Truck at peak',
    about: 'The same trip in a truck during the inner-city curfew, with branch and major roads closed to it. It is pushed out to 12.7 km and 78 minutes, against the motorbike’s 8.9 km and 41 minutes.',
    start: 'A', stops: [], goal: 'M',
    vehicle: 'truck', period: 'peak', criterion: 'balanced', optimiseOrder: true,
  },
  {
    key: 'delivery-round',
    name: 'Three-stop run',
    about: 'Dinh Độc Lập, the airport and Chợ Bình Tây on the way to Chợ Thủ Đức, so the visit order is the whole problem. Optimised it runs 29.5 km; turn "Optimize visit order" off and the same algorithms follow the order you typed for 36.7 km. Nearest Neighbor ignores the switch — ordering is what it is.',
    start: 'A', stops: ['C', 'M', 'Q'], goal: 'J',
    vehicle: 'bike', period: 'peak', criterion: 'balanced', optimiseOrder: true,
  },
]

export function sampleCaseOf(key: string | null): SampleCase {
  return SAMPLE_CASES.find(c => c.key === key) ?? SAMPLE_CASES[0]
}
