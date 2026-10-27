// What the job fetches on one tick: the market searches, the official feeds, every paper-book name, and a rotating slice of the other covered names.
// Pure. The plan is bounded (BOUNDS below), so a tick is at most a few dozen requests whatever the universe size.
import { MARKET_QUERIES } from './config.js';

export const BOUNDS = { paperNames: 25, otherPerTick: 8 };
const LEGAL = /\b(ltd|limited|inc|corp|corporation|pvt|private)\b\.?/gi;
/** A search phrase from a company name: the legal suffix goes, the rest is quoted so the name stays together. */
export const companyQuery = (name, days = 7) => `"${String(name).replace(LEGAL, '').replace(/[^A-Za-z0-9 &.'\-]/g, ' ').replace(/\s+/g, ' ').trim()}" when:${days}d`;

/** Entities for the registry. `ledger`: parsed ledger.json (picks with `sym`). `covered`: parsed covered.json. `aliases`: parsed aliases.js. `universe`: optional rows [sym, sector, name, ...] from the published universe.
 *  A paper-book symbol with no name anywhere is reported as unresolved, not guessed. */
export function buildNames({ ledger, covered, aliases, universe = [] }) {
  const nameOf = new Map(); for (const r of universe) if (r?.[0] && r?.[2]) nameOf.set(r[0], r[2]); for (const c of covered?.names ?? []) nameOf.set(c.sym, c.name);
  const paper = [...new Set((ledger?.picks ?? []).map((p) => p.sym))].slice(0, BOUNDS.paperNames);
  const others = (covered?.names ?? []).map((c) => c.sym).filter((s) => !paper.includes(s));
  const unresolved = paper.filter((s) => !nameOf.has(s));
  const al = aliases?.aliases ?? {}; const mk = (sym) => ({ sym, name: nameOf.get(sym), aliases: al[sym] ?? [] });
  const entities = [...paper, ...others].filter((s) => nameOf.has(s)).map(mk);
  return { entities, paper: paper.filter((s) => nameOf.has(s)), covered: others, unresolved, names: Object.fromEntries(entities.map((e) => [e.sym, e.name])) };
}

/** The requests of one tick. `tick` is any integer that changes every cadence (floor of the time over 15 minutes); the other covered names rotate through it. */
export function queryPlan({ names, tick }) {
  const plan = [{ feed: 'rbi', query: null, scope: 'market' }, { feed: 'sebi', query: null, scope: 'market' }];
  for (const q of MARKET_QUERIES) plan.push({ feed: 'google', query: q, scope: 'market' });
  for (const s of names.paper) plan.push({ feed: 'google', query: companyQuery(names.names[s]), scope: 'paper', sym: s });
  const n = names.covered.length; if (n) { const per = Math.min(BOUNDS.otherPerTick, n); for (let i = 0; i < per; i++) { const s = names.covered[(tick * per + i) % n]; plan.push({ feed: 'google', query: companyQuery(names.names[s]), scope: 'covered', sym: s }); } }
  return plan;
}
