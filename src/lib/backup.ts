/** One backup file for everything My Desk keeps (T06/T07, 22 Oct 2026): followed companies, research cards, journal entries,
 *  conditions, saved screens and review snapshots, in one versioned JSON file. Pure functions, no DOM, tested directly in
 *  tests/backup.test.ts.
 *
 *  Merge policy, stated once and shown to the reader before anything is written:
 *  - Followed companies and conditions: union. A symbol (or a condition, ignoring case and spacing) already here is skipped.
 *  - Research cards and journal entries: matched by id. A new id is added. The same id is replaced only when the file's copy
 *    was edited later (updatedAt, else the card's createdAt); otherwise the copy in this browser is kept.
 *  - Saved screens: matched by name. An identical screen is skipped; a different screen of the same name replaces the one
 *    here only when the file's copy is dated later, otherwise this browser's copy is kept and the report says so.
 *  - Review snapshots: matched by symbol; the later snapshot wins.
 *  Nothing is ever deleted by an import, so importing the same file twice changes nothing the second time.
 *
 *  Safety: the file is data, never markup. Every string is length-capped and rendered as text; nothing in it is executed or
 *  inserted as HTML. A malformed file, a file from a newer version, and a file that is not Alpha's are refused with a reason. */
import { CARD_SCHEMA, LIBRARY_SCHEMA, normaliseCard, parseImport, type ResearchCard } from './card.ts';
import { parseCondition } from './conditions.ts';
import { parseJournal, type JournalEntry } from './journal.ts';
import { REVIEW_VERSION, type Snapshot } from './review.ts';

export const BACKUP_SCHEMA = 'alpha.backup';
export const BACKUP_VERSION = 1;
export const MAX_BYTES = 5_000_000;
/** Days after which an export is old enough to remind the reader to make a fresh one. */
export const BACKUP_STALE_DAYS = 14;

export const COLLECTIONS = ['watchlist', 'cards', 'journal', 'conditions', 'screens', 'reviews'] as const;
export type CollectionId = (typeof COLLECTIONS)[number];
export const COLLECTION_LABEL: Record<CollectionId, string> = {
  watchlist: 'Followed companies', cards: 'Research cards', journal: 'Journal entries', conditions: 'Conditions', screens: 'Saved screens', reviews: 'Review snapshots',
};

export interface SavedScreen { name: string; conds: { f: string; op: '>=' | '<='; v: string }[]; flags: string[]; sector: string; tier: string; nl?: { text: string; off: string[] }; savedAt?: string }
export interface DeskState { watchlist: string[]; cards: ResearchCard[]; journal: JournalEntry[]; conditions: string[]; screens: SavedScreen[]; reviews: Record<string, Snapshot> }
export interface Backup extends DeskState { schema: typeof BACKUP_SCHEMA; version: number; exportedAt: string }

export const emptyDesk = (): DeskState => ({ watchlist: [], cards: [], journal: [], conditions: [], screens: [], reviews: {} });
export const countOf = (s: Partial<DeskState>, c: CollectionId): number => { const v = s[c]; return Array.isArray(v) ? v.length : v ? Object.keys(v).length : 0; };
export const isEmptyDesk = (s: DeskState) => COLLECTIONS.every((c) => countOf(s, c) === 0);

export const serializeBackup = (s: DeskState, now = new Date()): string =>
  JSON.stringify({ schema: BACKUP_SCHEMA, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...s } satisfies Backup, null, 1);

/** Whether to show the backup reminder: something is saved and it was never exported, or not in the last 14 days. */
export function backupReminder(s: DeskState, lastExport: string | null, now = new Date()): 'never' | 'stale' | null {
  if (isEmptyDesk(s)) return null;
  if (!lastExport || Number.isNaN(Date.parse(lastExport))) return 'never';
  return now.getTime() - Date.parse(lastExport) > BACKUP_STALE_DAYS * 864e5 ? 'stale' : null;
}

const SYM = /^[A-Za-z0-9&-]{1,20}$/;
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null);
const isoOf = (v: unknown): string | null => (typeof v === 'string' && ISO.test(v) ? v : null);
const numOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function normaliseScreen(v: unknown): SavedScreen | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name, 80)?.trim();
  if (!name) return null;
  const conds = (Array.isArray(o.conds) ? o.conds : []).flatMap((c) => {
    const r = (c ?? {}) as Record<string, unknown>;
    return typeof r.f === 'string' && (r.op === '>=' || r.op === '<=') && (typeof r.v === 'string' || typeof r.v === 'number') ? [{ f: r.f.slice(0, 40), op: r.op as '>=' | '<=', v: String(r.v).slice(0, 20) }] : [];
  }).slice(0, 30);
  const strs = (x: unknown, n: number) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string').map((y) => y.slice(0, 60)).slice(0, n) : []);
  const nlo = o.nl && typeof o.nl === 'object' ? (o.nl as Record<string, unknown>) : null;
  const out: SavedScreen = { name, conds, flags: strs(o.flags, 30), sector: str(o.sector, 80) ?? '', tier: str(o.tier, 20) ?? '' };
  if (nlo && typeof nlo.text === 'string') out.nl = { text: nlo.text.slice(0, 300), off: strs(nlo.off, 30) };
  const at = isoOf(o.savedAt); if (at) out.savedAt = at;
  return out;
}

export function normaliseSnapshot(v: unknown): Snapshot | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const ver = numOf(o.v), at = isoOf(o.at);
  if (ver === null || ver < 1 || ver > REVIEW_VERSION || !at) return null;
  const s = (x: unknown) => str(x, 40);
  return { v: ver, at, data: isoOf(o.data), price: numOf(o.price), q: numOf(o.q), g: numOf(o.g), val: numOf(o.val), tech: numOf(o.tech), risk: s(o.risk), next: isoOf(o.next), elig: s(o.elig) };
}

export type ParsedFile = { ok: true; kind: 'backup' | 'library' | 'card' | 'journal'; data: Partial<DeskState>; exportedAt: string | null; warnings: string[] } | { ok: false; error: string };

/** Read any file Alpha has exported: this backup, the older research-library file, one research card, or a journal file.
 *  Only the collections the file actually carries are returned; a missing collection is reported, never treated as "empty". */
export function parseBackup(text: string): ParsedFile {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty, so there is nothing to import. Choose the file Alpha exported.' };
  if (text.length > MAX_BYTES) return { ok: false, error: 'The file is larger than 5 MB, which is far more than any Alpha export. Choose the file Alpha exported.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That is not valid JSON, so nothing was read. Import a file exported from Alpha, unedited.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'That JSON is not an Alpha export (it is not an object with a schema). Nothing was read.' };
  const o = raw as Record<string, unknown>;

  if (o.schema === LIBRARY_SCHEMA || o.schema === CARD_SCHEMA) {
    const r = parseImport(text);
    if (!r.ok) return r;
    const data: Partial<DeskState> = o.schema === LIBRARY_SCHEMA ? { watchlist: r.value.watchlist, cards: r.value.cards } : { cards: r.value.cards };
    return { ok: true, kind: o.schema === LIBRARY_SCHEMA ? 'library' : 'card', data, exportedAt: isoOf(o.exportedAt), warnings: [...r.warnings, o.schema === LIBRARY_SCHEMA ? 'This is an older research-library file: it carries followed companies and research cards only. Everything else here is left as it is.' : 'This is a single research card. Everything else here is left as it is.'] };
  }
  if (o.kind === 'alpha-journal') {
    const v = numOf(o.version);
    if (v !== null && v > 1) return { ok: false, error: `This journal file was made by a newer version of Alpha (version ${v}; this one reads version 1). Nothing was read.` };
    const n = Array.isArray(o.entries) ? o.entries.length : 0;
    const journal = parseJournal(text);
    return { ok: true, kind: 'journal', data: { journal }, exportedAt: null, warnings: [...(n > journal.length ? [`Skipped ${plural(n - journal.length, 'journal entry', 'journal entries')} that were not well-formed.`] : []), 'This is a journal file. Everything else here is left as it is.'] };
  }
  if (o.schema !== BACKUP_SCHEMA) return { ok: false, error: `This is not an Alpha backup (schema "${String(o.schema ?? 'missing').slice(0, 40)}"). Use "Export everything" on My Desk and import that file.` };
  const version = numOf(o.version);
  if (version === null || version < 1) return { ok: false, error: 'The backup has no valid version number, so it cannot be read safely. Nothing was read.' };
  if (version > BACKUP_VERSION) return { ok: false, error: `This backup was made by a newer version of Alpha (version ${version}; this one reads up to ${BACKUP_VERSION}). Nothing was read: open it with the newer Alpha, or export again from the version that made it.` };

  const warnings: string[] = [];
  const known = new Set<string>(['schema', 'version', 'exportedAt', ...COLLECTIONS]);
  for (const k of Object.keys(o)) if (!known.has(k)) warnings.push(`Ignored an unrecognised field: ${k.slice(0, 40)}.`);
  const data: Partial<DeskState> = {};
  const missing: string[] = [];
  const bad = (c: CollectionId) => warnings.push(`${COLLECTION_LABEL[c]} in the file are not in the expected shape, so they were not read. Yours are left as they are.`);
  for (const c of COLLECTIONS) {
    if (!(c in o)) { missing.push(COLLECTION_LABEL[c].toLowerCase()); continue; }
    const v = o[c];
    if (c === 'reviews') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) { bad(c); continue; }
      const out: Record<string, Snapshot> = {};
      let skipped = 0;
      for (const [sym, s] of Object.entries(v as Record<string, unknown>)) { const n = SYM.test(sym) ? normaliseSnapshot(s) : null; if (n) out[sym.toUpperCase()] = n; else skipped++; }
      if (skipped) warnings.push(`Skipped ${plural(skipped, 'review snapshot')} that could not be read.`);
      data.reviews = out;
      continue;
    }
    if (!Array.isArray(v)) { bad(c); continue; }
    if (c === 'watchlist') {
      const syms = v.filter((s): s is string => typeof s === 'string' && SYM.test(s)).map((s) => s.toUpperCase());
      if (syms.length < v.length) warnings.push(`Skipped ${plural(v.length - syms.length, 'followed entry', 'followed entries')} with no valid symbol.`);
      data.watchlist = [...new Set(syms)];
    } else if (c === 'cards') {
      const cards: ResearchCard[] = [];
      for (const x of v) { const r = normaliseCard(x); if (r.ok) cards.push(r.value); else warnings.push(`Skipped a research card: ${r.error}`); }
      data.cards = cards;
    } else if (c === 'journal') {
      const journal = parseJournal(JSON.stringify(v));
      if (journal.length < v.length) warnings.push(`Skipped ${plural(v.length - journal.length, 'journal entry', 'journal entries')} that were not well-formed.`);
      data.journal = journal;
    } else if (c === 'conditions') {
      const conds = v.filter((x): x is string => typeof x === 'string' && x.length <= 300 && !('message' in parseCondition(x))).map((x) => x.trim());
      if (conds.length < v.length) warnings.push(`Skipped ${plural(v.length - conds.length, 'condition')} that the parser could not read.`);
      data.conditions = conds;
    } else if (c === 'screens') {
      const screens = v.map(normaliseScreen).filter((x): x is SavedScreen => !!x);
      if (screens.length < v.length) warnings.push(`Skipped ${plural(v.length - screens.length, 'saved screen')} with no name.`);
      data.screens = screens;
    }
  }
  if (missing.length) warnings.push(`The file has no ${missing.join(', ')}; yours are left as they are.`);
  return { ok: true, kind: 'backup', data, exportedAt: isoOf(o.exportedAt), warnings };
}

export interface CollectionReport { added: number; updated: number; skipped: number }
export interface MergeResult { next: DeskState; report: Partial<Record<CollectionId, CollectionReport>>; notes: string[]; changed: CollectionId[] }

const condKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const later = (a: string | null | undefined, b: string | null | undefined) => !!a && (!b || a > b);
const cardStamp = (c: ResearchCard) => c.updatedAt ?? c.createdAt;
const screenBody = (s: SavedScreen) => { const { savedAt: _s, ...rest } = s; void _s; return JSON.stringify(rest); };

/** Merge what a file carries into what this browser holds, by the policy at the top of this file. Pure. */
export function mergeDesk(cur: DeskState, inc: Partial<DeskState>): MergeResult {
  const next: DeskState = { watchlist: [...cur.watchlist], cards: [...cur.cards], journal: [...cur.journal], conditions: [...cur.conditions], screens: [...cur.screens], reviews: { ...cur.reviews } };
  const report: Partial<Record<CollectionId, CollectionReport>> = {};
  const notes: string[] = [];
  const r = (c: CollectionId) => (report[c] ??= { added: 0, updated: 0, skipped: 0 });

  if (inc.watchlist) { const rep = r('watchlist'); for (const s of inc.watchlist) { if (next.watchlist.includes(s)) rep.skipped++; else { next.watchlist.push(s); rep.added++; } } }
  if (inc.conditions) { const rep = r('conditions'); const have = new Set(next.conditions.map(condKey)); for (const s of inc.conditions) { if (have.has(condKey(s))) rep.skipped++; else { next.conditions.push(s); have.add(condKey(s)); rep.added++; } } }
  if (inc.cards) {
    const rep = r('cards'); const fresh: ResearchCard[] = [];
    for (const c of inc.cards) {
      const i = next.cards.findIndex((x) => x.id === c.id);
      if (i < 0) { if (fresh.some((x) => x.id === c.id)) { rep.skipped++; continue; } fresh.push(c); rep.added++; }
      else if (later(cardStamp(c), cardStamp(next.cards[i]))) { next.cards[i] = c; rep.updated++; }
      else rep.skipped++;
    }
    next.cards = [...fresh, ...next.cards];       // newest first, as the library keeps them
  }
  if (inc.journal) {
    const rep = r('journal');
    for (const e of inc.journal) {
      const i = next.journal.findIndex((x) => x.id === e.id);
      if (i < 0) { next.journal.push(e); rep.added++; }
      else if (later(e.updatedAt, next.journal[i].updatedAt)) { next.journal[i] = e; rep.updated++; }
      else rep.skipped++;
    }
  }
  if (inc.screens) {
    const rep = r('screens');
    for (const s of inc.screens) {
      const i = next.screens.findIndex((x) => x.name === s.name);
      if (i < 0) { next.screens.push(s); rep.added++; }
      else if (screenBody(s) === screenBody(next.screens[i])) rep.skipped++;
      else if (later(s.savedAt, next.screens[i].savedAt)) { next.screens[i] = s; rep.updated++; }
      else { rep.skipped++; notes.push(`A saved screen named "${s.name}" differs from yours; yours was kept.`); }
    }
  }
  if (inc.reviews) {
    const rep = r('reviews');
    for (const [sym, s] of Object.entries(inc.reviews)) {
      const have = next.reviews[sym];
      if (!have) { next.reviews[sym] = s; rep.added++; }
      else if (later(s.at, have.at)) { next.reviews[sym] = s; rep.updated++; }
      else rep.skipped++;
    }
  }
  const changed = COLLECTIONS.filter((c) => { const x = report[c]; return !!x && x.added + x.updated > 0; });
  return { next, report, notes, changed };
}

/** The report in one line per collection, for the preview and the confirmation. */
export function reportLines(m: MergeResult): string[] {
  return COLLECTIONS.flatMap((c) => {
    const x = m.report[c];
    if (!x) return [];
    const parts = [x.added && `${x.added} added`, x.updated && `${x.updated} updated (the file's copy was edited later)`, x.skipped && `${x.skipped} already here, skipped`].filter(Boolean);
    return [`${COLLECTION_LABEL[c]}: ${parts.length ? parts.join(', ') : 'none in the file'}.`];
  });
}
