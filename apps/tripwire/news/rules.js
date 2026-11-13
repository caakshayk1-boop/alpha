// Validation and noise rejection. Every refusal has a CODE, and the codes are counted in the snapshot, so "why is there nothing here" has an answer.
// Plain regular expressions and thresholds. Nothing is scored here and nothing is learned: a headline is admitted or it is not.
import { FUTURE_TOLERANCE_MS, MAX_AGE_DAYS } from './config.js';
import { urlKind } from './urls.js';

export const REJECT = {
  bad_url: 'The link is missing, malformed or not http(s).', bad_title: 'No usable headline.', future_timestamp: 'Dated in the future: quarantined, not shown.', stale: `Older than ${MAX_AGE_DAYS} days.`,
  non_english: 'Not English, or mixed-language filler.', landing_page: 'A section, announcements index or company landing page, not a dated event.', quote_page: 'A share-price or quote page that exists whatever happened today.',
  evergreen_title: 'A headline that names a standing page ("share price today", "announcements"), not an event.', technical_commentary: 'Routine price or chart commentary.', stocks_to_watch: 'A list of stocks to watch, buy or trade.',
  market_recap: 'A market preview or wrap (Gift Nifty, closing bell, live blog).', promotional: 'Promotional or tip-sheet language.', international: 'About another country\'s market, with nothing Indian in it.',
  no_entity: 'Names no company this app covers and carries no India-wide event.', not_event: 'About a covered company or the market, but reports no event (no results, deal, order, rating, payout, regulator, people or policy item).', duplicate_url: 'The same link, already counted.',
  // 12 Nov 2026 (news-pipe-2): the global-cue lane's own refusals.
  // 12 Nov 2026 (news-pipe-3): a promotional rewrite of a results line, from an aggregator, that is not the only report of a results event.
  promotional_rewrite: 'An aggregator\'s promotional rewrite of a results line ("reports very positive quarterly financial performance amid strong market returns"): no figure, no information, and not a results event.',
  not_a_cue: 'A headline from the global searches that matches none of the cue rules (so there is no stated connection to show).', global_source: 'A global headline from an aggregator or an unknown publisher: this lane takes official, wire, major or known outlets only.', global_window: 'A global headline older than 36 hours, or with no publication time.',
};

const WORDS = (t) => String(t).toLowerCase();
const EVERGREEN_TITLE = [/\bshare price\b(?!.*\b(falls?|rises?|jumps?|surges?|slumps?|gains?|drops?|rallies|tumbles?|hits?|soars?|plunges?)\b)/i, /\bstock price\b(?!.*\b(falls?|rises?|jumps?|surges?|slumps?|gains?|drops?|rallies|tumbles?|hits?|soars?|plunges?)\b)/i, /\b(live|today'?s?)\s+(share|stock)\s+price\b/i, /\bstock quote\b/i, /\bshare price (history|today|live|news)\b/i, /^(corporate )?announcements?\b\s*(\||:|-|–|—|$)/i, /\b(corporate )?announcements?\s*(\||–|—| - )\s*[A-Z]/, /\bfinancial results\s*\|/i, /\b(company|stock) (profile|overview|fundamentals|financials)\b/i, /\bpeer comparison\b/i, /\|\s*(nse|bse)\s*:?\s*[A-Z0-9&-]+\s*\|/i,
  // 13 Nov 2026: local price listings and job adverts found in the live feed ("Silver Rate Today in Yavatmal", "BHEL Artisan Recruitment 2026 Notification Out - Apply Online"). Standing pages and ads, not events.
  /\b(gold|silver|platinum|petrol|diesel|lpg)\s+(rate|price)s?\s+(today|in)\b/i, /\b(rate|price)s?\s+today\s+in\s+[A-Z]/, /\brecruitment\s+20\d\d\b/i, /\bapply\s+online\b/i, /\b(notification|vacancies)\b.*\b(posts|vacancies|apply)\b/i];
const TECHNICAL = /\b(technical (view|outlook|analysis|setup|picks?)|support (and|&|at|zone)|resistance (at|zone|level)|key (support|resistance|levels?)|breakout (stock|alert|watch)|\brsi\b|\bmacd\b|moving averages?|\b\d+-?(day|dma|ema|sma)\b|overbought|oversold|candlestick|chart (pattern|check|view)|trade setup|intraday (pick|trade|view|call)|pivot points?|bullish (candle|pattern|engulfing)|bearish (candle|pattern)|buy or sell|should you (buy|sell)|stop[- ]?loss|price target|target price|fibonacci|trading (call|strategy) for)\b/i;
const WATCH = /\b(stocks?|shares?) to (buy|watch|track|trade|bet on|invest in|focus on|look out for)|\b(top|best|\d+) (stocks?|shares?) (to|for)|stocks? (in focus|in news|on radar|that will|that could|to)|buzzing stocks|stocks? (set to|likely to|may) (move|react)|stocks? to avoid|sensex(,| and) nifty (stocks|heavyweights)|hot stocks?|stock picks?\b|(buy|sell) (these|this) stocks?/i;
const RECAP = /\bgift nifty|\bnifty (today|outlook|prediction|forecast|view)|\bsensex today\b|\bmarket (wrap|live|today|outlook|update|preview)|stock market today|\bclosing bell|\bopening bell|\blive updates?|\blive blog|\btop (gainers|losers)|\b(biggest|top) (movers|gainers|losers)|\b(sensex|nifty)(,| and)? (sensex|nifty)? ?(ends?|closes?|settles?|jumps?|falls?|slips?|tumbles?|rallies|rally|surges?|gains?|drops?|climbs?|sinks?|advances?|declines?|snaps?|extends?|rebounds?)\b|\bends? (higher|lower|flat|in the red|in the green)\b|\bwhat to expect (from|in|on)\b|\bdalal street (week|today)|\bweek ahead\b|\bmarkets? (open|opens|close|closes) (higher|lower|flat)|\bpre-?market\b|\bmarket mood\b/i;
const RECAP_GLOBAL = /\bgift nifty|\bmarket (wrap|live|preview|outlook)|stock market today|\bclosing bell|\bopening bell|\blive updates?|\blive blog|\btop (gainers|losers)|\bwhat to expect (from|in|on)\b|\bweek ahead\b|\bpre-?market\b|\bmarket mood\b/i;
const PROMO = /\b(multibagger|penny stocks?|jackpot|rocket(s|ed)?\b|skyrockets?|zooms?\b|best stock to buy|you must|don'?t miss|once in a lifetime|wealth creator|doubles? your|shocking|bumper|sensational|blockbuster (stock|returns))\b/i;
const GLOBAL = /\b(wall street|dow jones|dow\b|s&p 500|nasdaq|ftse|dax\b|cac 40|nikkei|hang seng|shanghai composite|kospi|asx 200|euro stoxx|european (stocks|shares|markets?)|us stocks|u\.s\. stocks|asian (markets?|shares|stocks)|bank of england|ecb\b|bank of japan|boj\b|bitcoin|ethereum|crypto(currency)?)\b/i;
/** 12 Nov 2026 (news-pipe-3). Low-information promotional rewrites: "reports very positive quarterly financial performance amid strong market returns". NARROW on purpose: it needs the praise phrase
 *  AND no figure anywhere in the headline, and the pipeline applies it only to an aggregator-tier outlet. An official, wire or major outlet is never judged by it. */
const PROMO_REWRITE = [
  /\b(reports?|posts?|delivers?|records?|announces?|clocks?|shows?)\s+(a\s+)?(very\s+|highly\s+|extremely\s+|exceptionally\s+|remarkably\s+)?(positive|strong|stellar|robust|impressive|outstanding|stupendous|healthy|solid)\s+(quarterly\s+|annual\s+|half[- ]yearly\s+|yearly\s+)?(financial\s+)?(performance|results|numbers|showing)\b/i,
  /\bamid\s+(very\s+)?(strong|robust|stellar|impressive|solid|healthy|positive)\s+(market\s+)?(returns|momentum|performance|gains|investor\s+(interest|confidence|sentiment))\b/i,
  /\bvery\s+(positive|strong)\b[^.]{0,40}\b(quarterly|financial)\s+(performance|results)\b/i,
];
/** True for a promotional rewrite: the praise pattern with no figure in the headline (a headline that states a number is carrying information). */
export const isPromoRewrite = (t) => !/\d/.test(String(t ?? '')) && PROMO_REWRITE.some((r) => r.test(String(t ?? '')));
export const INDIA = /\b(india|indian|sensex|nifty|bse|nse|rbi|sebi|rupee|dalal street|mumbai|union budget|gst|lok sabha|niti aayog|finance ministry|crisil|icra|fii|fpi|dii|mca|pib|ministry of|lakh crore|crore)\b|₹|\brs\.?\s?\d/i;
const HINGLISH = /\b(ne|ke|ki|ka|ko|par|pehle|baad|tezi|giravat|hai|hain|mein|kya|aaj|maari|kharidari|bechne|nivesh|dhamaka|shandar|kamaal|jabardast|ghoshna)\b/gi;
/** The India-wide drivers a market-scope headline needs to be an event. Company headlines need an event type instead. */
export const MACRO_DRIVER = /\b(rbi|reserve bank|sebi|repo rate|reverse repo|rate (cut|hike|hold)|monetary policy|mpc\b|inflation|cpi\b|wpi\b|gdp\b|iip\b|pmi\b|budget|tariffs?|\bgst\b|fiscal deficit|current account|trade deficit|fii\b|fpi\b|foreign (portfolio|institutional|investors?)|crude|brent|rupee|bond yields?|g-?secs?|liquidity|credit growth|ipo (market|pipeline)|ban on|circular|regulation|circuit breaker|margin (rules|requirements?)|f&o|derivatives rules?)\b/i;

const latinShare = (t) => { const L = t.match(/\p{L}/gu) ?? []; return L.length ? L.filter((c) => /[A-Za-zÀ-ɏ]/.test(c)).length / L.length : 0; };
/** Reasons a headline is not English, or is mixed-language filler. A few accented Latin letters (Divi's, Nestlé) are fine; a different script is not. */
export const isNonEnglish = (t) => latinShare(t) < 0.9 || (t.match(HINGLISH) ?? []).length >= 2;

/** Judge one raw item. `kind` is the page kind from urls.urlKind; `filing` is true for a dated document on an exchange or regulator host.
 *  Returns `{ reasons, flags }`: no reasons means admitted. The checks are independent and ALL fired reasons are returned; the first is the one counted. */
export function judge({ title, url, publishedSec, nowMs, filing, global = false }) {
  const reasons = []; const flags = []; const t = String(title ?? '').trim();
  const k = urlKind(url);
  if (k.kind === 'invalid') reasons.push('bad_url');
  if (t.length < (filing ? 8 : 15) || t.length > 300) reasons.push('bad_title');
  if (publishedSec == null) flags.push('date_unknown');
  else if (publishedSec * 1000 > nowMs + FUTURE_TOLERANCE_MS) reasons.push('future_timestamp');
  else if (publishedSec * 1000 < nowMs - MAX_AGE_DAYS * 86400e3) reasons.push('stale');
  if (isNonEnglish(t)) reasons.push('non_english');
  if (!filing) {
    if (k.kind === 'quote') reasons.push('quote_page'); else if (k.kind === 'landing') reasons.push('landing_page');
    if (EVERGREEN_TITLE.some((r) => r.test(t))) reasons.push('evergreen_title');
    if (TECHNICAL.test(t)) reasons.push('technical_commentary');
    if (WATCH.test(t)) reasons.push('stocks_to_watch');
    // The global lane exists FOR "Wall Street ends lower as ...": only live blogs, previews and lists are refused there (RECAP_GLOBAL), not the plain wrap sentence.
    if (global ? RECAP_GLOBAL.test(t) : RECAP.test(t)) reasons.push('market_recap');
    if (PROMO.test(t)) reasons.push('promotional');
  }
  return { reasons, flags, kind: k.kind };
}
/** True when a headline is about another country's market and nothing Indian: such an item is not evidence about an Indian name or the Indian market. */
export const isInternational = (t) => GLOBAL.test(t) && !INDIA.test(t);
export const hasIndia = (t) => INDIA.test(t);
export const isMacro = (t) => MACRO_DRIVER.test(t);
export { WORDS };
