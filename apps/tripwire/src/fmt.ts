export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const dash = '—';
export const inr = (v: unknown, dp = 2) => (isNum(v) ? '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : dash);
export const inr0 = (v: unknown) => inr(v, 0);
/** A percentage. A value that rounds to zero prints as 0.0%, never "−0.0%" or "+0.0%": a sign on nothing reads as a move that did not happen. */
export const pct = (v: unknown, dp = 1, sign = true) => { if (!isNum(v)) return dash; const t = Math.abs(v).toFixed(dp); const zero = Number(t) === 0; return `${zero ? '' : sign && v > 0 ? '+' : v < 0 ? '−' : ''}${t}%`; };
export const x1 = (v: unknown, dp = 1) => (isNum(v) ? v.toFixed(dp) : dash);
export const cr = (v: unknown) => (isNum(v) ? '₹' + Math.round(v).toLocaleString('en-IN') + ' cr' : dash);
export const tone = (v: unknown) => (isNum(v) ? (Math.abs(v) < 0.05 ? '' : v > 0 ? 'up' : 'down') : '');
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayWord = (iso?: string | null) => { if (!iso) return 'an unknown date'; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); if (!y || !m || !d) return 'an unknown date'; const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd]} ${d} ${M[m - 1]}`; };
export const initials = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
/** "1 company", "2 companies": the count and the right form of the word. Pass the plural when it is not just an s. Counts print with Indian digit grouping. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
