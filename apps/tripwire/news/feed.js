// Feed text to raw items. RSS 2.0 and Atom, Google News and Bing News quirks included. No network here, no clock: the caller passes the text and, for dates, the feed's own time zone.
// A raw item is { title, link, dateText, publisher, publisherUrl, description, guid }. Dates are parsed by `parseDate`, never by the browser's locale.

const ENT = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&', '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&rdquo;': '”', '&ldquo;': '“' };
/** Decode the entities a feed uses (named and numeric), once. `&amp;lt;` stays `&lt;`: it is decoded one level only. */
export function decode(s) {
  return String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => safeChar(+d)).replace(/&(lt|gt|quot|apos|amp|nbsp|rsquo|lsquo|ndash|mdash|hellip|rdquo|ldquo);/g, (m) => ENT[m] ?? m);
}
const safeChar = (n) => (n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '');
export const stripTags = (s) => decode(String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const field = (block, name) => { const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; };
const attr = (block, name, a) => { const m = block.match(new RegExp(`<${name}\\s[^>]*${a}\\s*=\\s*"([^"]*)"`, 'i')); return m ? decode(m[1]) : ''; };
const text = (block, name) => stripTags(field(block, name));

/** Bing's click-through link carries the real address in `url=`. Taken when it is there; the click link is kept when it is not. */
export function unwrapBing(link) {
  const m = String(link).match(/^https?:\/\/(?:www\.)?bing\.com\/news\/apiclick\.aspx\?.*?[?&]url=([^&]+)/i);
  if (!m) return link; try { return decodeURIComponent(m[1]); } catch { return link; }
}

/** Raw items from feed text. Items without a title or a link are dropped here (they cannot be anything); every other judgement is rules.js's. */
export function parseFeed(xml) {
  const out = []; const s = String(xml ?? '');
  for (const m of s.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const b = m[1]; let title = text(b, 'title'); const publisher = text(b, 'source') || text(b, 'News:Source'); const publisherUrl = attr(b, 'source', 'url');
    let link = text(b, 'link') || text(b, 'guid'); link = unwrapBing(link);
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3)).trim();
    out.push({ title, link, dateText: text(b, 'pubDate') || text(b, 'dc:date') || text(b, 'published') || '', publisher, publisherUrl, description: stripTags(field(b, 'description')), descriptionHtml: field(b, 'description'), guid: text(b, 'guid') });
  }
  for (const m of s.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const b = m[1]; const link = attr(b, 'link', 'href') || text(b, 'link');
    out.push({ title: text(b, 'title'), link, dateText: text(b, 'published') || text(b, 'updated'), publisher: text(b, 'name'), publisherUrl: '', description: stripTags(field(b, 'summary') || field(b, 'content')), descriptionHtml: field(b, 'summary'), guid: text(b, 'id') });
  }
  return out.filter((x) => x.title && x.link);
}

const ZONE = /(Z|GMT|UTC|UT|[+-]\d{2}:?\d{2}|\b(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|IST|BST|CET|CEST)\b)\s*$/i;
/** A feed date to `{ sec, assumed }`, or null when it is missing or unreadable. A date with no zone is read in `tz` (the feed's declared zone) and marked `assumed`, never as the reader's zone.
 *  `IST` is Indian Standard Time here (Date.parse does not know it). Returns seconds since the epoch, UTC. */
export function parseDate(txt, tz = 'UTC') {
  const s = String(txt ?? '').trim(); if (!s) return null;
  let t = s.replace(/\bIST\b/i, '+0530'); const hasZone = ZONE.test(s) || /\bIST\b/i.test(s);
  let ms = Date.parse(t);
  if (!hasZone) { const off = tz === 'Asia/Kolkata' ? 330 : 0; const a = Date.parse(t + ' UTC'), z = Date.parse(t + 'Z'); const v = Number.isFinite(a) ? a : z; ms = Number.isFinite(v) ? v - off * 60000 : NaN; }
  if (!Number.isFinite(ms) || ms <= Date.UTC(1990, 0, 1)) return null;
  return { sec: Math.floor(ms / 1000), assumed: !hasZone };
}
