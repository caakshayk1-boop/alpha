/** Decision journal: why you took, skipped or watched a name, compared later with where the price is now.
 *  Kept in this browser only. The comparison uses today's price alone, so it cannot know whether the stop or a target
 *  was touched in between; it says so wherever it shows a result. With few entries it claims nothing. */

export type JournalAction = 'took' | 'skipped' | 'watching';
export interface JournalEntry {
  id: string;
  date: string;             // YYYY-MM-DD the decision was made
  sym: string;
  action: JournalAction;
  why: string;
  price: number | null;     // price at the time of the decision
  stop: number | null;
  target: number | null;
  /** What would make the idea wrong, in the user's words. Optional; written at decision time. */
  wrong?: string;
  /** The day the user wants to look again (YYYY-MM-DD). Optional; Alpha sends no reminder, the Journal only marks it due. */
  reviewBy?: string;
  /** A retrospective, written later. Kept apart from `why`, which stays the original thesis. */
  lesson?: string;
  /** When the entry was last edited (absent: never edited). The backup merge keeps the later copy of the same id. */
  updatedAt?: string;
  /** The market when the decision was recorded on its own day (Blueprint §4.2): the Barometer score and band and the Swing v2
   *  market-gate count. Only recorded for an entry made on the day it describes; a back-dated entry has none, never a guess. */
  regime?: JournalRegime;
}
export interface JournalRegime { barometer: number | null; gate: number | null; asOf: string | null }

/** Entries needed in each group before an average is shown as anything but "too early to say". A judgement call, not a statistical test. */
export const MIN_ENTRIES = 5;
export const ACTIONS: readonly JournalAction[] = ['took', 'skipped', 'watching'];

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Build an entry from form text. Returns the problem as a sentence instead of throwing, so the form can show it. */
export function makeEntry(input: { date: string; sym: string; action: string; why: string; price: string; stop: string; target: string; wrong?: string; reviewBy?: string; lesson?: string }, id: string): { entry: JournalEntry } | { error: string } {
  const sym = input.sym.trim().toUpperCase();
  if (!sym) return { error: 'Pick a company.' };
  if (!isDate(input.date)) return { error: 'The date must be a real date.' };
  if (!(ACTIONS as readonly string[]).includes(input.action)) return { error: 'Choose took, skipped or watching.' };
  const why = input.why.trim();
  if (why.length < 10) return { error: 'Write a sentence on why. That sentence is the part worth keeping.' };
  const parse = (s: string): number | null | 'bad' => { if (!s.trim()) return null; const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : 'bad'; };
  const price = parse(input.price), stop = parse(input.stop), target = parse(input.target);
  if (price === 'bad' || stop === 'bad' || target === 'bad') return { error: 'Price, stop and target must be numbers above zero, or left empty.' };
  if (price !== null && stop !== null && stop >= price) return { error: 'The stop must be below the price (this journal records long ideas).' };
  if (price !== null && target !== null && target <= price) return { error: 'The target must be above the price.' };
  const reviewBy = (input.reviewBy ?? '').trim();
  if (reviewBy && !isDate(reviewBy)) return { error: 'The review date must be a real date, or left empty.' };
  if (reviewBy && reviewBy < input.date) return { error: 'The review date comes before the decision date.' };
  const wrong = (input.wrong ?? '').trim().slice(0, 600), lesson = (input.lesson ?? '').trim().slice(0, 2000);
  return { entry: { id, date: input.date, sym, action: input.action as JournalAction, why, price, stop, target, ...(wrong ? { wrong } : {}), ...(reviewBy ? { reviewBy } : {}), ...(lesson ? { lesson } : {}) } };
}

/** An entry whose review date has arrived and which has no retrospective yet. */
export const reviewDue = (e: JournalEntry, today: string): boolean => !!e.reviewBy && e.reviewBy <= today && !e.lesson;

export type OutcomeState = 'no-price' | 'no-reference' | 'open' | 'below-stop' | 'above-target';
export interface Outcome { state: OutcomeState; movePct: number | null; r: number | null }

/** Where the price is now against the decision price. R needs a stop; a state needs a stop or target to compare with. */
export function outcome(e: JournalEntry, now: number | null): Outcome {
  if (now === null || !Number.isFinite(now)) return { state: 'no-price', movePct: null, r: null };
  if (e.price === null) return { state: 'no-reference', movePct: null, r: null };
  const movePct = (now - e.price) / e.price * 100;
  const r = e.stop !== null ? (now - e.price) / (e.price - e.stop) : null;
  const state: OutcomeState = e.stop !== null && now <= e.stop ? 'below-stop' : e.target !== null && now >= e.target ? 'above-target' : 'open';
  return { state, movePct, r };
}

export interface GroupSummary { action: JournalAction; entries: number; measured: number; avgMovePct: number | null; enough: boolean }

/** Average move since the decision, per action. Only entries that have a price now and a decision price are measured. */
export function summarise(list: JournalEntry[], priceOf: (sym: string) => number | null): GroupSummary[] {
  return ACTIONS.map((action) => {
    const mine = list.filter((e) => e.action === action);
    const moves = mine.map((e) => outcome(e, priceOf(e.sym)).movePct).filter((m): m is number => m !== null);
    const enough = moves.length >= MIN_ENTRIES;
    return { action, entries: mine.length, measured: moves.length, avgMovePct: enough ? moves.reduce((a, b) => a + b, 0) / moves.length : null, enough };
  });
}

/** Tolerant reader: drops anything that is not a well-formed entry rather than trusting stored data. */
export function parseJournal(raw: string | null): JournalEntry[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    const arr = Array.isArray(v) ? v : (v && typeof v === 'object' && Array.isArray((v as { entries?: unknown }).entries) ? (v as { entries: unknown[] }).entries : []);
    const out: JournalEntry[] = [];
    const seen = new Set<string>();
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      if (typeof o.id !== 'string' || !o.id || seen.has(o.id) || typeof o.sym !== 'string' || !o.sym || !isDate(o.date)) continue;
      if (!(ACTIONS as readonly unknown[]).includes(o.action) || typeof o.why !== 'string') continue;
      seen.add(o.id);
      out.push({ id: o.id, date: o.date, sym: o.sym.toUpperCase().slice(0, 20), action: o.action as JournalAction, why: o.why.slice(0, 2000), price: num(o.price), stop: num(o.stop), target: num(o.target), ...(typeof o.wrong === 'string' && o.wrong.trim() ? { wrong: o.wrong.slice(0, 600) } : {}), ...(isDate(o.reviewBy) ? { reviewBy: o.reviewBy } : {}), ...(typeof o.lesson === 'string' && o.lesson.trim() ? { lesson: o.lesson.slice(0, 2000) } : {}), ...(typeof o.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(o.updatedAt) ? { updatedAt: o.updatedAt } : {}), ...regimeOf(o.regime) });
    }
    return out;
  } catch { return []; }
}

export const serializeJournal = (list: JournalEntry[]): string => JSON.stringify({ kind: 'alpha-journal', version: 1, entries: list }, null, 1);

/** Merge an imported file into the current list: the same id keeps the existing entry, so importing twice changes nothing. */
export function mergeJournal(current: JournalEntry[], incoming: JournalEntry[]): JournalEntry[] {
  const ids = new Set(current.map((e) => e.id));
  return [...current, ...incoming.filter((e) => !ids.has(e.id))];
}

/** Link to the journal pre-filled from a signal: company, price, stop and first target. A missing or unusable number is left out, not guessed. */
export function journalHref(sym: string, price: number | null | undefined, stop: number | null | undefined, target: number | null | undefined): string {
  const q = new URLSearchParams({ s: sym });
  const put = (k: string, v: number | null | undefined) => { if (typeof v === 'number' && Number.isFinite(v) && v > 0) q.set(k, String(Math.round(v * 100) / 100)); };
  put('p', price); put('sl', stop); put('t', target);
  return `/journal/?${q.toString()}`;
}

const regimeOf = (v: unknown): { regime?: JournalRegime } => {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const n = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
  const r = { barometer: n(o.barometer, 0, 100), gate: n(o.gate, 0, 4), asOf: isDate(o.asOf) ? o.asOf : null };
  return r.barometer === null && r.gate === null ? {} : { regime: r };
};

/** The three regimes of the Blueprint's matrix, by the Barometer at entry. */
export const REGIMES = [{ id: 'strong', label: 'Barometer 65–100', lo: 65, hi: 100 }, { id: 'mixed', label: 'Barometer 40–64', lo: 40, hi: 64.999 }, { id: 'hostile', label: 'Barometer 0–39', lo: 0, hi: 39.999 }] as const;
export interface RegimeRow { id: string; label: string; entries: number; measured: number; enough: boolean; avgR: number | null; share: number | null; avgGate: number | null }
/** "Took it" decisions grouped by the market at entry: how many, and (with a stop and a price now) the average price
 *  follow-up in R and the share above the decision price. Price follow-up, not executed P&L; averages need MIN_ENTRIES. */
export function regimeMatrix(list: JournalEntry[], priceOf: (sym: string) => number | null): { rows: RegimeRow[]; unrecorded: number } {
  const took = list.filter((e) => e.action === 'took');
  const rows = REGIMES.map((g) => {
    const mine = took.filter((e) => e.regime?.barometer !== null && e.regime?.barometer !== undefined && e.regime.barometer >= g.lo && e.regime.barometer <= g.hi);
    const rs = mine.map((e) => outcome(e, priceOf(e.sym)).r).filter((r): r is number => r !== null);
    const gates = mine.map((e) => e.regime?.gate).filter((x): x is number => typeof x === 'number');
    const enough = rs.length >= MIN_ENTRIES;
    return { id: g.id, label: g.label, entries: mine.length, measured: rs.length, enough, avgR: enough ? rs.reduce((a, b) => a + b, 0) / rs.length : null, share: enough ? rs.filter((r) => r > 0).length / rs.length : null, avgGate: gates.length ? gates.reduce((a, b) => a + b, 0) / gates.length : null };
  });
  return { rows, unrecorded: took.filter((e) => !e.regime || e.regime.barometer === null).length };
}
