/** The words a chart would say (Pro §30): one deterministic sentence from the series itself, and a small table of it, so
 *  no information is only visual. Pure, tested in tests/lib.test.ts. */
const day = (t: number) => new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export function chartSummary(t: number[], c: number[], h: number[] = c, l: number[] = c, money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`): string {
  const n = Math.min(t.length, c.length);
  if (n < 2) return 'Not enough prices to describe.';
  let hi = 0, lo = 0;
  for (let i = 1; i < n; i++) { if ((h[i] ?? c[i]) > (h[hi] ?? c[hi])) hi = i; if ((l[i] ?? c[i]) < (l[lo] ?? c[lo])) lo = i; }
  const move = (c[n - 1] / c[0] - 1) * 100;
  const dir = Math.abs(move) < 0.05 ? 'Flat' : move > 0 ? `Up ${move.toFixed(1)}%` : `Down ${Math.abs(move).toFixed(1)}%`;
  return `${dir} from ${day(t[0])} to ${day(t[n - 1])}; low ${money(l[lo] ?? c[lo])} on ${day(t[lo])}; high ${money(h[hi] ?? c[hi])} on ${day(t[hi])}; last ${money(c[n - 1])}.`;
}

/** At most `rows` evenly spaced points, always including the first and the last. */
export function chartRows(t: number[], c: number[], rows = 24): { date: string; close: number }[] {
  const n = Math.min(t.length, c.length);
  if (!n) return [];
  const step = Math.max(1, Math.ceil(n / rows));
  const idx = new Set<number>([0, n - 1]);
  for (let i = 0; i < n; i += step) idx.add(i);
  return [...idx].sort((a, b) => a - b).map((i) => ({ date: day(t[i]), close: c[i] }));
}
