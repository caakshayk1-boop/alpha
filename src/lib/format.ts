export const dash = '—';

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };
const decodeOnce = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
  if (g[0] === '#') { const c = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
  return NAMED[g.toLowerCase()] ?? m;
});
/** Feed text as plain text: real tags removed from the raw input, entities decoded (twice, for double-encoded feeds). The result is for text nodes only and is never parsed as HTML; a bare "<" or ">" in a headline ("Nifty < 25,000") is kept. */
export const plainText = (s: string | null | undefined): string => decodeOnce(decodeOnce((s ?? '').replace(/<\/?[a-z][^>]*>/gi, ' '))).replace(/\s+/g, ' ').trim();
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const num = (n: number | null | undefined, dp = 0) =>
  isNum(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : dash;

/** The minus a reader sees (U+2212), never the hyphen-minus: Pro §23.3. */
export const MINUS = '\u2212';
const signedNum = (n: number, dp: number, sign: boolean) => {
  const v = n.toFixed(dp);
  if (Number(v) === 0) return (0).toFixed(dp);                                    // never "−0.0"
  return n < 0 ? `${MINUS}${v.slice(1)}` : `${sign ? '+' : ''}${v}`;
};
export const pct = (n: number | null | undefined, dp = 1, sign = true) =>
  isNum(n) ? `${signedNum(n, dp, sign)}%` : dash;
/** A change as the reader sees it and hears it: the arrow, sign and direction come from the ROUNDED value, so a
 *  rounded 0.00 is never "down"; the true minus is used; the label is spoken, not read digit by digit. */
export function changeParts(v: number, dp = 2, suffix = '%'): { dir: 'up' | 'down' | 'flat'; text: string; label: string } {
  const r = Number(v.toFixed(dp));
  const mag = Math.abs(r).toFixed(dp);
  const dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
  return { dir, text: `${dir === 'up' ? '▲ +' : dir === 'down' ? `▼ ${MINUS}` : ''}${mag}${suffix}`, label: `${dir === 'flat' ? 'unchanged' : dir} ${mag}${suffix === '%' ? ' percent' : suffix}` };
}
/** A change in a percentage is in percentage points: "+1.2 pp" (never "%"). */
export const pp = (n: number | null | undefined, dp = 1) => (isNum(n) ? `${signedNum(n, dp, true)} pp` : dash);
/** A change in a yield, in whole basis points: "+7 bp". */
export const bp = (n: number | null | undefined) => (isNum(n) ? `${signedNum(n, 0, true)} bp` : dash);
/** A multiple: "24.6×". */
export const ratio = (n: number | null | undefined, dp = 1) => (isNum(n) ? `${n.toFixed(dp)}×` : dash);

export const rupees = (n: number | null | undefined, dp = 2) => (isNum(n) ? `₹${num(n, dp)}` : dash);

/** crore -> compact lakh crore / crore */
export const crore = (n: number | null | undefined) => {
  if (!isNum(n)) return dash;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L cr`;
  return `₹${num(n, 0)} cr`;
};

export const tone = (n: number | null | undefined): 'up' | 'down' | 'flat' =>
  !isNum(n) || n === 0 ? 'flat' : n > 0 ? 'up' : 'down';

export const dateLabel = (iso: string | null | undefined) => {
  if (!iso) return dash;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? dash : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** NSE writes dates as "14-Oct-2026"; the rest of the site writes "14 Oct 2026". Anything else is returned unchanged. */
export const nseDate = (v: string | null | undefined): string => {
  if (!v) return dash;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(v.trim());
  return m ? `${Number(m[1])} ${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()} ${m[3]}` : v;
};

/** "Rs.275 to Rs.289" becomes "₹275 to ₹289", so one currency sign is used everywhere. */
export const rupeeBand = (v: string | null | undefined): string => (v ? v.replace(/Rs\.?\s*/gi, '₹').replace(/\s+to\s+/i, ' to ').trim() : dash);

export const ago = (iso: string | null | undefined) => {
  if (!iso) return dash;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return dash;
  const h = (Date.now() - t) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  if (h < 7 * 24) return `${Math.round(h / 24)}d ago`;
  return dateLabel(iso);                                                          // after a week, the date itself
};

/** Clamp a number into [lo, hi] */
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Background colour for a % move: red <-> neutral <-> green, saturating at ±max. */
export const heat = (p: number | null | undefined, max = 3) => {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 'var(--panel-2)';
  const a = Math.round(Math.min(1, Math.abs(p) / max) * 62) + 6;
  return `color-mix(in srgb, ${p >= 0 ? 'var(--up-fill)' : 'var(--down-fill)'} ${a}%, var(--panel-2))`;
};

/** How current a quote is, from its own timestamp (epoch seconds): "live" only within 15 minutes, otherwise "last trade" with its age. */
export function quoteState(at: number | null | undefined, now = Date.now()): { word: 'live' | 'delayed' | 'last close' | 'unknown'; label: string } {
  if (!at) return { word: 'unknown', label: 'time of last trade not stated' };
  const min = (now - at * 1000) / 60000;
  if (min < 0) return { word: 'live', label: 'live' };
  if (min < 15) return { word: 'live', label: `live · ${Math.max(1, Math.round(min))}m ago` };
  if (min < 60 * 24) return { word: 'delayed', label: `last trade ${min < 120 ? `${Math.round(min)}m` : `${Math.round(min / 60)}h`} ago` };
  return { word: 'last close', label: `last close ${new Date(at * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` };
}
