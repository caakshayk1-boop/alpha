export const dash = '—';

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };
const decodeOnce = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
  if (g[0] === '#') { const c = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
  return NAMED[g.toLowerCase()] ?? m;
});
/** Feed text as plain text: tags removed, entities decoded (twice, for double-encoded feeds), never parsed as HTML so nothing can execute. */
export const plainText = (s: string | null | undefined): string => decodeOnce(decodeOnce((s ?? '').replace(/<[^>]*>/g, ' '))).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const num = (n: number | null | undefined, dp = 0) =>
  isNum(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : dash;

export const pct = (n: number | null | undefined, dp = 1, sign = true) =>
  isNum(n) ? `${sign && n > 0 ? '+' : ''}${n.toFixed(dp)}%` : dash;

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

export const ago = (iso: string | null | undefined) => {
  if (!iso) return dash;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return dash;
  const h = (Date.now() - t) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

/** Clamp a number into [lo, hi] */
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Background colour for a % move: red <-> neutral <-> green, saturating at ±max. */
export const heat = (p: number | null | undefined, max = 3) => {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 'var(--panel-2)';
  const a = Math.round(Math.min(1, Math.abs(p) / max) * 62) + 6;
  return `color-mix(in srgb, ${p >= 0 ? 'var(--up)' : 'var(--down)'} ${a}%, var(--panel-2))`;
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
