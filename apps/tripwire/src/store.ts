/** Local-first state for Tripwire. Everything is stored on this device until an identity provider is configured (docs/tripwire/BUILD_STATUS.md).
 *  All transitions are pure functions so the journal's history rules, review dates and snapshots can be tested without a browser. */
import type { Filters } from './screen.ts';
import type { Paper } from './tracker.ts';
import type { SeenSnap, SeenChange } from './sincevisit.ts';
export const VERSION = 1;
/** `question` is optional and absent from every version written before 27 Oct 2026: an open question the thesis has not answered yet. */
export interface Version { at: string; thesis: string; support: string; counter: string; decision: string; invalidation: string; trigger: string; reviewOn: string | null; question?: string }
export interface Entry { id: string; sym: string; created: string; archived: boolean; versions: Version[] }   // the last version is current; earlier ones are never rewritten
export interface Plan { id: string; sym: string; at: string; status: 'saved' | 'paper-filled' | 'closed'; entry: number; stop: number; qty: number; riskPct: number; expiry: string | null; rev: number; note: string; filledAt?: string }
export interface Snap { at: string; day: string; px: number | null; rsi: number | null; rs3m: number | null; from_high: number | null }
export interface Prefs { motion: 'auto' | 'off'; haptics: boolean; hideAmounts?: boolean; theme?: string; horizon: string; experience: string; interests: string[]; equity: number; cash: number; riskPct: number; maxPositionPct: number }
export interface State {
  v: number; follows: string[]; entries: Entry[]; plans: Plan[]; compares: string[][]; screens: { name: string; f: Filters }[];
  snaps: Record<string, Snap[]>; prefs: Prefs; onboarded: boolean; reviews: { week: string; note: string }[];
  /** paper trades taken from engine picks; the tracker replays real bars against them */
  paper: Paper[];
  /** What the user was last SHOWN for each followed name (bounded, newest last), written only once the module had been on screen. Optional: absent in every state saved before 27 Oct 2026. */
  seen?: Record<string, SeenSnap[]>;
  /** Changes that were surfaced and not yet acknowledged, newest first; bounded and aged out. Optional. */
  inbox?: SeenChange[];
  /** change id to the time the user dismissed it. Reversible: removing the key restores the item. Optional. */
  dismissed?: Record<string, string>;
}
export const DEFAULTS: State = { v: VERSION, follows: [], entries: [], plans: [], compares: [], screens: [], snaps: {}, onboarded: false, reviews: [], paper: [], seen: {}, inbox: [], dismissed: {},
  prefs: { motion: 'auto', haptics: true, horizon: '', experience: '', interests: [], equity: 1000000, cash: 1000000, riskPct: 0.5, maxPositionPct: 15 } };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const iso = (d: Date) => d.toISOString();

export function toggleFollow(s: State, sym: string): State {
  return { ...s, follows: s.follows.includes(sym) ? s.follows.filter((x) => x !== sym) : [...s.follows, sym] };
}
export function addEntry(s: State, sym: string, v: Omit<Version, 'at'>, now = new Date()): { s: State; id: string } {
  const e: Entry = { id: uid(), sym, created: iso(now), archived: false, versions: [{ at: iso(now), ...v }] };
  return { s: { ...s, entries: [e, ...s.entries] }, id: e.id };
}
/** An edit appends a version; it never overwrites the one before. An edit that changes nothing adds nothing. */
export function editEntry(s: State, id: string, v: Omit<Version, 'at'>, now = new Date()): State {
  return { ...s, entries: s.entries.map((e) => {
    if (e.id !== id) return e;
    const cur = e.versions[e.versions.length - 1];
    const same = (Object.keys(v) as (keyof typeof v)[]).every((k) => cur[k] === v[k]);
    return same ? e : { ...e, versions: [...e.versions, { at: iso(now), ...v }] };
  }) };
}
export const setArchived = (s: State, id: string, archived: boolean): State => ({ ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, archived } : e)) });
export const current = (e: Entry): Version => e.versions[e.versions.length - 1];
/** Calendar day in Asia/Kolkata, so a review "today" is today in India wherever the phone is. */
export const istDay = (d = new Date()) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
export const reviewDue = (e: Entry, today = istDay()): 'overdue' | 'today' | 'later' | null => {
  const r = current(e).reviewOn; if (e.archived || !r) return null;
  return r < today ? 'overdue' : r === today ? 'today' : 'later';
};
export function savePlan(s: State, p: Omit<Plan, 'id' | 'at' | 'rev' | 'status'> & { id?: string }, now = new Date()): State {
  const old = p.id ? s.plans.find((x) => x.id === p.id) : undefined;
  const plan: Plan = { ...p, id: old?.id ?? uid(), at: iso(now), rev: (old?.rev ?? 0) + 1, status: old?.status ?? 'saved' };
  return { ...s, plans: old ? s.plans.map((x) => (x.id === old.id ? plan : x)) : [plan, ...s.plans] };
}
/** A paper fill is something the user records, never something the app infers. */
export const markPaperFill = (s: State, id: string, now = new Date()): State => ({ ...s, plans: s.plans.map((p) => (p.id === id && p.status === 'saved' ? { ...p, status: 'paper-filled', filledAt: iso(now) } : p)) });
export const closePlan = (s: State, id: string): State => ({ ...s, plans: s.plans.map((p) => (p.id === id && p.status === 'paper-filled' ? { ...p, status: 'closed' } : p)) });
export function saveCompare(s: State, syms: string[]): State {
  const key = [...syms].sort().join('|');
  if (syms.length < 2 || s.compares.some((c) => [...c].sort().join('|') === key)) return s;
  return { ...s, compares: [syms, ...s.compares] };
}
export function saveScreen(s: State, name: string, f: Filters): State {
  const n = name.trim().slice(0, 40); if (!n) return s;
  return { ...s, screens: [{ name: n, f }, ...s.screens.filter((x) => x.name !== n)] };
}

/** Take a paper trade from an engine pick. One live paper trade per symbol: a second take of the same name is refused, not duplicated. */
export function takePaper(s: State, p: Omit<Paper, 'id' | 'takenAt'>, nowSec = Math.floor(Date.now() / 1000)): { s: State; ok: boolean } {
  if (s.paper.some((x) => x.sym === p.sym && !x.closedByUser)) return { s, ok: false };
  return { s: { ...s, paper: [{ ...p, id: uid(), takenAt: nowSec }, ...s.paper] }, ok: true };
}
export const removePaper = (s: State, id: string): State => ({ ...s, paper: s.paper.filter((x) => x.id !== id) });
/** Closing by hand stops the one-per-symbol lock but keeps the record; the tracker still shows what the rules did. */
export const archivePaper = (s: State, id: string): State => ({ ...s, paper: s.paper.map((x) => (x.id === id ? { ...x, closedByUser: true } : x)) });

/** Snapshots make "since you last looked" honest: a change is reported only against a stored earlier day, never invented. */
export function recordSnap(s: State, sym: string, snap: Omit<Snap, 'at'>, now = new Date()): State {
  const list = s.snaps[sym] ?? [];
  if (list.length && list[list.length - 1].day === snap.day) return s;     // one per data day
  return { ...s, snaps: { ...s.snaps, [sym]: [...list, { at: iso(now), ...snap }].slice(-30) } };
}
export interface Change { sym: string; since: string; px: number | null; pxPct: number | null; rsiFrom: number | null; rsiTo: number | null; crossed: string[] }
export function changesSince(s: State, now: Record<string, Omit<Snap, 'at'>>): Change[] {
  const out: Change[] = [];
  for (const sym of s.follows) {
    const list = s.snaps[sym], cur = now[sym]; if (!list?.length || !cur) continue;
    const prev = [...list].reverse().find((x) => x.day < cur.day); if (!prev) continue;
    const crossed: string[] = [];
    if (prev.rsi != null && cur.rsi != null) { if (prev.rsi < 70 && cur.rsi >= 70) crossed.push('RSI crossed 70'); if (prev.rsi > 30 && cur.rsi <= 30) crossed.push('RSI crossed 30'); }
    if (prev.from_high != null && cur.from_high != null && prev.from_high < -2 && cur.from_high >= -2) crossed.push('moved within 2% of its 52-week high');
    const pxPct = prev.px && cur.px ? (cur.px / prev.px - 1) * 100 : null;
    if (crossed.length || (pxPct != null && Math.abs(pxPct) >= 3)) out.push({ sym, since: prev.day, px: cur.px, pxPct, rsiFrom: prev.rsi, rsiTo: cur.rsi, crossed });
  }
  return out;
}

/** Weekly process review. Counts what the user did; it never grades a decision by what the price did afterwards. */
export function weeklyReview(s: State, today = istDay()) {
  const from = new Date(new Date(today + 'T00:00:00Z').getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const inWeek = (at: string) => at.slice(0, 10) >= from;
  const touched = s.entries.filter((e) => e.versions.some((v) => inWeek(v.at)));
  const changed = s.entries.filter((e) => e.versions.length > 1 && inWeek(e.versions[e.versions.length - 1].at));
  const open = s.entries.filter((e) => !e.archived && !current(e).invalidation.trim()).length;
  const plans = s.plans.filter((p) => inWeek(p.at));
  const overdue = s.entries.filter((e) => reviewDue(e, today) === 'overdue').length;
  return { from, decisionsTouched: touched.length, thesesChanged: changed.length, entriesWithoutInvalidation: open, plansSaved: plans.length, overdue };
}

/** Export. CSV cells that start with a formula character are prefixed so a spreadsheet does not run them. */
const cell = (v: unknown) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function journalCsv(s: State): string {
  const head = ['symbol', 'version', 'recorded', 'thesis', 'support', 'counter', 'decision', 'invalidation', 'review_trigger', 'review_on', 'archived'];
  const rows = s.entries.flatMap((e) => e.versions.map((v, i) => [e.sym, i + 1, v.at, v.thesis, v.support, v.counter, v.decision, v.invalidation, v.trigger, v.reviewOn ?? '', e.archived]));
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}
export const exportJson = (s: State) => JSON.stringify({ app: 'tripwire', exported: new Date().toISOString(), ...s }, null, 1);
/** Import accepts only our own shape, version-checked; anything else is refused whole rather than merged half-way. */
export function parseState(text: string): State | null {
  try {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || d.v !== VERSION || !Array.isArray(d.follows) || !Array.isArray(d.entries) || !Array.isArray(d.plans)) return null;
    // only the fields the app owns: the export's own wrapper (app, exported) must not leak into the saved state, and nothing unknown is carried along
    return { v: VERSION, follows: d.follows, entries: d.entries, plans: d.plans, compares: Array.isArray(d.compares) ? d.compares : [], screens: Array.isArray(d.screens) ? d.screens : [], snaps: d.snaps && typeof d.snaps === 'object' ? d.snaps : {},
      onboarded: !!d.onboarded, reviews: Array.isArray(d.reviews) ? d.reviews : [], paper: Array.isArray(d.paper) ? d.paper : [],
      seen: d.seen && typeof d.seen === 'object' && !Array.isArray(d.seen) ? d.seen : {}, inbox: Array.isArray(d.inbox) ? d.inbox : [], dismissed: d.dismissed && typeof d.dismissed === 'object' && !Array.isArray(d.dismissed) ? d.dismissed : {}, prefs: { ...DEFAULTS.prefs, ...(d.prefs ?? {}) } };
  } catch { return null; }
}
/** Merge a guest/device state into another (account migration): union by id, the longer version history wins, so nothing is lost. */
export function mergeStates(a: State, b: State): State {
  const byId = <T extends { id: string }>(x: T[], y: T[], pick: (p: T, q: T) => T) => { const m = new Map(x.map((i) => [i.id, i])); for (const i of y) m.set(i.id, m.has(i.id) ? pick(m.get(i.id)!, i) : i); return [...m.values()]; };
  return { ...a, follows: [...new Set([...a.follows, ...b.follows])],
    entries: byId(a.entries, b.entries, (p, q) => (q.versions.length > p.versions.length ? q : p)),
    plans: byId(a.plans, b.plans, (p, q) => (q.rev > p.rev ? q : p)),
    compares: [...a.compares, ...b.compares.filter((c) => !a.compares.some((d) => d.join() === c.join()))],
    screens: [...a.screens, ...b.screens.filter((c) => !a.screens.some((d) => d.name === c.name))],
    paper: byId(a.paper ?? [], b.paper ?? [], (p) => p),
    // weekly reviews: one per week, the longer note wins. Since-you-last-looked baselines: the union by day, so a restored device does not lose its history.
    reviews: (() => { const m = new Map((a.reviews ?? []).map((r) => [r.week, r])); for (const r of b.reviews ?? []) { const o = m.get(r.week); if (!o || r.note.length > o.note.length) m.set(r.week, r); } return [...m.values()]; })(),
    snaps: (() => { const out: State['snaps'] = { ...a.snaps }; for (const [sym, list] of Object.entries(b.snaps ?? {})) { const m = new Map((out[sym] ?? []).map((x) => [x.day, x])); for (const x of list) if (!m.has(x.day)) m.set(x.day, x); out[sym] = [...m.values()].sort((p, q) => p.day.localeCompare(q.day)); } return out; })(),
    seen: (() => { const out: NonNullable<State['seen']> = { ...(a.seen ?? {}) }; for (const [sym, list] of Object.entries(b.seen ?? {})) { const m = new Map((out[sym] ?? []).map((x) => [x.at, x])); for (const x of list) if (!m.has(x.at)) m.set(x.at, x); out[sym] = [...m.values()].sort((p, q) => p.at.localeCompare(q.at)).slice(-5); } return out; })(),
    inbox: (() => { const m = new Map((a.inbox ?? []).map((c) => [c.id, c])); for (const c of b.inbox ?? []) if (!m.has(c.id)) m.set(c.id, c); return [...m.values()].sort((p, q) => q.curAt.localeCompare(p.curAt)).slice(0, 50); })(),
    dismissed: { ...(b.dismissed ?? {}), ...(a.dismissed ?? {}) },
    // preferences: keep this device's, unless it has never been customised (a fresh install restoring a backup should get the backup's equity, risk and theme)
    prefs: JSON.stringify(a.prefs) === JSON.stringify(DEFAULTS.prefs) || JSON.stringify({ ...a.prefs, haptics: true }) === JSON.stringify(DEFAULTS.prefs) ? { ...b.prefs } : a.prefs };
}
/** What is on this device, read defensively. Nothing readable is "no data yet"; something there that cannot be read is NOT the same, and the caller keeps a copy of it
 *  before anything is written over it. */
export function readSaved(text: string | null): { state: State; unreadable: boolean } {
  if (text == null || text === '') return { state: DEFAULTS, unreadable: false };
  const p = parseState(text); return p ? { state: p, unreadable: false } : { state: DEFAULTS, unreadable: true };
}
