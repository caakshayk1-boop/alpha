// Which screen rows the trend map (/api/breadth, worker.js) counts. ONE predicate, imported by the Worker and by the Data and Methodology screens (src/universe.ts), so the
// page that explains the gap between the screen's company count and the trend map's can never describe a different rule from the one the Worker applies.
const pos = (v) => typeof v === 'number' && v > 0;
/** The reasons a row is not counted, in the order they are applied; the first that holds is the row's reason. */
export function breadthExclusion(r) {
  if (!r.liquid) return 'not_liquid';
  if (!pos(r.price) || !pos(r.sma20) || !pos(r.sma50)) return 'no_short_average';
  if (!pos(r.sma200)) return 'no_200';
  if (typeof r.r3m !== 'number' || !Number.isFinite(r.r3m)) return 'no_3m';
  return null;
}
export const inBreadth = (r) => breadthExclusion(r) === null;
/** The trend map only lists a sector with at least this many counted names. */
export const MIN_SECTOR = 8;
