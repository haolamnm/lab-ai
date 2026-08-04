/**
 * Geometry for the custom icon set.
 *
 * The whole set is built on a 24×24 grid, 1.6 stroke, rounded caps, and follows a single rule:
 * **an icon speaks in the exact vocabulary of the map.** The vehicle body is a single
 * continuous stroke, like a road segment; the wheels are hollow circles, like a node sitting
 * in the frontier. When a vehicle is selected, its wheels fill solid — the exact moment a
 * node on the map switches from "waiting to be examined" to "expanded".
 *
 * That keeps the icon set from being decoration borrowed from somewhere else — it is an
 * extension of the very symbol system the user is already reading on the map.
 *
 * Kept separate from the React layer so it can both render into the interface and be exported
 * as a standalone SVG sheet for visual inspection.
 */

export type Shape =
  | { t: 'path'; d: string }
  /** node: true means a wheel or an endpoint — fills solid when selected. */
  | { t: 'circle'; cx: number; cy: number; r: number; node?: boolean }

export type IconName =
  | 'scooter' | 'van' | 'car' | 'truck'
  | 'peak' | 'offpeak' | 'night'
  | 'trunkRoads' | 'midRoads' | 'smallRoads' | 'alleys'

export const ICONS: Record<IconName, Shape[]> = {
  /* ---------- Vehicles ---------- */

  // Motorbike: handlebar, body sloping down to the footrest, seat rising at the back.
  scooter: [
    { t: 'path', d: 'M6.2 7.2h3.4' },
    { t: 'path', d: 'M8.3 7.6 7.3 12.6' },
    { t: 'path', d: 'M7.3 12.6 6.9 14.5' },
    { t: 'path', d: 'M7.3 12.6c-.1 1.6.8 2.6 2.3 2.6h3' },
    { t: 'path', d: 'M12.6 15.2 14.3 10.8h3.1c2.1 0 3.5 1.7 3.5 3.8v.6' },
    { t: 'circle', cx: 6.9, cy: 16.8, r: 2.4, node: true },
    { t: 'circle', cx: 17.9, cy: 16.8, r: 2.4, node: true },
  ],

  // Van: tall cargo box at the back, short sloped cab at the front.
  van: [
    { t: 'path', d: 'M3 15.3V9.5c0-1.2 1-2.2 2.2-2.2h6.9l4.5 4h1.5c1.2 0 2.2 1 2.2 2.2v1.8' },
    { t: 'path', d: 'M12.1 7.3v4h4.5' },
    { t: 'path', d: 'M3 15.3h1.5M10 15.3h5.1M19.9 15.3h.4' },
    { t: 'circle', cx: 7.1, cy: 16.8, r: 2.4, node: true },
    { t: 'circle', cx: 17.5, cy: 16.8, r: 2.4, node: true },
  ],

  // Car: a single roofline stroke running from the tail, over the roof, to the nose.
  car: [
    { t: 'path', d: 'M2.9 15.1v-2.4l2.7-4.1c.36-.55.9-.83 1.6-.83h6.6c.55 0 1 .2 1.4.62l3.1 3.8 1.6.5c.7.22 1.1.75 1.1 1.5v.95' },
    { t: 'path', d: 'M2.9 15.1h1.4M9.8 15.1h4.1M19.6 15.1h1.4' },
    { t: 'path', d: 'M6.9 12.2h9.4' },
    { t: 'circle', cx: 7.1, cy: 16.4, r: 2.4, node: true },
    { t: 'circle', cx: 16.7, cy: 16.4, r: 2.4, node: true },
  ],

  // Truck: a square-cut cargo box, cab lower than the box.
  truck: [
    { t: 'path', d: 'M2.5 15.2V6.4h9.1v8.8' },
    { t: 'path', d: 'M13.5 15.2v-4.4h3.1l3.2 3.1v1.3' },
    { t: 'path', d: 'M2.5 15.2h1.4M8.6 15.2h6.9M19.8 15.2h.4' },
    { t: 'circle', cx: 6.2, cy: 16.8, r: 2.4, node: true },
    { t: 'circle', cx: 17.5, cy: 16.8, r: 2.4, node: true },
  ],

  /* ---------- Time periods ---------- */

  // Peak: the sun straight overhead, eight even rays.
  peak: [
    { t: 'circle', cx: 12, cy: 12, r: 3.9, node: true },
    { t: 'path', d: 'M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2' },
    { t: 'path', d: 'M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6' },
  ],

  // Off-peak: the sun setting below the horizon.
  offpeak: [
    { t: 'path', d: 'M3.4 17.6h17.2' },
    { t: 'path', d: 'M7.6 17.6a4.4 4.4 0 0 1 8.8 0' },
    { t: 'path', d: 'M12 3.4v2.1M4.9 7.2l1.5 1.5M19.1 7.2l-1.5 1.5' },
    { t: 'path', d: 'M6.6 20.6h3.1M14.3 20.6h3.1' },
  ],

  // Night: a crescent moon with one small star.
  night: [
    { t: 'path', d: 'M19.3 14.4a8 8 0 0 1-9.7-9.7 8 8 0 1 0 9.7 9.7Z' },
    { t: 'path', d: 'M17.4 3.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z' },
  ],

  /* ---------- Network detail levels ---------- */
  /* Four icons drawing exactly what they name: the same network, each step denser than the
     last, with the centre node shrinking as the mesh closes in around it. The ramp is the
     whole message — read side by side they say which level fetches more road, which is the
     one thing the user is choosing between. */

  trunkRoads: [
    { t: 'path', d: 'M3.5 12h17M12 3.5v17' },
    { t: 'circle', cx: 12, cy: 12, r: 2.3, node: true },
  ],

  midRoads: [
    { t: 'path', d: 'M3.5 6h17M3.5 12h17M3.5 18h17' },
    { t: 'path', d: 'M6 3.5v17M12 3.5v17M18 3.5v17' },
    { t: 'circle', cx: 12, cy: 12, r: 1.9, node: true },
  ],

  smallRoads: [
    { t: 'path', d: 'M3.2 4.5h17.6M3.2 8.7h17.6M3.2 12.9h17.6M3.2 17.1h17.6' },
    { t: 'path', d: 'M4.5 3.2v17.6M8.7 3.2v17.6M12.9 3.2v17.6M17.1 3.2v17.6' },
    { t: 'circle', cx: 12.9, cy: 12.9, r: 1.5, node: true },
  ],

  // The fourth and finest step. This was drawn as an actual alley once — two streets and a
  // few dead-end branches poking off them — which says more about what an alley *is* than a
  // grid can. It was replaced because of the size it is used at: at 17px the branches merged
  // with the centre node into a blob, and what survived was a two-by-two frame, the sparsest
  // glyph of the four, sitting under the label for the level that loads the most road.
  //
  // These four icons rank four levels, and ranking needs one variable that only moves one
  // way. Density is that variable here, so the alley level gets the densest mesh and lets the
  // label carry what kind of roads they are.
  alleys: [
    { t: 'path', d: 'M3.4 4.2h17.2M3.4 8.1h17.2M3.4 12h17.2M3.4 15.9h17.2M3.4 19.8h17.2' },
    { t: 'path', d: 'M4.2 3.4v17.2M8.1 3.4v17.2M12 3.4v17.2M15.9 3.4v17.2M19.8 3.4v17.2' },
    { t: 'circle', cx: 12, cy: 12, r: 1.3, node: true },
  ],
}
