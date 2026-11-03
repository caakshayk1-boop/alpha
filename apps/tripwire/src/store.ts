/** Local-first state for Tripwire. Everything is stored on this device until an identity provider is configured (docs/tripwire/BUILD_STATUS.md).
 *  All transitions are pure functions so the journal's history rules, review dates and snapshots can be tested without a browser. */
import type { Filters } from './screen.ts';
import type { Paper, View } from './tracker.ts';
import type { SeenSnap, SeenChange } from './sincevisit.ts';
import { agreementSettings, type AgreementSettings } from './agreement.ts';
export const VERSION = 1;
/** `question` is optional and absent from every version written before 27 Oct 2026: an open question the thesis has not answered yet. */
export interface Version { at: string; thesis: string; support: string; counter: string; decision: string; invalidation: string; trigger: string; reviewOn: string | null; question?: string }
export interface Entry { id: string; sym: string; created: string; archived: boolean; versions: Version[] }   // the last version is current; earlier ones are never rewritten
export interface Plan { id: string; sym: string; at: string; status: 'saved' | 'paper-filled' | 'closed'; entry: number; stop: number; qty: number; riskPct: number; expiry: string | null; rev: number; note: string; filledAt?: string }
export interface Snap { at: string; day: string; px: number | null; rsi: number | null; rs3m: number | null; from_high: number | null }
export interface Prefs { motion: 'auto' | 'off'; /** Version 2 retains existing motion choices. New devices use restrained motion and respect reduced motion. */ motionV?: number; haptics: boolean; hideAmounts?: boolean; theme?: string; horizon: string; experience: string; interests: string[]; equity: number; cash: number; riskPct: number; maxPositionPct: number; /** the chart range and benchmark view this person last chose; absent until they choose (additive, 1 Nov 2026) */ chart?: { range?: string; vs?: boolean } }
export interface State {
  /** Entry-candidate settings on this device. Never change existing positions or the shared auto book's published settings. */
  signalAgreement?: AgreementSettings;
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
  /** True once the one-line "your notes stay on this device, here is the backup" has been shown at a first save. Optional: absent in every state saved before 28 Oct 2026. */
  storageNote?: boolean;
}
export const DEFAULTS: State = { v: VERSION, follows: [], entries: [], plans: [], compares: [], screens: [], snaps: {}, onboarded: false, reviews: [], paper: [], seen: {}, inbox: [], dismissed: {},
  prefs: { motion: 'auto', motionV: 2, haptics: true, horizon: '', experience: '', interests: [], equity: 1000000, cash: 1000000, riskPct: 0.5, maxPositionPct: 15 } };

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
  if (s.paper.some((x) => x.sym === p.sym && !x.closedByUser && !['closed', 'skipped'].includes(x.lastView?.status ?? ''))) return { s, ok: false };
  return { s: { ...s, paper: [{ ...p, id: uid(), takenAt: nowSec, transitions: [{ at: new Date(nowSec * 1000).toISOString(), from: 'candidate', to: 'pending', reason: 'Paper entry requested; stop, horizon and targets stored' }] }, ...s.paper] }, ok: true };
}
export const removePaper = (s: State, id: string): State => ({ ...s, paper: s.paper.filter((x) => x.id !== id) });
/** Closing by hand stops the one-per-symbol lock but keeps the record; the tracker still shows what the rules did. */
export const archivePaper = (s: State, id: string): State => ({ ...s, paper: s.paper.map((x) => (x.id === id && !x.closedByUser ? { ...x, closedByUser: true, transitions: [...(x.transitions ?? []), { at: new Date().toISOString(), from: x.lastView?.status ?? 'pending', to: 'archived', reason: 'Archived by the user; this does not execute a market exit' }] } : x)) });

/** Record confirmed manual-paper state without changing its entry plan or removing its history. */
export function recordPaperView(s: State, id: string, view: View, at: string): State {
  const p = s.paper.find((x) => x.id === id); if (!p || view.dataNote || !['open', 'closed', 'skipped'].includes(view.status) || p.lastView?.status === 'closed' || p.lastView?.status === 'skipped') return s;
  if (JSON.stringify(p.lastView) === JSON.stringify(view)) return s;
  const from = p.lastView?.status ?? 'pending'; const events = [...(p.transitions ?? [])];
  if (from === 'pending' && ['open', 'closed'].includes(view.status)) events.push({ at, from, to: 'open', reason: 'Confirmed next-session entry from daily prices' });
  if (view.ladder?.t1Hit && !p.lastView?.ladder?.t1Hit) events.push({ at, from: 'open', to: 'partial', reason: 'Target 1 filled; stop moved to the entry price' });
  if (from !== view.status && view.status !== 'open') events.push({ at, from: view.status === 'closed' ? 'open' : from, to: view.status, reason: view.reason ?? view.skipReason ?? 'Explicit entry rule' });
  return { ...s, paper: s.paper.map((x) => x.id === id ? { ...x, lastView: view, transitions: events } : x) };
}

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
/** Import accepts only our own shape, version-checked and checked piece by piece; anything else is refused whole, with the reason, rather than merged half-way.
 *  A file that is the right version and the right outline but holds a damaged entry used to be accepted and then crashed the screens that read it, after it had been saved over the good data. */
export type BackupCheck = { ok: true; state: State } | { ok: false; reason: string };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A string field that older writers may have left out: absent is empty, anything else that is not text is damage. */
const strField = (o: Record<string, unknown>, k: string): string | null => (o[k] === undefined ? '' : isStr(o[k]) ? (o[k] as string) : null);
function checkEntry(e: unknown): Entry | null {
  if (!isObj(e) || !isStr(e.id) || !isStr(e.sym) || !Array.isArray(e.versions) || e.versions.length < 1) return null;
  const versions: Version[] = [];
  for (const v of e.versions) {
    if (!isObj(v) || !isStr(v.at)) return null;
    const f = Object.fromEntries(['thesis', 'support', 'counter', 'decision', 'invalidation', 'trigger'].map((k) => [k, strField(v, k)]));
    if (Object.values(f).some((x) => x === null) || !(v.reviewOn == null || isStr(v.reviewOn)) || !(v.question === undefined || isStr(v.question))) return null;
    versions.push({ ...(v as unknown as Version), ...(f as Record<string, string>), reviewOn: (v.reviewOn as string | null | undefined) ?? null });
  }
  return { ...(e as unknown as Entry), archived: !!e.archived, created: isStr(e.created) ? e.created : versions[0].at, versions };
}
const checkPlan = (p: unknown): Plan | null => (isObj(p) && isStr(p.id) && isStr(p.sym) && isNum(p.entry) && isNum(p.stop) && isNum(p.qty) ? { ...(p as unknown as Plan), at: isStr(p.at) ? p.at : '', rev: isNum(p.rev) ? p.rev : 1, riskPct: isNum(p.riskPct) ? p.riskPct : 0, note: isStr(p.note) ? p.note : '', status: p.status === 'paper-filled' || p.status === 'closed' ? p.status : 'saved', expiry: isStr(p.expiry) ? p.expiry : null } : null);
const checkPaper = (p: unknown): Paper | null => (isObj(p) && isStr(p.id) && isStr(p.sym) && isNum(p.ref) && isNum(p.stop) && isNum(p.qty) && isNum(p.takenAt) ? (p as unknown as Paper) : null);
const NUM_PREFS = ['equity', 'cash', 'riskPct', 'maxPositionPct'] as const;
/** Preferences are the one place a wrong type is repaired rather than refused: a bad value falls back to the default, because refusing a whole backup over a theme string would lose the journal with it. */
function checkPrefs(raw: unknown): Prefs {
  const p: Record<string, unknown> = isObj(raw) ? raw : {}; const D = DEFAULTS.prefs; const out: Record<string, unknown> = { ...D, ...p };
  for (const k of NUM_PREFS) if (!isNum(p[k]) || (p[k] as number) < 0) out[k] = D[k];
  if (p.motion !== 'auto' && p.motion !== 'off') out.motion = D.motion;
  if (typeof p.haptics !== 'boolean') out.haptics = D.haptics;
  if (!isStr(p.horizon)) out.horizon = D.horizon; if (!isStr(p.experience)) out.experience = D.experience;
  out.interests = Array.isArray(p.interests) ? p.interests.filter(isStr) : D.interests;
  if (p.motionV !== 2) { out.motion = 'off'; out.motionV = 2; }   // 27 Oct decision (PR #41): a backup from before it is moved to off once, as an ordinary load is
    if (p.chart !== undefined) { const c = p.chart as Record<string, unknown>; if (!isObj(p.chart) || (c.range !== undefined && !['1Y', '3Y', '5Y', '10Y', 'Max'].includes(String(c.range))) || (c.vs !== undefined && typeof c.vs !== 'boolean')) delete out.chart; }
    if (p.hideAmounts !== undefined && typeof p.hideAmounts !== 'boolean') delete out.hideAmounts; if (p.theme !== undefined && !isStr(p.theme)) delete out.theme;
  return out as unknown as Prefs;
}
export function checkBackup(text: string): BackupCheck {
  let d: unknown; try { d = JSON.parse(text); } catch { return { ok: false, reason: 'The file is not readable: it is not a JSON file.' }; }
  if (!isObj(d)) return { ok: false, reason: 'The file is not a Tripwire backup: it does not hold a saved state.' };
  if (d.app !== undefined && d.app !== 'tripwire') return { ok: false, reason: `The file is from another app (${String(d.app).slice(0, 30)}), not a Tripwire backup.` };
  if (d.v === undefined) return { ok: false, reason: 'The file has no Tripwire version number, so it is not a Tripwire backup.' };
  if (d.v !== VERSION) return { ok: false, reason: `The file is from version ${String(d.v).slice(0, 12)} of Tripwire; this one reads version ${VERSION}.` };
  for (const k of ['follows', 'entries', 'plans'] as const) if (!Array.isArray(d[k])) return { ok: false, reason: `The ${k === 'entries' ? 'journal' : k} section is missing or damaged.` };
  if (!(d.follows as unknown[]).every(isStr)) return { ok: false, reason: 'The followed names are damaged.' };
  const entries: Entry[] = []; for (const [i, e] of (d.entries as unknown[]).entries()) { const c = checkEntry(e); if (!c) return { ok: false, reason: `Journal entry ${i + 1} is damaged (it has no symbol, id or readable versions).` }; entries.push(c); }
  const plans: Plan[] = []; for (const [i, p] of (d.plans as unknown[]).entries()) { const c = checkPlan(p); if (!c) return { ok: false, reason: `Plan ${i + 1} is damaged (it has no symbol, id or readable prices).` }; plans.push(c); }
  const paperIn = d.paper === undefined ? [] : d.paper; if (!Array.isArray(paperIn)) return { ok: false, reason: 'The paper trades section is damaged.' };
  const paper: Paper[] = []; for (const [i, p] of paperIn.entries()) { const c = checkPaper(p); if (!c) return { ok: false, reason: `Paper trade ${i + 1} is damaged (it has no symbol, id or readable prices).` }; paper.push(c); }
  const compares = Array.isArray(d.compares) ? (d.compares as unknown[]).filter((c): c is string[] => Array.isArray(c) && c.every(isStr)) : [];
  const screens = Array.isArray(d.screens) ? (d.screens as unknown[]).filter((c): c is { name: string; f: Filters } => isObj(c) && isStr(c.name) && isObj(c.f)) : [];
  const snaps: State['snaps'] = {}; if (isObj(d.snaps)) for (const [sym, list] of Object.entries(d.snaps)) if (Array.isArray(list)) snaps[sym] = list.filter((x): x is Snap => isObj(x) && isStr(x.day) && isStr(x.at));
  const reviews = Array.isArray(d.reviews) ? (d.reviews as unknown[]).filter((r): r is { week: string; note: string } => isObj(r) && isStr(r.week) && isStr(r.note)) : [];
  const seen: NonNullable<State['seen']> = {}; if (isObj(d.seen)) for (const [sym, list] of Object.entries(d.seen)) if (Array.isArray(list)) seen[sym] = list.filter((x): x is SeenSnap => isObj(x) && isStr(x.at) && isStr(x.day));
  const inbox = Array.isArray(d.inbox) ? (d.inbox as unknown[]).filter((c): c is SeenChange => isObj(c) && isStr(c.id) && isStr(c.sym) && isStr(c.curAt)) : [];
  const dismissed: Record<string, string> = {}; if (isObj(d.dismissed)) for (const [k, v] of Object.entries(d.dismissed)) if (isStr(v)) dismissed[k] = v;
  // only the fields the app owns: the export's own wrapper (app, exported) must not leak into the saved state, and nothing unknown is carried along
  return { ok: true, state: { v: VERSION, follows: d.follows as string[], entries, plans, compares, screens, snaps, onboarded: !!d.onboarded, reviews, paper, seen, inbox, dismissed, prefs: checkPrefs(d.prefs), ...(d.signalAgreement ? { signalAgreement: agreementSettings(d.signalAgreement) } : {}), ...(d.storageNote ? { storageNote: true } : {}) } };
}
export function parseState(text: string): State | null { const c = checkBackup(text); return c.ok ? c.state : null; }
/** Merge a guest/device state into another (account migration): union by id, the longer version history wins, so nothing is lost. */
export function mergeStates(a: State, b: State): State {
  const byId = <T extends { id: string }>(x: T[], y: T[], pick: (p: T, q: T) => T) => { const m = new Map(x.map((i) => [i.id, i])); for (const i of y) m.set(i.id, m.has(i.id) ? pick(m.get(i.id)!, i) : i); return [...m.values()]; };
  return { ...a, ...((a.signalAgreement ?? b.signalAgreement) ? { signalAgreement: a.signalAgreement ?? b.signalAgreement } : {}), follows: [...new Set([...a.follows, ...b.follows])],
    entries: byId(a.entries, b.entries, (p, q) => (q.versions.length > p.versions.length ? q : p)),
    plans: byId(a.plans, b.plans, (p, q) => (q.rev > p.rev ? q : p)),
    compares: [...a.compares, ...b.compares.filter((c) => !a.compares.some((d) => d.join() === c.join()))],
    screens: [...a.screens, ...b.screens.filter((c) => !a.screens.some((d) => d.name === c.name))],
    paper: byId(a.paper ?? [], b.paper ?? [], (p, q) => {
      if (['closed', 'skipped'].includes(p.lastView?.status ?? '')) return p;
      if (['closed', 'skipped'].includes(q.lastView?.status ?? '') || (q.lastView?.sessions ?? -1) > (p.lastView?.sessions ?? -1)) return { ...p, lastView: q.lastView, transitions: q.transitions };
      return p;
    }),
    // weekly reviews: one per week, the longer note wins. Since-you-last-looked baselines: the union by day, so a restored device does not lose its history.
    reviews: (() => { const m = new Map((a.reviews ?? []).map((r) => [r.week, r])); for (const r of b.reviews ?? []) { const o = m.get(r.week); if (!o || r.note.length > o.note.length) m.set(r.week, r); } return [...m.values()]; })(),
    snaps: (() => { const out: State['snaps'] = { ...a.snaps }; for (const [sym, list] of Object.entries(b.snaps ?? {})) { const m = new Map((out[sym] ?? []).map((x) => [x.day, x])); for (const x of list) if (!m.has(x.day)) m.set(x.day, x); out[sym] = [...m.values()].sort((p, q) => p.day.localeCompare(q.day)); } return out; })(),
    seen: (() => { const out: NonNullable<State['seen']> = { ...(a.seen ?? {}) }; for (const [sym, list] of Object.entries(b.seen ?? {})) { const m = new Map((out[sym] ?? []).map((x) => [x.at, x])); for (const x of list) if (!m.has(x.at)) m.set(x.at, x); out[sym] = [...m.values()].sort((p, q) => p.at.localeCompare(q.at)).slice(-5); } return out; })(),
    inbox: (() => { const m = new Map((a.inbox ?? []).map((c) => [c.id, c])); for (const c of b.inbox ?? []) if (!m.has(c.id)) m.set(c.id, c); return [...m.values()].sort((p, q) => q.curAt.localeCompare(p.curAt)).slice(0, 50); })(),
    dismissed: { ...(b.dismissed ?? {}), ...(a.dismissed ?? {}) },
    ...(a.storageNote || b.storageNote ? { storageNote: true } : {}),
    // preferences: keep this device's, unless it has never been customised (a fresh install restoring a backup should get the backup's equity, risk and theme)
    // The motion choice is ignored in that test: a device saved before the default changed holds the old default ('off'), and counting it as a customisation would stop a clean install from restoring the backup's preferences.
    prefs: JSON.stringify({ ...a.prefs, haptics: true, motion: DEFAULTS.prefs.motion }) === JSON.stringify(DEFAULTS.prefs) ? { ...b.prefs } : a.prefs };
}
/** What is on this device, read defensively. Nothing readable is "no data yet"; something there that cannot be read is NOT the same, and the caller keeps a copy of it
 *  before anything is written over it. */
export function readSaved(text: string | null): { state: State; unreadable: boolean } {
  if (text == null || text === '') return { state: DEFAULTS, unreadable: false };
  const p = parseState(text); return p ? { state: p, unreadable: false } : { state: DEFAULTS, unreadable: true };
}
