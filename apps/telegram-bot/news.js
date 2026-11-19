// Top-10 news, no repeats. Pure functions (node --test runs them). Source: Tripwire's /api/news, which already clusters
// duplicate stories into one event; this adds a recency window, a ranking and a "never sent before" filter.
import { esc } from './commands.js';

export const NEWS_URL = 'https://tripwire.askakshay.com/api/news';
export const SLOT_HOURS = [8, 12, 16, 20, 0];   // local hours; 0 = midnight
export const MAX_AGE_H = 48;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Ranked candidates: recent, titled, deduped within the batch by id, url and headline. Most significant first. */
export function rank(events, nowMs) {
  const seen = new Set();
  const out = [];
  const list = (Array.isArray(events) ? events : [])
    .filter((e) => e && e.eventClusterId && e.headline && Date.parse(e.publishedAt) > nowMs - MAX_AGE_H * 3600e3 && Date.parse(e.publishedAt) <= nowMs + 3600e3)
    .sort((a, b) => (b.significance || 0) - (a.significance || 0) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  for (const e of list) {
    const keys = [e.eventClusterId, e.canonicalUrl && 'u:' + e.canonicalUrl, 'h:' + norm(e.headline)].filter(Boolean);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(e);
  }
  return out;
}

const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? String(u).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') : null);

export function format(items, label) {
  if (!items.length) return `<b>News ${esc(label)}</b>\nNo new stories since the last update.`;
  const lines = items.map((e, i) => {
    const u = safeUrl(e.canonicalUrl);
    const h = esc(e.headline);
    return `${i + 1}. ${u ? `<a href="${u}">${h}</a>` : h} <i>(${esc(e.sourceTitle || 'source n/a')})</i>`;
  });
  return `<b>Top ${items.length} news ${esc(label)}</b>\n${lines.join('\n')}\n<i>Source: Tripwire news feed. Not advice.</i>`;
}

/** Local clock parts for a timezone. */
export function localParts(nowMs, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

/** The cron fires at :00 and :30 UTC. A slot is the first half hour of a send hour, so half-hour zones (IST) and whole-hour zones both work.
 *  Returns a key like "2026-11-19T08" or null. The Durable Object claims the key so a repeated tick cannot send twice. */
export function slotKey(nowMs, tz, hours = SLOT_HOURS) {
  const { date, hour, minute } = localParts(nowMs, tz);
  return minute < 30 && hours.includes(hour) ? `${date}T${String(hour).padStart(2, '0')}` : null;
}
