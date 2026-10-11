export const dash = '—';
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
