/** The portable Research Card: one question, the evidence behind it, and what was missing, as a versioned JSON file that works
 *  without an account and never leaves the browser unless the person exports it. Pure functions, no DOM, so it is tested directly.
 *
 *  Rules: a field that was not available is `null`, never a guess; import validates every field, ignores what it does not
 *  recognise (and says so), and refuses a file from a newer version instead of half-reading it. */
export const CARD_SCHEMA = 'alpha.research-card';
export const LIBRARY_SCHEMA = 'alpha.research-library';
export const CARD_VERSION = 1;

export interface CardCompany { sym: string; name: string | null; price: number | null; priceAsOf: string | null }
export interface CardEvidence { text: string; side: 'for' | 'against'; source: string }
export interface CardEngine { engine: string; rankingStatus: string | null; tradingStatus: string | null; signalClose: number | null; stop: number | null; targets: number[] | null }
export interface CardStatus { id: string; asOf: string | null; refreshedAt: string | null; state: string }
export interface ResearchCard {
  schema: typeof CARD_SCHEMA;
  version: number;
  id: string;
  createdAt: string;
  question: string | null;
  query: { text: string | null; applied: string[]; ignored: string[]; matches: number | null } | null;
  companies: CardCompany[];
  comparison: { metric: string; values: Record<string, number | null> }[] | null;
  evidence: CardEvidence[] | null;
  engines: Record<string, CardEngine[]> | null;
  nextResults: Record<string, string | null> | null;
  dataStatus: CardStatus[];
  note: string | null;
}
export interface Library { schema: typeof LIBRARY_SCHEMA; version: number; exportedAt: string; watchlist: string[]; cards: ResearchCard[] }

const SYM = /^[A-Za-z0-9&-]{1,20}$/;
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const str = (v: unknown, max = 600): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (v: unknown): string | null => (typeof v === 'string' && ISO.test(v) ? v : null);
const strs = (v: unknown, n = 60, max = 300): string[] => (Array.isArray(v) ? v.map((x) => str(x, max)).filter((x): x is string => !!x).slice(0, n) : []);

export function newId(now = Date.now(), rand = Math.random()): string {
  return `rc-${now.toString(36)}-${Math.floor(rand * 36 ** 4).toString(36).padStart(4, '0')}`;
}

export function buildCard(p: Partial<ResearchCard> & { companies: CardCompany[] }, now = new Date()): ResearchCard {
  return {
    schema: CARD_SCHEMA, version: CARD_VERSION, id: p.id ?? newId(now.getTime()), createdAt: p.createdAt ?? now.toISOString(),
    question: p.question ?? null, query: p.query ?? null, companies: p.companies, comparison: p.comparison ?? null, evidence: p.evidence ?? null,
    engines: p.engines ?? null, nextResults: p.nextResults ?? null, dataStatus: p.dataStatus ?? [], note: p.note ?? null,
  };
}

export const serializeCard = (c: ResearchCard) => JSON.stringify(c, null, 2);
export const serializeLibrary = (watchlist: string[], cards: ResearchCard[], now = new Date()): string =>
  JSON.stringify({ schema: LIBRARY_SCHEMA, version: CARD_VERSION, exportedAt: now.toISOString(), watchlist, cards } satisfies Library, null, 2);

export type Parsed<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: string };

/** Validate one card from untrusted JSON. Unknown or malformed fields are dropped with a warning; missing ones stay null. */
export function normaliseCard(raw: unknown): Parsed<ResearchCard> {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'This is not a Research Card: the file is not a JSON object.' };
  const o = raw as Record<string, unknown>;
  if (o.schema !== CARD_SCHEMA) return { ok: false, error: `This is not an Alpha Research Card (schema "${String(o.schema ?? 'missing')}"). Export a card from Alpha's Follow page and import that file.` };
  const version = num(o.version);
  if (version === null || version < 1) return { ok: false, error: 'The card has no valid version number, so it cannot be read safely.' };
  if (version > CARD_VERSION) return { ok: false, error: `This card was made by a newer version of Alpha (version ${version}; this one reads up to ${CARD_VERSION}). Update Alpha, or export it again from the version that made it.` };
  const known = new Set(['schema', 'version', 'id', 'createdAt', 'question', 'query', 'companies', 'comparison', 'evidence', 'engines', 'nextResults', 'dataStatus', 'note']);
  for (const k of Object.keys(o)) if (!known.has(k)) warnings.push(`Ignored an unrecognised field: ${k}.`);

  const companies: CardCompany[] = [];
  for (const c of Array.isArray(o.companies) ? o.companies.slice(0, 60) : []) {
    const r = (c ?? {}) as Record<string, unknown>;
    if (typeof r.sym !== 'string' || !SYM.test(r.sym)) { warnings.push('Skipped a company with no valid symbol.'); continue; }
    companies.push({ sym: r.sym.toUpperCase(), name: str(r.name, 120), price: num(r.price), priceAsOf: iso(r.priceAsOf) });
  }
  if (!companies.length && !str(o.question)) return { ok: false, error: 'The card has neither a question nor any valid company, so there is nothing to import.' };

  const q = o.query && typeof o.query === 'object' ? (o.query as Record<string, unknown>) : null;
  const evidence = Array.isArray(o.evidence) ? o.evidence.map((e) => { const r = (e ?? {}) as Record<string, unknown>; const text = str(r.text, 400); return text && (r.side === 'for' || r.side === 'against') ? { text, side: r.side as 'for' | 'against', source: str(r.source, 120) ?? 'source not stated' } : null; }).filter((e): e is CardEvidence => !!e).slice(0, 12) : null;
  const engines: Record<string, CardEngine[]> | null = o.engines && typeof o.engines === 'object' ? {} : null;
  if (engines) for (const [sym, list] of Object.entries(o.engines as Record<string, unknown>)) {
    if (!SYM.test(sym) || !Array.isArray(list)) continue;
    engines[sym.toUpperCase()] = list.slice(0, 5).map((e) => { const r = (e ?? {}) as Record<string, unknown>; const engine = str(r.engine, 40); return engine ? { engine, rankingStatus: str(r.rankingStatus, 40), tradingStatus: str(r.tradingStatus, 40), signalClose: num(r.signalClose), stop: num(r.stop), targets: Array.isArray(r.targets) ? r.targets.map(num).filter((x): x is number => x !== null).slice(0, 3) : null } : null; }).filter((e): e is CardEngine => !!e);
  }
  const nextResults: Record<string, string | null> | null = o.nextResults && typeof o.nextResults === 'object' ? {} : null;
  if (nextResults) for (const [sym, d] of Object.entries(o.nextResults as Record<string, unknown>)) if (SYM.test(sym)) nextResults[sym.toUpperCase()] = iso(d);
  const comparison = Array.isArray(o.comparison) ? o.comparison.map((m) => { const r = (m ?? {}) as Record<string, unknown>; const metric = str(r.metric, 60); if (!metric || !r.values || typeof r.values !== 'object') return null; const values: Record<string, number | null> = {}; for (const [k, v] of Object.entries(r.values as Record<string, unknown>)) if (SYM.test(k)) values[k.toUpperCase()] = num(v); return { metric, values }; }).filter((m): m is NonNullable<typeof m> => !!m).slice(0, 40) : null;
  const dataStatus: CardStatus[] = Array.isArray(o.dataStatus) ? o.dataStatus.map((s) => { const r = (s ?? {}) as Record<string, unknown>; const id = str(r.id, 40); return id ? { id, asOf: iso(r.asOf), refreshedAt: iso(r.refreshedAt), state: str(r.state, 20) ?? 'unavailable' } : null; }).filter((s): s is CardStatus => !!s).slice(0, 12) : [];

  return {
    ok: true, warnings,
    value: {
      schema: CARD_SCHEMA, version, id: str(o.id, 60) ?? newId(), createdAt: iso(o.createdAt) ?? new Date(0).toISOString(), question: str(o.question, 300),
      query: q ? { text: str(q.text, 300), applied: strs(q.applied), ignored: strs(q.ignored), matches: num(q.matches) } : null,
      companies, comparison, evidence, engines, nextResults, dataStatus, note: str(o.note, 4000),
    },
  };
}

/** Read a card or a whole library from file text. Malformed JSON, the wrong schema and newer versions fail with a plain next step. */
export function parseImport(text: string): Parsed<{ cards: ResearchCard[]; watchlist: string[] }> {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That is not valid JSON. Import a file exported from Alpha, unedited.' }; }
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).schema === LIBRARY_SCHEMA) {
    const o = raw as Record<string, unknown>;
    const v = num(o.version);
    if (v === null || v < 1) return { ok: false, error: 'The library has no valid version number, so it cannot be read safely.' };
    if (v > CARD_VERSION) return { ok: false, error: `This library was made by a newer version of Alpha (version ${v}; this one reads up to ${CARD_VERSION}).` };
    const warnings: string[] = [];
    const cards: ResearchCard[] = [];
    for (const c of Array.isArray(o.cards) ? o.cards : []) {
      const r = normaliseCard(c);
      if (r.ok) { cards.push(r.value); warnings.push(...r.warnings); } else warnings.push(`Skipped a card: ${r.error}`);
    }
    const watchlist = Array.isArray(o.watchlist) ? o.watchlist.filter((s): s is string => typeof s === 'string' && SYM.test(s)).map((s) => s.toUpperCase()) : [];
    return { ok: true, value: { cards, watchlist }, warnings };
  }
  const one = normaliseCard(raw);
  return one.ok ? { ok: true, value: { cards: [one.value], watchlist: [] }, warnings: one.warnings } : one;
}

/** One line per card for a preview before anything is written. */
export const summarise = (c: ResearchCard): string => `${c.question ?? 'Untitled research'} · ${c.companies.length ? c.companies.map((x) => x.sym).slice(0, 6).join(', ') + (c.companies.length > 6 ? ` +${c.companies.length - 6}` : '') : 'no companies'} · ${c.createdAt.slice(0, 10)}`;
