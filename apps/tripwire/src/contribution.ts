/** SIGNED CONTRIBUTIONS that add up. Pure: no React, no clock. Used wherever a total (open P&L) is shown as the parts it is made of.
 *
 *  The fault this replaces: the list was sorted best-first and cut at eight, so with more than eight positions the first view showed only the winners and the losses vanished, with no
 *  remainder and nothing saying so. Here the rows are chosen by SIZE (largest absolute contribution first), the largest gain and the largest loss are always among them whenever
 *  either exists, everything left is netted into one "Other" row, and the rows plus Other equal the total EXACTLY (the arithmetic is done in whole paise, so rounding cannot
 *  open a gap). Nothing is dropped, estimated or zero-filled: an item with no value is not an item. */
export interface ContribIn { key: string; label: string; value: number }
export interface ContribRow { key: string; label: string; value: number }
export interface ContribOther { n: number; value: number; gains: number; losses: number }
export interface Contributions { rows: ContribRow[]; other: ContribOther | null; total: number; count: number }
const paise = (v: number) => Math.round(v * 100);
const rupees = (p: number) => p / 100;

export function contributions(items: readonly ContribIn[], max = 8): Contributions {
  const xs = items.filter((i) => Number.isFinite(i.value)).map((i) => ({ ...i, p: paise(i.value) }));
  const total = xs.reduce((a, x) => a + x.p, 0);
  const byMag = [...xs].sort((a, b) => Math.abs(b.p) - Math.abs(a.p) || a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  const cap = Math.max(1, Math.floor(max));
  let pick = byMag.slice(0, cap);
  // the biggest gain and the biggest loss are always on the first view when the book has any: swap out the smallest row of the same kind of surplus
  const need = (sign: 1 | -1) => {
    const best = byMag.find((x) => Math.sign(x.p) === sign); if (!best || pick.includes(best)) return;
    // drop the smallest row whose sign still has another representative, so adding the missing kind never removes the only one of another
    const count = (g: number) => pick.filter((x) => Math.sign(x.p) === g).length;
    const drop = [...pick].reverse().find((x) => count(Math.sign(x.p)) > 1) ?? pick[pick.length - 1];
    pick = pick.filter((x) => x !== drop).concat(best);
  };
  if (xs.length > cap) { need(-1); need(1); }
  const rest = xs.filter((x) => !pick.includes(x));
  const rows = [...pick].sort((a, b) => b.p - a.p || a.label.localeCompare(b.label)).map((x) => ({ key: x.key, label: x.label, value: rupees(x.p) }));
  const other: ContribOther | null = rest.length ? { n: rest.length, value: rupees(rest.reduce((a, x) => a + x.p, 0)), gains: rupees(rest.filter((x) => x.p > 0).reduce((a, x) => a + x.p, 0)), losses: rupees(rest.filter((x) => x.p < 0).reduce((a, x) => a + x.p, 0)) } : null;
  return { rows, other, total: rupees(total), count: xs.length };
}
/** True when the parts add up to the total to the paisa. The function above guarantees it; a test (and anyone) can check it. */
export function reconciles(c: Contributions): boolean { return c.rows.reduce((a, r) => a + paise(r.value), 0) + (c.other ? paise(c.other.value) : 0) === paise(c.total); }
