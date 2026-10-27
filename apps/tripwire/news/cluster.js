// Many outlets, one event. Items that are the same story (the same page, or the same headline in other words) become ONE event with a primary source and "N more sources".
// Items about the same company that are different developments stay different events: a results night and a buyback are two events, "profit up 5%" and "profit down 3%" are two events.
import { hash } from './urls.js';

const STOP = new Set('a an the of to in on for and or at by with from as is are be its it this that after over into amid says said new will has have had was were than then also but not no up down'.split(' '));
/** Content words of a headline, lightly stemmed so "rises" and "rise", "profits" and "profit" meet. Numbers are kept as numbers ("5%" becomes "5"). */
const stem = (w) => { let s = w; if (s.length > 4 && /ies$/.test(s)) s = s.slice(0, -3) + 'y'; else if (s.length > 3 && /s$/.test(s) && !/ss$/.test(s)) s = s.slice(0, -1); if (s.length > 5 && /(ing|ed)$/.test(s)) s = s.replace(/(ing|ed)$/, ''); if (s.length > 3 && /e$/.test(s)) s = s.slice(0, -1); return s; };
export function tokens(headline) {
  return new Set(String(headline ?? '').toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/[‘’']s\b/g, '').replace(/[^a-z0-9. ]+/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, '')).filter((w) => w && !STOP.has(w) && (w.length > 2 || /^\d/.test(w)))
    .map((w) => (/^\d/.test(w) ? w : stem(w))));
}
/** The figures a headline states (a year is not a figure). Two headlines that both state figures and share none are reporting different things. */
const numbers = (tk) => new Set([...tk].filter((w) => /^\d+(\.\d+)?$/.test(w) && !/^(19|20)\d{2}$/.test(w)));
const overlap = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return { n, frac: a.size && b.size ? n / Math.min(a.size, b.size) : 0 }; };
const DAY72 = 72 * 3600;

/** True when two candidate items are the same event. Each item: `{ headline, tk, num, eventType, publishedSec, entities }`. Pure; symmetric. */
export function sameEvent(a, b) {
  if (a.canonicalUrl && a.canonicalUrl === b.canonicalUrl) return true;
  if (a.publishedSec != null && b.publishedSec != null && Math.abs(a.publishedSec - b.publishedSec) > DAY72) return false;
  const ea = new Set(a.entities.map((e) => e.sym ?? e.name)), eb = new Set(b.entities.map((e) => e.sym ?? e.name));
  const shared = [...ea].some((x) => eb.has(x));
  if ((ea.size || eb.size) && !shared) return false;                           // about different companies: never the same event
  const { n, frac } = overlap(a.tk, b.tk);
  const na = numbers(a.tk), nb = numbers(b.tk);
  if (na.size && nb.size && !overlap(na, nb).n) return false;                  // both state figures and none agrees: different developments ("up 5%" and "down 3%")
  if (a.eventType !== b.eventType && frac < 0.85) return false;                // different kinds of event need near-identical words to be one
  if (ea.size === 0 && eb.size === 0 && a.eventType !== b.eventType) return false;
  return n >= 4 && frac >= 0.7 || n >= 3 && frac >= 0.85;
}

/** Group items into events. Union-find over every pair inside the 72-hour window (items are few hundred at most). Each event's id is stable: when any member was in an earlier
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
