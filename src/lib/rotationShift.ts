/** Which sector groups gained or lost the most strength against the Nifty over the last `weeks` weekly points of
 *  rotation.json. Strength = group level / Nifty; shift = % change in that ratio. Groups without both points are left out.
 *  Pure: tested in tests/lib.test.ts. */
export interface Shift { name: string; shift: number; real: boolean; members: number }
export function rotationShift(feed: { nifty: (number | null)[]; groups: Record<string, { close: (number | null)[]; members: string[]; real_index: boolean }> }, weeks = 4): Shift[] {
  const n = feed.nifty.length;
  const a = n - 1 - weeks, b = n - 1;
  if (a < 0) return [];
  const na = feed.nifty[a], nb = feed.nifty[b];
  if (!na || !nb) return [];
  const out: Shift[] = [];
  for (const [name, g] of Object.entries(feed.groups)) {
    const ga = g.close[a], gb = g.close[b];
    if (!ga || !gb) continue;
    out.push({ name: name.replace(' (alpha group index)', ''), shift: Math.round(((gb / nb) / (ga / na) - 1) * 1000) / 10, real: g.real_index, members: g.members.length });
  }
  return out.sort((x, y) => y.shift - x.shift || x.name.localeCompare(y.name));
}
