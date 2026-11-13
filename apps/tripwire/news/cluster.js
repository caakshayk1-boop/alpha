// Many outlets, one event. Items that are the same story (the same page, the same title, or the same headline in other words) become ONE event with a primary source and "N more sources".
// Items about the same company that are different developments stay different events: a results night and a buyback are two events, "profit up 5%" and "profit down 3%" are two events.
import { hash } from './urls.js';

const STOP = new Set('a an the of to in on for and or at by with from as is are be its it this that after over into amid says said new will has have had was were than then also but not no up down'.split(' '));
/** Content words of a headline, lightly stemmed so "rises" and "rise", "profits" and "profit" meet. Numbers are kept as numbers ("5%" becomes "5"). */
const stem = (w) => { let s = w; if (/^acquisitions?$/.test(s)) return 'acquir'; if (s.length > 4 && /ies$/.test(s)) s = s.slice(0, -3) + 'y'; else if (s.length > 3 && /s$/.test(s) && !/ss$/.test(s)) s = s.slice(0, -1); if (s.length > 5 && /(ing|ed)$/.test(s)) s = s.replace(/(ing|ed)$/, ''); if (s.length > 3 && /e$/.test(s)) s = s.slice(0, -1); return s; };
export function tokens(headline) {
  return new Set(String(headline ?? '').toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/[‘’']s\b/g, '').replace(/[^a-z0-9. ]+/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, '')).filter((w) => w && !STOP.has(w) && (w.length > 2 || /^\d/.test(w) || /^q[1-4]$/.test(w)))
    .map((w) => (/^\d/.test(w) ? w : stem(w))));
}
/** The figures a headline states (a year is not a figure). Two headlines that both state figures and share none are reporting different things. */
const numbers = (tk) => new Set([...tk].filter((w) => /^\d+(\.\d+)?$/.test(w) && !/^(19|20)\d{2}$/.test(w)));
/** 13 Nov 2026 (news-pipe-4): one amount, told in different units, is ONE figure. "₹20 lakh" and "2 Million Rupees" are 2,000,000; "24,000 Cr" and "24 000 cr" are the same number (a thousands group may be a comma or a space).
 *  Only an amount with a unit word is normalised (a bare "20" stays the bare token it was), and only the unit words below; currencies are NOT converted (a dollar amount never equals a rupee amount). */
const UNIT = { thousand: 1e3, k: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, million: 1e6, mn: 1e6, m: 1e6, crore: 1e7, crores: 1e7, cr: 1e7, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12, tn: 1e12 };
export function amounts(headline) {
  const out = new Set(); const t = String(headline ?? '').toLowerCase();
  const re = /(\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(thousand|lakhs?|lacs?|crores?|cr|million|mn|billion|bn|trillion|tn|k|m|b)\b/g; let m;
  while ((m = re.exec(t))) {
    const v = Number(m[1].replace(/[ ,]/g, '')) * UNIT[m[2]]; if (!Number.isFinite(v) || v <= 0) continue;
    // 13 Nov 2026 (Codex on #64): the currency is part of the figure. "₹20 lakh" and "$2 million" are both 2,000,000 and are NOT the same amount. A currency is read from the symbol or word just before or after the amount;
    // none stated is its own kind ("?"), which never equals a stated one (conservative: a missed merge is a visible duplicate, a wrong merge hides a story).
    const before = t.slice(Math.max(0, m.index - 5), m.index), after = t.slice(m.index + m[0].length, m.index + m[0].length + 14);
    const cur = /(₹|\brs\.?|\binr)\s*$/.test(before) || /^\s*(rupees?|inr)\b/.test(after) ? 'I' : /(\$|\bus\$|\busd)\s*$/.test(before) || /^\s*(dollars?|usd)\b/.test(after) ? 'U' : '?';
    out.add('A' + cur + Number(v.toPrecision(5)));
  }
  return out;
}
const figures = (headline, tk) => { const s = numbers(tk); for (const a of amounts(headline)) s.add(a); return s; };
const overlap = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return { n, frac: a.size && b.size ? n / Math.min(a.size, b.size) : 0 }; };
const DAY72 = 72 * 3600;
/** Two reports of one company event must be this close in time to merge on a shared distinctive word alone (no figure needed). */
export const SAME_EVENT_SEC = 36 * 3600;

// 12 Nov 2026 (news-pipe-3): smart dedupe.
/** A headline as a title: case, punctuation, a leading "Exclusive:" and a trailing " - Outlet" removed. One headline carried by two outlets (or two feeds) normalises to one string. */
const LEAD = /^\s*(exclusive|breaking( news)?|just in|watch|video|live|updated?|opinion|analysis|explained|top story)\s*[:\-–—|]\s*/i;
export function normTitle(headline) {
  let t = String(headline ?? '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3 && LEAD.test(t); i++) t = t.replace(LEAD, '');
  const m = /^(.{15,}?)\s+[-–—|]\s+[^-–—|]{2,45}$/.exec(t); if (m) t = m[1];                 // " - Mint", " | Moneycontrol"
  return t.toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/&/g, ' and ').replace(/[^a-z0-9. ]+/g, ' ').replace(/\s\.|\.\s|^\.+|\.+$/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Words every company event uses, which say nothing about WHICH event it is. A shared word outside this list (and outside the company's own name) is distinctive. */
const GENERIC = new Set(`acquire acquires acquired acquisition acquiring buy buys bought sell sells sold sale stake deal deals pact signs signed sign inks inked wins win won bags bag secures secured order orders contract contracts
  announce announces announced reports report reported posts posted post results result quarter quarterly annual profit profits loss losses revenue revenues income earnings sales growth net crore crores lakh lakhs rs rupee rupees million billion mn bn cr
  board approves approved approval approve meeting dividend interim final record date share shares stock stocks price company companies limited ltd inc llc plc corp corporation group india indian services service business businesses industries industry enterprises solutions technologies technology global
  new expand expands expanding expansion enhance enhanced enhancing strengthen strengthens boost boosts capabilities capability regulatory risk compliance financial finance market markets investor investors shareholders promoter promoters
  plan plans launch launches launched subsidiary unit arm entity firm firms completes completed complete completion proposes proposed proposal seeks seek gets get gives given set sets says said week today monday tuesday wednesday thursday friday saturday sunday
  january february march april may june july august september october november december jv partnership strategic agreement bank banks banking capital fund funds raise raises raised issue issues allotment shareholder through amid across over under after before during about
  positive strong higher lower rise rises rose fall falls fell jump jumps surge surges gain gains drop drops slump slumps decline declines performance key major big top first second third fourth full year years month months
  appoints appointed appoint appointment names named chief officer director executive chairman managing ceo cfo md rating ratings upgrade upgrades downgrade downgrades target update updates news latest`.split(/\s+/).filter(Boolean).map((w) => stem(w)));
/** The words an outlet capitalised: a proper noun, or a brand written "RegEdge" or "eClerx". A lower-case word is never a name, so it is never distinctive. */
function properTokens(headline) {
  const out = new Set();
  for (const raw of String(headline ?? '').replace(/[‘’']s\b/g, '').split(/\s+/)) {
    const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''); if (w.length < 3) continue;
    if (/^[A-Z]/.test(w) || /^[a-z]+[A-Z]/.test(w)) { const t = w.toLowerCase().replace(/[^a-z0-9]/g, ''); if (t) out.add(stem(t)); }
  }
  return out;
}
/** The company's own name, as tokens: "eClerx Services Ltd." contributes eclerx and servic, so the company's name is never what two reports are said to share. */
function entityTokens(entities) {
  const out = new Set(); for (const e of entities ?? []) for (const s of [e.name, e.sym, e.matchedOn]) if (s) for (const t of tokens(s)) out.add(t);
  return out;
}
/** The words two headlines share that name THE event: capitalised in both, not part of the company's own name, not a word every company event uses, not a figure. */
export function distinctiveShared(a, b) {
  const own = entityTokens([...(a.entities ?? []), ...(b.entities ?? [])]); const pa = properTokens(a.headline), pb = properTokens(b.headline); const out = [];
  for (const t of a.tk) if (b.tk.has(t) && pa.has(t) && pb.has(t) && t.length >= 4 && !/^\d/.test(t) && !GENERIC.has(t) && !own.has(t) && !/^(q[1-4]|fy\d+)$/.test(t)) out.push(t);
  return out;
}
const UP = /\b(rise|rises|rose|rising|jump|jumps|jumped|surge|surges|surged|gain|gains|gained|climb|climbs|climbed|soar|soars|soared|rally|rallies|rallied|higher|up|beats?|upgrades?|upgraded|grows?|grew)\b/i;
const DOWN = /\b(fall|falls|fell|falling|drop|drops|dropped|slump|slumps|slumped|plunge|plunges|plunged|decline|declines|declined|down|lower|slip|slips|slipped|dip|dips|dipped|tumble|tumbles|tumbled|misses|missed|downgrades?|downgraded|shrinks?|shrank)\b/i;
/** True when one headline says the thing went up and the other says it went down (and neither says both). */
const opposite = (a, b) => { const au = UP.test(a), ad = DOWN.test(a), bu = UP.test(b), bd = DOWN.test(b); return (au && !ad && bd && !bu) || (ad && !au && bu && !bd); };

/** True when two candidate items are the same event. Each item: `{ headline, tk, eventType, publishedSec, entities, canonicalUrl, scope }`. Pure; symmetric.
 *  Merges when: it is the same page; the same title (case, punctuation, a " - Outlet" tail aside); the same company, the same kind of event and a shared figure (told in different words); the same company and
 *  kind of event within 36 hours sharing a DISTINCTIVE word, no figure needed ("eClerx acquires RegEdge" told by two outlets); or nearly the same words.
 *  Never when the figures differ, when one says up and the other down, when the kind of event differs without near-identical words, when the companies differ, or across the global/India line. */
export function sameEvent(a, b) {
  if ((a.scope === 'global') !== (b.scope === 'global')) return false;         // 12 Nov 2026: a global headline and an India one are never one event
  if (a.canonicalUrl && a.canonicalUrl === b.canonicalUrl) return true;
  if (a.publishedSec != null && b.publishedSec != null && Math.abs(a.publishedSec - b.publishedSec) > DAY72) return false;
  const ea = new Set(a.entities.map((e) => e.sym ?? e.name)), eb = new Set(b.entities.map((e) => e.sym ?? e.name));
  const shared = [...ea].some((x) => eb.has(x));
  if ((ea.size || eb.size) && !shared) return false;                           // about different companies: never the same event
  const { n, frac } = overlap(a.tk, b.tk);
  const na = figures(a.headline, a.tk), nb = figures(b.headline, b.tk);
  if (na.size && nb.size && !overlap(na, nb).n) return false;                  // both state figures and none agrees: different developments ("up 5%" and "down 3%")
  if (opposite(a.headline, b.headline)) return false;                          // "profit rises" and "profit falls" are two developments even when neither states a figure
  if (a.tk.size >= 3 && b.tk.size >= 3 && normTitle(a.headline) === normTitle(b.headline)) return true;   // the same headline, carried twice
  if (a.eventType !== b.eventType && frac < 0.85) return false;                // different kinds of event need near-identical words to be one
  if (ea.size === 0 && eb.size === 0 && a.eventType !== b.eventType) return false;
  // the same kind of event, the same company, within a day and a half: one results night, one buyback, one deal, one policy decision, told with different words
  const near = a.publishedSec != null && b.publishedSec != null && Math.abs(a.publishedSec - b.publishedSec) <= SAME_EVENT_SEC;
  const kind = a.eventType === b.eventType && !['Update', 'People', 'Rating'].includes(a.eventType);
  if (kind && shared && near && na.size && nb.size && overlap(na, nb).n && n >= 3) return true;   // ... stating a figure they agree on
  if (kind && shared && near && n >= 2 && distinctiveShared(a, b).length > 0) return true;        // 12 Nov 2026: ... naming the same other party, product or place; no figure needed
  return n >= 4 && frac >= 0.7 || n >= 3 && frac >= 0.85;
}

/** Group items into events. Union-find over every pair inside the 72-hour window (the pipeline keeps 2 days) (items are few hundred at most). Each event's id is stable: when any member was in an earlier
 *  snapshot the event keeps that snapshot's id (`prevCluster`: itemId to clusterId, lowest id wins), so a story does not become a new event because another outlet repeated it. */
export function clusterItems(items, prevCluster = new Map()) {
  const order = items.slice().sort((x, y) => (x.publishedSec ?? 0) - (y.publishedSec ?? 0) || (x.itemId < y.itemId ? -1 : 1));
  const parent = order.map((_, i) => i); const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) { if (sameEvent(order[i], order[j])) parent[find(j)] = find(i); }
  const groups = new Map(); order.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
  const out = [];
  for (const members of groups.values()) {
    const prevIds = members.map((m) => prevCluster.get(m.itemId)).filter(Boolean).sort();
    const first = members.slice().sort((x, y) => x.itemId < y.itemId ? -1 : 1)[0];
    out.push({ eventClusterId: prevIds[0] ?? `ev_${hash(first.itemId)}`, members });
  }
  const seen = new Set(); for (const g of out) { let id = g.eventClusterId; while (seen.has(id)) id = `${id}x`; seen.add(id); g.eventClusterId = id; }   // two old clusters merged into one keep one id; a split never reuses it
  return out.sort((a, b) => (a.eventClusterId < b.eventClusterId ? -1 : 1));
}
