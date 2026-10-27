// The news pipeline's constants, in one place so the documentation drawer, the ranker and the tests read the same numbers.
// Everything here is plain data. Nothing in this folder calls a model: the event types are keyword rules and the ranker is a weighted sum.
// The folder is imported by the Worker (bundled by wrangler), by the scheduled Node job (run.mjs) and by the tests, so it uses no Node or browser API.

export const SCHEMA = 'tripwire-news/1';
export const STATUS_SCHEMA = 'tripwire-news-status/1';
export const QUERY_SCHEMA = 'tripwire-news-q/1';
/** Bump when a validation, classification or clustering rule changes (what is admitted, and how it is grouped). */
export const PIPELINE_VERSION = 'news-pipe-1';
/** Bump when a weight, half-life or tier below changes (only the order changes, never what is admitted). */
export const RANKING_VERSION = 'news-rank-1';

/** Source reliability, by tier. Publishers are matched by name or host; anything not listed is `unknown`. The numbers feed `rank.js` and are printed on the News page. */
export const TIERS = { official: 1.0, wire: 0.85, major: 0.8, known: 0.6, unknown: 0.4, aggregator: 0.2 };
const OFFICIAL = ['nseindia.com', 'nsearchives.nseindia.com', 'bseindia.com', 'sebi.gov.in', 'rbi.org.in', 'pib.gov.in', 'mca.gov.in', 'finmin.nic.in', 'incometaxindia.gov.in'];
const WIRE = ['reuters', 'pti', 'press trust of india', 'bloomberg', 'ani', 'ians'];
const MAJOR = ['the economic times', 'economic times', 'economictimes.indiatimes.com', 'mint', 'livemint', 'business standard', 'the hindu businessline', 'hindu businessline', 'the hindu', 'moneycontrol', 'cnbc-tv18', 'cnbctv18', 'ndtv profit', 'financial express', 'the financial express', 'business today', 'the times of india', 'times of india', 'indian express', 'the indian express', 'hindustan times', 'forbes india', 'fortune india', 'the print', 'theprint', 'scroll', 'bbc', 'the new indian express'];
const KNOWN = ['zee business', 'business insider', 'india today', 'firstpost', 'news18', 'outlook business', 'businessline', 'the week', 'deccan herald', 'deccan chronicle', 'the tribune', 'rediff', 'rediff money', 'investing.com', 'marketscreener', 'tipranks', 'simply wall st', 'benzinga', 'exchange4media', 'the free press journal', 'free press journal', 'asian news international', 'the statesman', 'telangana today', 'devdiscourse', 'inc42', 'entrackr', 'yourstory'];
const AGGREGATOR = ['tradingview', 'univest', 'stockedge', 'trendlyne', 'groww', 'tickertape', 'screener', 'upstox', 'zerodha', 'angel one', 'five paisa', '5paisa', 'whalesbook', 'dailyhunt', 'newsbreak', 'msn', 'yahoo', 'ticker', 'marketsmojo', 'marketsmith', 'investorsobserver', 'stocktwits', 'telegraphindia', 'google', 'bing'];
const has = (list, s) => list.some((x) => s === x || s.includes(x));
/** `{ tier, weight }` for a publisher name and the host of its link. Official means a regulator, an exchange or a ministry: a company's own filing carried by one of these hosts. */
export function sourceTier(name, host) {
  const n = String(name || '').toLowerCase().trim(); const h = String(host || '').toLowerCase().replace(/^www\./, '');
  let tier = 'unknown';
  if (OFFICIAL.some((o) => h === o || h.endsWith('.' + o))) tier = 'official';
  else if (has(AGGREGATOR, n)) tier = 'aggregator';
  else if (has(WIRE, n)) tier = 'wire';
  else if (has(MAJOR, n)) tier = 'major';
  else if (has(KNOWN, n)) tier = 'known';
  return { tier, weight: TIERS[tier] };
}

/** The ranker's weights. They sum to 1 and are printed as such. Documented in `rank.js`. */
export const WEIGHTS = { significance: 0.30, entity: 0.20, source: 0.15, recency: 0.20, novelty: 0.05, user: 0.10 };
/** Recency half-life in hours, by event type (policy and macro stories age faster than a results night). */
export const HALF_LIFE_H = { Policy: 24, Macro: 24, default: 36 };
/** How old an event may be to appear on Today, by scope, in hours. The archive on the News page keeps MAX_AGE_DAYS. */
export const TODAY_WINDOW_H = { company: 72, market: 48 };
export const MAX_AGE_DAYS = 14;
/** A timestamp this far past the check is not a clock skew, it is a wrong date: quarantined, not shown. */
export const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;
export const VERIFIED = 0.6;          // an entity match at or above this is "verified"
export const DIVERSITY = { perCompanyDefault: 2, perCompanyExtended: 3, perCompanyMajor: 3, firstPage: 5, maxToday: 10 };
export const LIMITS = { events: 250, itemsPerEvent: 4, sourcesPerEvent: 6 };

/** Cadence, in minutes, by NSE session. The exchange calendar decides which instant is a session (src/calendar.ts). */
export const CADENCE = { session: 15, off: 30 };
/** A snapshot older than this many cadences (plus grace) is delayed: a missed tick, or two, is GitHub's cron being late; a third is not. */
export const DELAY_AFTER = { cadences: 2, graceMin: 10 };

/** The feeds the job reads. `summary: true` only for a feed whose own item description is the publisher's summary of its own release (an official feed). */
export const FEEDS = {
  google: { id: 'google-news', label: 'Google News (RSS search)', kind: 'search', summary: false, tz: 'UTC', url: (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en` },
  bing: { id: 'bing-news', label: 'Bing News (RSS search)', kind: 'search', summary: false, tz: 'UTC', url: (q) => `https://www.bing.com/news/search?q=${encodeURIComponent(q.replace(/\s*when:\d+d/g, '').trim())}&format=rss&setmkt=en-IN` },
  rbi: { id: 'rbi-press', label: 'RBI press releases (RSS)', kind: 'official', summary: true, publisherName: 'Reserve Bank of India', tz: 'Asia/Kolkata', url: () => 'https://rbi.org.in/pressreleases_rss.xml' },
  sebi: { id: 'sebi-releases', label: 'SEBI press releases and orders (RSS)', kind: 'official', summary: true, publisherName: 'SEBI', tz: 'Asia/Kolkata', url: () => 'https://www.sebi.gov.in/sebirss.xml' },
};

/** The market-wide searches. Plain words: Bing returns nothing for an OR query. */
export const MARKET_QUERIES = ['Sensex Nifty when:2d', 'RBI repo rate when:2d', 'SEBI circular order when:2d', 'India inflation rupee crude when:2d'];
