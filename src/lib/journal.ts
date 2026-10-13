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
}

/** Entries needed in each group before an average is shown as anything but "too early to say". A judgement call, not a statistical test. */
export const MIN_ENTRIES = 5;
export const ACTIONS: readonly JournalAction[] = ['took', 'skipped', 'watching'];

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Build an entry from form text. Returns the problem as a sentence instead of throwing, so the form can show it. */
export function makeEntry(input: { date: string; sym: string; action: string; why: string; price: string; stop: string; target: string }, id: string): { entry: JournalEntry } | { error: string } {
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
  return { entry: { id, date: input.date, sym, action: input.action as JournalAction, why, price, stop, target } };
}

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
      out.push({ id: o.id, date: o.date, sym: o.sym.toUpperCase().slice(0, 20), action: o.action as JournalAction, why: o.why.slice(0, 2000), price: num(o.price), stop: num(o.stop), target: num(o.target) });
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
