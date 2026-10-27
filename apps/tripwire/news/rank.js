// The ranker: ONE deterministic function, versioned (RANKING_VERSION), documented here and on the News page.
//
//   score = 100 x ( 0.30 significance + 0.20 entity + 0.15 source + 0.20 recency + 0.05 novelty + 0.10 user )
//
//   significance  a fixed number per event type (events.js): 0.9 regulator action, 0.85 policy, 0.8 deal, 0.75 results, 0.7 filing ... 0.1 no event
//   entity        the best VERIFIED match confidence of a company the event names (entities.js); an India-wide macro event with no company is 0.6; unmatched is 0
//   source        the primary source's tier weight (config.TIERS), plus 0.05 for each further outlet that carried it, up to three
//   recency       exponential decay from the PUBLICATION time, half-life 36 h (24 h for policy and macro); an unknown publication time is 0
//   novelty       exp(-h / 6) where h is the LARGER of the hours since publication and the hours since the snapshot first saw it: re-fetching an old event does not make it new
//   user          1 for a name the reader follows, 0.7 for a paper-book name, otherwise 0; applied in the reader's browser, never in the shared snapshot (which carries 0)
//
// Nothing here reads the words of a headline for tone: "surges" and "slumps" score the same. No model is involved; this is a weighted sum and is not "AI analysis".
import { DIVERSITY, HALF_LIFE_H, WEIGHTS } from './config.js';

const H = 3600e3;
const ms = (iso) => (iso ? Date.parse(iso) : NaN);
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

/** The six factors of an event, each 0 to 1, at `nowMs`. `user` is 0 unless the caller passes the reader's relevance. */
export function rankFactors(ev, nowMs, user = 0) {
  const pub = ms(ev.publishedAt), first = ms(ev.firstSeenAt);
  const ageH = Number.isFinite(pub) ? Math.max(0, (nowMs - pub) / H) : null;
  const seenH = Number.isFinite(first) ? Math.max(0, (nowMs - first) / H) : null;
  const half = HALF_LIFE_H[ev.eventType] ?? HALF_LIFE_H.default;
  const verified = (ev.entities ?? []).reduce((m, e) => Math.max(m, e.confidence ?? 0), 0);
  const entity = verified > 0 ? verified : (ev.scopes ?? []).includes('market') ? 0.6 : 0;
  const recency = ageH == null ? 0 : 0.5 ** (ageH / half);
  const novelty = ageH == null ? 0 : Math.exp(-Math.max(ageH, seenH ?? ageH) / 6);
  const source = Math.min(1, (ev.sourceWeight ?? 0.4) + 0.05 * Math.min(3, ev.moreSources ?? 0));
  return { significance: ev.significance ?? 0, entity, source, recency, novelty, user };
}
export function rankScore(f) { let s = 0; for (const k of Object.keys(WEIGHTS)) s += WEIGHTS[k] * (f[k] ?? 0); return round(100 * s, 1); }
/** The factors with their weights and contributions, for the drawer. */
export function explain(f) { return Object.keys(WEIGHTS).map((k) => ({ k, value: round(f[k] ?? 0, 2), weight: WEIGHTS[k], points: round(100 * WEIGHTS[k] * (f[k] ?? 0), 1) })); }
/** One sentence on why an event is where it is. Built from the event's own facts. */
export function reasonLine(ev, f, nowMs) {
  const parts = [`${ev.eventType} (significance ${f.significance.toFixed(2)})`];
  const best = (ev.entities ?? [])[0]; if (best) parts.push(`${best.sym ?? best.name} matched on ${best.matchedOn} (${best.confidence.toFixed(2)})`); else if ((ev.scopes ?? []).includes('market')) parts.push('India-wide, no single company');
  parts.push(`${ev.sourceTitle ?? 'source'}${ev.sourceTier ? ` (${ev.sourceTier})` : ''}${ev.moreSources ? `, ${ev.moreSources} more ${ev.moreSources === 1 ? 'source' : 'sources'}` : ''}`);
  const pub = ms(ev.publishedAt); parts.push(Number.isFinite(pub) ? `published ${fmtAge((nowMs - pub) / H)} before this was ranked` : 'publication time unknown');
  return parts.join('; ');
}
const fmtAge = (h) => (h < 1 ? 'under an hour' : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`);

/** How much a reader's own lists lift an event: a followed name 1, a paper-book name 0.7, anything else 0. */
export function userRelevance(ev, { follows = [], paper = [] } = {}) {
  const syms = (ev.entities ?? []).map((e) => e.sym).filter(Boolean);
  if (syms.some((s) => follows.includes(s))) return 1;
  if (syms.some((s) => paper.includes(s))) return 0.7;
  return 0;
}
/** Events in rank order for `nowMs`. Ties break on publication time, then id, so the same input is the same order on every device. Returns new objects with `relevanceScore` and `factors`. */
export function rankEvents(events, nowMs, relevance = () => 0) {
  return events.map((ev) => { const factors = rankFactors(ev, nowMs, relevance(ev)); return { ...ev, factors, relevanceScore: rankScore(factors) }; })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || (ms(b.publishedAt) || 0) - (ms(a.publishedAt) || 0) || (a.eventClusterId < b.eventClusterId ? -1 : 1));
}

/** The company an event counts against for the diversity cap: its first verified entity, or null for a market story (market stories are not capped: there is no filler quota either way). */
export const companyOf = (ev) => { const e = (ev.entities ?? [])[0]; return e ? e.sym ?? e.name : null; };
/** A major event may exceed the per-company cap: a regulator or policy action or a deal (significance 0.8 or more) carried by an official source or by three or more outlets. Documented on the News page. */
export const isMajor = (ev) => (ev.significance ?? 0) >= 0.8 && (ev.sourceTier === 'official' || (ev.moreSources ?? 0) >= 2);

/** From a ranked list to the list shown: at most `perCompany` events of one company (default two) in the first `first` (default five), at most `extended` (three) in the first `max` (ten), a major event may take a third place
 *  in the first five. If fewer events qualify than the limit, fewer are returned: nothing is added to fill the page. */
export function diversify(ranked, { first = DIVERSITY.firstPage, max = DIVERSITY.maxToday, perCompany = DIVERSITY.perCompanyDefault, extended = DIVERSITY.perCompanyExtended, major = DIVERSITY.perCompanyMajor } = {}) {
  const picked = []; const count = new Map(); const take = (ev, cap) => { const c = companyOf(ev); if (c && (count.get(c) ?? 0) >= (isMajor(ev) ? Math.max(cap, major) : cap)) return false; picked.push(ev); if (c) count.set(c, (count.get(c) ?? 0) + 1); return true; };
  const left = [];
  for (const ev of ranked) { if (picked.length >= first) { left.push(ev); continue; } if (!take(ev, perCompany)) left.push(ev); }
  for (const ev of left) { if (picked.length >= max) break; take(ev, extended); }
  return picked;
}
