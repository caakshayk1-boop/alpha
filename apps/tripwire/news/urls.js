// URLs: what may be linked, what two URLs mean the same page, and which pages are not articles at all.

/** A short deterministic hash (cyrb53), hex. Not cryptographic: it names an item or an event, and the same input is the same name in the Worker, the job and the tests. */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** The URL to link to, or null. Only http(s), no credentials, no whitespace or control characters, a real host with a dot, and a sane length. Nothing else is ever put in an href. */
export function safeExternalUrl(u) {
  if (typeof u !== 'string') return null;
  const s = u.trim(); if (!s || s.length > 2048 || /[\s\u0000-\u001f\u007f<>"']/.test(s)) return null;
  let x; try { x = new URL(s); } catch { return null; }
  if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
  if (x.username || x.password) return null;
  if (!x.hostname.includes('.') || /^(localhost|\d{1,3}(\.\d{1,3}){3})$/.test(x.hostname)) return null;
  return x.toString();
}

const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ocid|cmpid|ref|ref_src|referrer|spm|share|amp|_hsenc|_hsmi|yclid|wt\.mc_id|ssp|guccounter)$/i;
/** One page, one name. Lower-case host without www/m/amp/mobile, no fragment, no default port, no tracking parameters, the rest of the query sorted, no trailing slash,
 *  no `/amp` ending, http read as https. Google News links (which are redirects, not the publisher's page) keep their path and drop the query. */
export function canonicalUrl(u) {
  const safe = safeExternalUrl(u); if (!safe) return null;
  const x = new URL(safe);
  const host = x.hostname.toLowerCase().replace(/^(www|m|amp|mobile)\./, '');
  let path = x.pathname.replace(/\/{2,}/g, '/').replace(/\/(amp|index\.html?)\/?$/i, '').replace(/\.amp$/i, '');
  if (path.length > 1) path = path.replace(/\/$/, ''); if (!path) path = '/';
  let query = '';
  if (host !== 'news.google.com') { const keep = [...x.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1)); query = keep.length ? '?' + keep.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : ''; }
  const port = x.port && x.port !== '80' && x.port !== '443' ? `:${x.port}` : '';
  return `https://${host}${port}${path}${query}`;
}
export const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

/** What a link is, from the address alone. `filing` is a dated document on an exchange or regulator host (accepted); `quote` and `landing` are pages that exist whatever happened today (rejected).
 *  The patterns are deliberately narrow: an unknown path is `article`, and the headline rules in rules.js get their say too. */
const QUOTE_PATH = [/\/stockpricequote\//i, /[-\/]share-?price(\/|-|$)/i, /[-\/]stock-?price(\/|-|$)/i, /\/stock-?quote/i, /\/stocks?\/[^/]+\/(quote|overview|price|chart|financials?)(\/|$)/i, /\/quote\/[A-Z0-9.:_-]+\/?$/i, /\/symbols\/[A-Z0-9:_-]+/i, /\/equities\/[a-z0-9-]+$/i, /\/stocks\/companyid-/i, /\/get-quotes\//i, /\/stocks?\/[a-z0-9-]+-[A-Z0-9]{3,12}\/?$/, /\/company\/[A-Za-z0-9&-]+\/?(consolidated\/?)?$/, /\/finance\/quote\//i, /\/stock-share-price\//i];
const LANDING_PATH = [/\/(corporate-)?announcements?\/?$/i, /\/corporates\/ann\.html/i, /\/corporate-filings-announcements/i, /\/companies-listing\/corporate-filings/i, /\/financial-results\/?$/i, /\/investor-relations?\/?$/i, /\/investors?\/?$/i, /\/(latest-)?news\/?$/i, /\/stocks?\/?$/i, /\/markets\/?$/i, /\/topic\/[a-z0-9-]+\/?$/i, /\/tag\/[a-z0-9-]+\/?$/i];
const FILING_PATH = [/\/xml-data\/corpfiling\/attach(live|his)\//i, /^\/corporate\/.+\.(pdf|xml|zip)$/i, /\/enforcement\/(orders|legal-framework)\/.+\.html$/i, /BS_PressReleaseDisplay\.aspx\?prid=\d+/i, /PressReleasePage\.aspx\?PRID=\d+/i, /\/web\/sebi_data\/attachdocs\//i, /\/press-?releases?\/[a-z0-9_-]{8,}/i];
export function urlKind(u) {
  const c = canonicalUrl(u); if (!c) return { kind: 'invalid', reason: 'bad_url' };
  const x = new URL(c); const host = x.hostname; const pq = x.pathname + (x.search || '');
  const official = ['nseindia.com', 'nsearchives.nseindia.com', 'bseindia.com', 'sebi.gov.in', 'rbi.org.in', 'pib.gov.in'].some((o) => host === o || host.endsWith('.' + o));
  if (FILING_PATH.some((r) => r.test(pq)) && (official || /\/press-?releases?\//.test(pq))) return { kind: 'filing', reason: null };
  if (official && /^\/corporate\//i.test(x.pathname) && /\.(pdf|xml)$/i.test(x.pathname)) return { kind: 'filing', reason: null };
  if (x.pathname === '/' && !x.search) return { kind: 'landing', reason: 'landing_page' };
  if (QUOTE_PATH.some((r) => r.test(pq))) return { kind: 'quote', reason: 'quote_page' };
  if (LANDING_PATH.some((r) => r.test(pq))) return { kind: 'landing', reason: 'landing_page' };
  return { kind: 'article', reason: null };
}
