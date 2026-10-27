/** Discover's one state, and everything that follows from it. Pure: no React, no DOM, so the URL, the session memory and both renderers read the same thing and a test can drive all of it.
 *
 *  DiscoverState is what a person has done on the page: the search, the conditions, the quick filters, the view, the sort, the column preset, how many rows are revealed and which names
 *  are picked for comparison. It round-trips through the query of `#/discover` (serialiseDiscover / parseDiscover), in a fixed key order, so the same screen always has the same link and
 *  Back, Forward, reload and a shared link reproduce it. A parse never guesses: an unknown key or an invalid value is dropped and reported, and the rest of the link still applies.
 *  Private inputs (notes, plans, positions, follows) are not part of it and never reach a URL.
 *
 *  runScreen is the ONE pipeline both renderers draw from: filter, then sort, over the whole screen, then the caller slices. Quotes are not an input to it, by construction, so a live tick
 *  can change what a cell shows and never which names are listed or in what order. */
import { filterRows, type Filters, type Filtered, type Row, type Trend } from './screen.ts';
import { COLUMN_SETS, LIMITS, METRICS, defaultDir, figureOf, metricOf, sortRowsBy, type Cond, type MetricKey, type SortId } from './screener.ts';
import { reprice } from './basis.ts';

export const PAGE = 24;
export const MAX_PICK = 3;
export const MAX_COND = 12;
export type View = 'list' | 'table';
export interface SortSpec { key: SortId; dir: 'asc' | 'desc' }
export interface DiscoverState {
  q: string; sector: string; tier: string; trend: '' | Trend; momentum: '' | 'strong' | 'weak' | 'near-high'; value: '' | 'cheap' | 'rich'; quality: '' | 'high';
  cond: Cond[]; view: View; sort: SortSpec; /** id of a COLUMN_SETS entry */ cols: string; /** how many rows are revealed */ show: number; /** names picked for comparison, at most three */ pick: string[];
}
export const DEFAULT_SORT: SortSpec = { key: 'name', dir: 'asc' };
export const DEFAULT_COLS = COLUMN_SETS[0].id;
export const DEFAULT_STATE: DiscoverState = { q: '', sector: '', tier: '', trend: '', momentum: '', value: '', quality: '', cond: [], view: 'list', sort: DEFAULT_SORT, cols: DEFAULT_COLS, show: PAGE, pick: [] };

const TIERS = ['large', 'mid', 'small', 'micro'] as const, TRENDS = ['up', 'down', 'mixed'] as const, MOMS = ['strong', 'weak', 'near-high'] as const, VALS = ['cheap', 'rich'] as const, QUALS = ['high'] as const;
const METRIC_IDS = new Set<string>(METRICS.map((m) => m.id)); const METRIC_ORDER = new Map<string, number>(METRICS.map((m, i) => [m.id, i]));
const SYMBOL = /^[A-Za-z0-9&_.-]{1,20}$/;
const cleanText = (t: string, max: number) => t.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const sameSort = (a: SortSpec, b: SortSpec) => a.key === b.key && a.dir === b.dir;

/** Conditions in their one canonical order (figure as METRICS lists it, "at least" before "at most", then the value), duplicates dropped, so two states that mean the same thing are the same. */
export function canonConds(conds: readonly Cond[]): Cond[] {
  const seen = new Set<string>(); const out: Cond[] = [];
  for (const c of conds) { const k = `${c.m}|${c.op}|${c.v}|${c.unk ? 1 : 0}`; if (!seen.has(k)) { seen.add(k); out.push(c.unk ? { m: c.m, op: c.op, v: c.v, unk: true } : { m: c.m, op: c.op, v: c.v }); } }
  return out.sort((a, b) => (METRIC_ORDER.get(a.m) ?? 0) - (METRIC_ORDER.get(b.m) ?? 0) || (a.op === b.op ? 0 : a.op === 'gte' ? -1 : 1) || a.v - b.v).slice(0, MAX_COND);
}
/** A condition's value is valid when it is finite and inside the figure's definitional bounds (RSI 0 to 100, ...). */
const validCond = (m: string, v: number): boolean => { if (!METRIC_IDS.has(m) || !Number.isFinite(v) || Math.abs(v) > 1e9) return false; const l = LIMITS[m as MetricKey]; return !(l && ((l.min !== undefined && v < l.min) || (l.max !== undefined && v > l.max))); };

export interface Parsed { state: DiscoverState; /** the parts of the link that were not understood and so were left out, as "key=value" */ ignored: string[] }
/** Read a `#/discover` query (a URLSearchParams, or the text after "?"). `known.sectors`, when given, drops a sector the screen does not have rather than showing an empty page for a typo. */
export function parseDiscover(input: URLSearchParams | string, known?: { sectors?: readonly string[] }): Parsed {
  const q = typeof input === 'string' ? new URLSearchParams(input.replace(/^[#?]/, '')) : input; const ignored: string[] = []; const s: DiscoverState = { ...DEFAULT_STATE, cond: [], pick: [] };
  const oneOf = <T extends string>(k: string, ok: readonly T[]): T | '' => { const v = q.get(k); if (v === null || v === '') return ''; if ((ok as readonly string[]).includes(v)) return v as T; ignored.push(`${k}=${v}`); return ''; };
  s.q = cleanText(q.get('q') ?? '', 60);
  const sec = cleanText(q.get('sector') ?? '', 60); if (sec) { if (known?.sectors && !known.sectors.includes(sec)) ignored.push(`sector=${sec}`); else s.sector = sec; }
  s.tier = oneOf('tier', TIERS); s.trend = oneOf('trend', TRENDS) as DiscoverState['trend']; s.momentum = oneOf('momentum', MOMS); s.value = oneOf('value', VALS); s.quality = oneOf('quality', QUALS);
  const conds: Cond[] = [];
  // the older links: rsi=35-50, rsi_w=.., rsi_m=.. are a range on that RSI, written as two conditions
  for (const m of ['rsi', 'rsi_w', 'rsi_m'] as const) { const t = q.get(m); if (t === null) continue; const mm = t.match(/^(\d{1,3})-(\d{1,3})$/); if (mm && +mm[1] <= +mm[2] && +mm[2] <= 100) conds.push({ m, op: 'gte', v: +mm[1] }, { m, op: 'lte', v: +mm[2] }); else ignored.push(`${m}=${t}`); }
  for (const t of q.getAll('c')) { const mm = t.match(/^([a-z0-9_]+):(ge|le):(-?\d+(?:\.\d+)?)(!?)$/); const v = mm ? Number(mm[3]) : NaN; if (mm && validCond(mm[1], v)) conds.push({ m: mm[1] as MetricKey, op: mm[2] === 'ge' ? 'gte' : 'lte', v, ...(mm[4] ? { unk: true } : {}) }); else ignored.push(`c=${t}`); }
  s.cond = canonConds(conds);
  const v = q.get('view'); if (v === 'table' || v === 'list') s.view = v; else if (v) ignored.push(`view=${v}`);
  const so = q.get('sort'); if (so !== null) { const mm = so.match(/^([a-z0-9_]+)(?:\.(asc|desc))?$/); if (mm && (mm[1] === 'name' || mm[1] === 'sym' || METRIC_IDS.has(mm[1]))) s.sort = { key: mm[1] as SortId, dir: (mm[2] as 'asc' | 'desc' | undefined) ?? defaultDir(mm[1] as SortId) }; else ignored.push(`sort=${so}`); }
  const cs = q.get('cols'); if (cs !== null) { if (COLUMN_SETS.some((c) => c.id === cs)) s.cols = cs; else ignored.push(`cols=${cs}`); }
  const n = q.get('n'); if (n !== null) { if (/^\d{1,4}$/.test(n) && +n >= 1) s.show = Math.max(PAGE, Math.min(5000, +n)); else ignored.push(`n=${n}`); }
  const cmp = q.get('cmp'); if (cmp !== null) { const ok: string[] = []; for (const x of cmp.split(',')) { if (SYMBOL.test(x) && !ok.includes(x)) ok.push(x); else if (x) ignored.push(`cmp=${x}`); } s.pick = ok.slice(0, MAX_PICK); }
  return { state: s, ignored };
}

const enc = (t: string) => encodeURIComponent(t).replace(/%2C/gi, ',').replace(/%3A/gi, ':');
const numText = (v: number) => String(Number(v.toFixed(6)));
/** The query for a state, without the "?". Fixed key order; anything at its default is left out, so the default screen has no query at all. Idempotent: parse(serialise(s)) serialises the same. */
export function serialiseDiscover(st: DiscoverState): string {
  const p: string[] = []; const put = (k: string, v: string) => { if (v) p.push(`${k}=${enc(v)}`); };
  put('q', cleanText(st.q, 60)); put('sector', cleanText(st.sector, 60)); put('tier', st.tier); put('trend', st.trend); put('momentum', st.momentum); put('value', st.value); put('quality', st.quality);
  for (const c of canonConds(st.cond)) p.push(`c=${enc(`${c.m}:${c.op === 'gte' ? 'ge' : 'le'}:${numText(c.v)}${c.unk ? '!' : ''}`)}`);
  if (st.view !== 'list') put('view', st.view);
  if (!sameSort(st.sort, DEFAULT_SORT)) put('sort', `${st.sort.key}.${st.sort.dir}`);
  if (st.cols !== DEFAULT_COLS) put('cols', st.cols);
  if (st.show > PAGE) put('n', String(Math.min(5000, st.show)));
  if (st.pick.length) put('cmp', st.pick.slice(0, MAX_PICK).join(','));
  return p.join('&');
}
export const discoverPath = (st: DiscoverState) => { const q = serialiseDiscover(st); return `/discover${q ? `?${q}` : ''}`; };
export const sameDiscover = (a: DiscoverState, b: DiscoverState) => serialiseDiscover(a) === serialiseDiscover(b);

/* ---- the filters inside it, and the saved screens that store them ---- */
export const filtersOf = (st: DiscoverState): Filters => ({ cond: st.cond, q: st.q, sector: st.sector, tier: st.tier, value: st.value, quality: st.quality, momentum: st.momentum, trend: st.trend });
/** Apply a saved screen's filters onto a state; the view, sort, columns and picks are the person's, not the screen's, so they stay. Page goes back to the first. */
export const withFilters = (st: DiscoverState, f: Filters): DiscoverState => ({ ...st, q: f.q ?? '', sector: f.sector ?? '', tier: f.tier ?? '', value: f.value ?? '', quality: f.quality ?? '', momentum: f.momentum ?? '', trend: f.trend ?? '', cond: canonConds(f.cond ?? []), show: PAGE });
export const hasAnyFilter = (st: DiscoverState) => !!(st.q.trim() || st.sector || st.tier || st.trend || st.momentum || st.value || st.quality || st.cond.length);
/** Clear every filter and the search; the view, sort, columns and comparison picks stay, because they are how the person reads, not what they asked for. */
export const clearFilters = (st: DiscoverState): DiscoverState => ({ ...st, q: '', sector: '', tier: '', trend: '', momentum: '', value: '', quality: '', cond: [], show: PAGE });
/** Replace the conditions on `m` (both ends) with `next`, or drop them when `next` is empty. */
export const setFigure = (st: DiscoverState, m: MetricKey, next: readonly Cond[]): DiscoverState => ({ ...st, cond: canonConds([...st.cond.filter((c) => c.m !== m), ...next]), show: PAGE });

/* ---- the one pipeline ---- */
export interface ScreenRun extends Omit<Filtered, 'rows'> { /** every name that passes, in the shown order: the whole screen, not the rendered slice */ ordered: Row[]; total: number }
export function runScreen(rows: readonly Row[], st: DiscoverState): ScreenRun {
  const f = filterRows(rows, filtersOf(st));
  return { ordered: sortRowsBy(f.rows, st.sort.key, st.sort.dir), total: rows.length, unmeasured: f.unmeasured, notApplicable: f.notApplicable, unknownIncluded: f.unknownIncluded };
}
export const revealed = (run: ScreenRun, st: DiscoverState): Row[] => run.ordered.slice(0, st.show);

/* ---- sort, in words ---- */
export const sortName = (id: SortId): string => (id === 'name' ? 'Name' : id === 'sym' ? 'Symbol' : metricOf(id)?.label ?? id);
export const sortWords = (s: SortSpec): string => (s.key === 'name' || s.key === 'sym' ? `${sortName(s.key)}, ${s.dir === 'asc' ? 'A to Z' : 'Z to A'}` : `${sortName(s.key)}, ${s.dir === 'asc' ? 'lowest first' : 'highest first'}`);
/** The sort a click on a heading asks for: the same figure flips direction; a new one starts in the direction it is read in first. */
export const nextSort = (cur: SortSpec, key: SortId): SortSpec => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDir(key) });
export const isDefaultSort = (s: SortSpec) => sameSort(s, DEFAULT_SORT);

/* ---- quote basis: what a cell shows, against what the filter and sort used ---- */
/** Figures that are pure functions of the price, so a live print can redo them (basis.ts). Everything else on screen is the close. */
export const LIVE_METRICS = new Set<MetricKey>(['price', 'r1d', 'from_high', 'from_low', 'pe', 'pb', 'dist20', 'dist50', 'dist200']);
export interface LiveIn { px: number | null; ch: number | null; fromQuote: boolean }
/** The row as it is DISPLAYED: the live print where there is one from today, every price-derived figure worked out at that price. Never fed back into filtering or sorting. */
export function displayRow(r: Row, lp: LiveIn): { row: Row; live: boolean } {
  if (!lp.fromQuote || lp.px == null) return { row: r, live: false };
  const rp = reprice(r, lp.px); if (rp.basis !== 'live') return { row: r, live: false };
  return { row: { ...r, price: lp.px, r1d: lp.ch, from_high: rp.fromHigh, high52: rp.high52, low52: rp.low52, pe: rp.pe, pb: rp.pb, div_yield: rp.divYield }, live: true };
}
export interface Cell { state: 'value' | 'na' | 'missing'; v: number | null; /** shown at today's live price */ live: boolean; /** the close's figure, which the filter and the sort used */ close: number | null; /** live and close print differently */ differs: boolean }
export function cellOf(r: Row, d: { row: Row; live: boolean }, id: MetricKey): Cell {
  const f = figureOf(d.row, id), c = figureOf(r, id); const live = d.live && LIVE_METRICS.has(id) && f.k === 'value';
  const dp = metricOf(id)?.dp ?? 1; const round = (x: number) => Number(x.toFixed(dp));
  const close = c.k === 'value' ? c.v : null; const v = f.k === 'value' ? f.v : null;
  return { state: f.k, v, live, close, differs: live && v !== null && close !== null && round(v) !== round(close) };
}
/** The figures the current filters and sort are decided on: a live cell for one of these shows its close beside it, so a row never reads as contradicting why it is listed. */
export function predicateMetrics(st: DiscoverState): Set<MetricKey> {
  const s = new Set<MetricKey>(st.cond.map((c) => c.m));
  if (st.sort.key !== 'name' && st.sort.key !== 'sym') s.add(st.sort.key);
  if (st.value) s.add('pe'); if (st.momentum === 'near-high') s.add('from_high'); if (st.momentum === 'strong' || st.momentum === 'weak') s.add('rs3m'); if (st.quality) s.add('roce_med');
  return s;
}

/* ---- session memory: the last Discover screen, and where on it the person was ---- */
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): Store | null => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };
const LAST = 'tripwire:discover:last', PLACES = 'tripwire:discover:places';
/** The query of the Discover screen last left, so the Discover tab comes back to it within the session. */
export const rememberDiscover = (qs: string, s: Store | null = store()): void => { try { s?.setItem(LAST, qs); } catch { /* not kept: the tab then opens the default screen */ } };
export const lastDiscoverQuery = (s: Store | null = store()): string => { try { return s?.getItem(LAST) ?? ''; } catch { return ''; } };
export interface Place { /** window scroll */ y: number; /** the company last opened from this screen */ at: string; /** the table's own scroll box */ tx?: number; ty?: number }
const readPlaces = (s: Store | null): Record<string, Place> => { try { const t = s?.getItem(PLACES); const o = t ? JSON.parse(t) : {}; return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
export function savePlace(qs: string, p: Place, s: Store | null = store()): void {
  try { const all = readPlaces(s); delete all[qs]; all[qs] = p; const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 24))) delete all[k]; s?.setItem(PLACES, JSON.stringify(all)); } catch { /* scroll is then not restored */ }
}
export function loadPlace(qs: string, s: Store | null = store()): Place | null {
  const p = readPlaces(s)[qs]; if (!p || typeof p !== 'object') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  const y = n(p.y); if (y === undefined) return null; return { y, at: typeof p.at === 'string' && SYMBOL.test(p.at) ? p.at : '', tx: n(p.tx), ty: n(p.ty) };
}
