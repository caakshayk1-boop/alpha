// askalpha.js — Ask Alpha features 2 to 7 (Pro §27.2): the pure parts. Each feature is a FACT BUILDER (what the model may
// use, built here from feeds Alpha already holds, never from what the model recalls) and, where the feature needs a rule of
// its own, a VALIDATOR layered on validateClaims(). No network and no clock, so everything here is tested directly.
//
//   2 screen     NL screener intent preview: the model may only SUGGEST clauses in the Screen's query language for words the
//                deterministic parser did not understand; the reader must accept each one, and the browser re-parses it.
//   3 move       Why did it move?: price changes plus dated stories that name the company. "No identified cause" is a valid
//                answer and is given WITHOUT a model call when no story names it.
//   4 compare    Compare narrative: aligned facts for two to four companies, each labelled with its company; the lender rule
//                takes out what does not apply to a bank, NBFC or insurer.
//   5 watchlist  Watchlist brief: what changed for up to twelve named companies, asked for by an explicit click.
//   6 filing     Filing digest: the text of the company's own latest exchange announcements, retrieved, never recalled; a
//                quoted excerpt is at most twenty-five words; no text retrieved means nothing is summarised.
//   7 thesis     Challenge my thesis: returns QUESTIONS that would test the reader's thesis, and missing data. Never a verdict.
import { validateClaims } from './explain.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r = (v, d = 1) => (num(v) === null ? null : Number(v.toFixed(d)));
const LENDER = /financial|bank|insurance/i;
const isLender = (row) => LENDER.test(`${row?.sector ?? ''} ${row?.ind ?? ''}`);
const LENDER_NA = new Set(['ROCE', 'EBIT margin', 'Debt/equity', 'Interest cover', 'Cash profit / reported profit']);

function builder() {
  const out = [];
  const add = (label, value, unit = '') => { if (value !== null && value !== undefined && value !== '') out.push({ id: `F${out.length + 1}`, label, value: String(value), unit }); };
  return { out, add };
}

export const PROMPTS = {
  screen: 'Task: the reader typed a screen in plain words and some words were not understood. Suggest at most four clauses in this query language only: field op number, joined by and/or, for example "roce >= 20". Fields: roce, roe, debt_to_equity, pe, pb, pe_percentile, revenue_cagr, eps_cagr, net_margin, ebit_margin, interest_cover, cash_conversion, dividend_yield, piotroski, promoter_holding, market_cap, turnover, rsi, return_1m, return_3m, return_1y, from_high, relative_strength, quality, growth, value, technical, composite. Reply with JSON only: {"suggestions":["..."],"why":["..."]}, one "why" per suggestion in plain words with no digits. Never suggest a sector or a company.',
  move: 'Task: say what Alpha\'s facts show about the recent move and which dated stories name the company. Do not say a story caused the move: say the story was published on that date. If nothing in the facts explains it, say that no cause is identified in Alpha\'s data.',
  compare: 'Task: compare the companies on the facts given. Every fact label starts with its company symbol; never mix one company\'s figure with another\'s. Where a measure is missing for one company, say it is not available rather than comparing. Do not name a winner.',
  watchlist: 'Task: brief the reader on what changed for each named company, using only its facts. One claim per company at most. Say plainly when nothing notable is in the facts.',
  filing: 'Task: summarise what the company\'s own exchange announcements say, using only their text in the facts. Quote at most a short phrase. Do not interpret beyond the text and do not judge whether it is good or bad.',
  thesis: 'Task: the reader states a thesis. Do not agree or disagree. Return claims that are QUESTIONS, each ending with a question mark, that would test the thesis against the facts, for example what would have to be true, or which figure points the other way. Put data the facts lack in "unknowns". Never say whether to buy, sell or hold.',
};

/** A story names the company when its ticker appears in capitals as its own word, or its full name (without Ltd/Limited)
 *  appears. Conservative on purpose: the site's News desk has the fuller matcher (A05); here a missed story is safer than a
 *  wrong one, because a wrong one would be offered as a dated event about this company. */
export function namesCompany(text, sym, name) {
  const t = String(text ?? '');
  if (sym && sym.length >= 3 && new RegExp(`(^|[^A-Za-z0-9])${sym.replace(/[&]/g, '\\&')}([^A-Za-z0-9]|$)`).test(t)) return true;
  const core = String(name ?? '').replace(/\b(limited|ltd\.?|ltd)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
  if (core.length < 6) return false;
  if (/\b(federal reserve|reserve bank of india)\b/i.test(t) && /^(federal|reserve)/i.test(core)) return false;
  return t.toLowerCase().includes(core.toLowerCase());
}

/** 3 — facts for "why did it move?". `stories` are {title, source, published}; `now` is a timestamp. */
export function factsForMove(row, stories, now, days = 7) {
  const { out, add } = builder();
  if (!row) return { facts: out, named: 0 };
  add('Company', `${row.name} (${row.sym})`);
  add('Price date', row.last_date);
  add('Price', r(row.price, 2), 'INR');
  add('Move on the day', r(row.r1d, 2), '%');
  add('Move over a week', r(row.r1w, 2), '%');
  add('Move over a month', r(row.r1m, 1), '%');
  add('Move against the index over three months', r(row.rs3m, 0), 'of 100, within the screen');
  add('Next results date on file', row.next_earnings);
  const since = now - days * 864e5;
  let named = 0;
  for (const s of (stories || [])) {
    const at = s.published ? Date.parse(s.published) : NaN;
    if (!Number.isFinite(at) || at < since || at > now + 3600e3) continue;
    if (!namesCompany(`${s.title} ${s.summary ?? ''}`, row.sym, row.name)) continue;
    if (named >= 6) break;
    named++;
    add(`Story published ${new Date(at).toISOString().slice(0, 10)} (${String(s.source).slice(0, 40)})`, String(s.title).slice(0, 160));
  }
  return { facts: out, named };
}

/** The answer when no story names the company: given without a model call, and said plainly. */
export function noIdentifiedCause(row, days = 7) {
  return { claims: [{ text: `No cause is identified in Alpha's data: no story in the news feed from the last ${days === 7 ? 'week' : `${days} days`} names ${String(row?.name ?? 'this company').replace(/\s*\b(limited|ltd)\.?\s*$/i, '').trim()}. A move with no story is common; this is not evidence that there is no reason.`, facts: [], status: 'unverified' }], withheld: [], unknowns: ['Exchange filings and broker notes are not in the news feed.'] };
}

/** 4 — aligned facts for two to four companies, each label prefixed by its symbol. */
export function factsForCompare(shards) {
  const { out, add } = builder();
  const rows = (shards || []).map((s) => s?.row).filter(Boolean).slice(0, 4);
  for (const row of rows) {
    const p = row.sym;
    const lender = isLender(row);
    const put = (label, v, u) => { if (!(lender && LENDER_NA.has(label))) add(`${p}: ${label}`, v, u); };
    add(`${p}: Company`, row.name);
    put('Sector', row.sector);
    put('Market cap', r(row.mcap_cr, 0), 'INR crore');
    put('P/E', r(row.pe), 'x');
    put('P/B', r(row.pb, 2), 'x');
    put('ROCE', r(row.roce), '%');
    put('ROE', r(row.roe), '%');
    put('EBIT margin', r(row.ebit_margin), '%');
    put('Debt/equity', r(row.de, 2), 'x');
    put('Interest cover', r(row.icover), 'x');
    put('Cash profit / reported profit', r(row.cfo_pat, 2), 'x');
    put('Revenue CAGR', r(row.rev_cagr), '% a year');
    put('EPS CAGR', r(row.eps_cagr), '% a year');
    put('Quality percentile', r(row.q, 0), 'of 100, within the screen');
    put('Value percentile (higher is cheaper)', r(row.v, 0), 'of 100, within the screen');
    put('Price date', row.last_date);
    if (lender) add(`${p}: Note`, 'a lender: ROCE, margins, leverage, interest cover and cash conversion are not comparable and are left out');
  }
  return out;
}

/** 5 — facts for a watchlist brief over up to twelve rows. */
export function factsForWatchlist(rows) {
  const { out, add } = builder();
  for (const row of (rows || []).filter(Boolean).slice(0, 12)) {
    const p = row.sym;
    add(`${p}: Company`, row.name);
    add(`${p}: Move on the day`, r(row.r1d, 2), '%');
    add(`${p}: Move over a week`, r(row.r1w, 2), '%');
    add(`${p}: Distance from 52-week high`, r(row.from_high, 0), '%');
    add(`${p}: RSI (14)`, r(row.rsi, 0));
    add(`${p}: Next results date on file`, row.next_earnings);
  }
  return out;
}

/** 6 — facts from the company's latest exchange announcements ({desc, an_dt, attchmntText, attchmntFile}). */
export function factsForFiling(sym, announcements) {
  const { out, add } = builder();
  const list = (Array.isArray(announcements) ? announcements : []).filter((a) => a && (a.desc || a.attchmntText)).slice(0, 4);
  for (const a of list) {
    const when = String(a.an_dt ?? a.sort_date ?? '').slice(0, 20);
    add(`Announcement (${when}) subject`, String(a.desc ?? '').slice(0, 160));
    if (a.attchmntText) add(`Announcement (${when}) text`, String(a.attchmntText).replace(/\s+/g, ' ').slice(0, 700));
  }
  if (list.length) add('Company symbol', sym);
  return out;
}

const QUOTE = /["“]([^"”]{1,400})["”]/g;
/** 6 — a filing summary may quote at most twenty-five words in a row. */
export function validateFiling(raw, facts) {
  const res = validateClaims(raw, facts);
  const keep = [];
  for (const c of res.claims) {
    const long = [...c.text.matchAll(QUOTE)].find((m) => m[1].trim().split(/\s+/).length > 25);
    if (long) res.withheld.push({ text: c.text, reason: 'quotes more than twenty-five words of the filing' }); else keep.push(c);
  }
  return { ...res, claims: keep };
}

/** 7 — every claim shown for a thesis challenge must be a question. */
export function validateThesis(raw, facts) {
  const res = validateClaims(raw, facts);
  const keep = [];
  for (const c of res.claims) {
    if (!/\?\s*$/.test(c.text)) res.withheld.push({ text: c.text, reason: 'states a view instead of asking a question' });
    else if (/\b(you should|i recommend|good investment|bad investment|undervalued stock to own)\b/i.test(c.text)) res.withheld.push({ text: c.text, reason: 'uses advisory wording' });
    else keep.push(c);
  }
  return { ...res, claims: keep };
}

/** The reader's thesis as data: trimmed, bounded, and never able to close the facts block. */
export function cleanThesis(t) {
  const s = String(t ?? '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length >= 10 && s.length <= 600 ? s : null;
}

const CLAUSE = /^[a-z_]+\s*(>=|<=|!=|>|<|=)\s*-?\d+(\.\d+)?(\s+(and|or)\s+[a-z_]+\s*(>=|<=|!=|>|<|=)\s*-?\d+(\.\d+)?)*$/;
/** 2 — the model's clause suggestions, kept only when each is in the query language (the browser parses them again before
 *  offering them, and the reader must accept each). */
export function parseSuggestions(text) {
  let j = null;
  try { const s = String(text ?? ''); j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch { return []; }
  const sug = Array.isArray(j?.suggestions) ? j.suggestions : [];
  const why = Array.isArray(j?.why) ? j.why : [];
  return sug.map((x, i) => ({ q: String(x ?? '').trim().toLowerCase(), why: typeof why[i] === 'string' && !/\d/.test(why[i]) ? why[i].slice(0, 160) : '' }))
    .filter((x) => x.q.length <= 120 && CLAUSE.test(x.q)).slice(0, 4);
}

/** 4 / 5 — a figure must belong to the company the sentence names. In "TCS's ROCE is {F20}" F20 must be a TCS fact: the
 *  nearest symbol written before the placeholder, in the same sentence, has to be the fact's own prefix. Checked on the
 *  model's templates first; the survivors then go through every other rule in validateClaims(). */
export function validateEntities(raw, facts) {
  const WINNER = /\b(the )?(winner|wins on|better (choice|company|stock|investment)|best (choice|company|stock|investment)|clear (pick|choice))\b/i;
  const syms = [...new Set(facts.map((f) => /^([A-Z0-9&-]{1,20}): /.exec(f.label)?.[1]).filter(Boolean))];
  const byId = new Map(facts.map((f) => [f.id, f]));
  const list = Array.isArray(raw?.claims) ? raw.claims : [];
  const ok = [], wrong = [];
  for (const c of list) {
    const text = typeof c?.text === 'string' ? c.text : '';
    let bad = null;
    if (syms.length >= 2) for (const m of text.matchAll(/\{(F\d+)\}/g)) {
      const f = byId.get(m[1]);
      const own = /^([A-Z0-9&-]{1,20}): /.exec(f?.label ?? '')?.[1];
      const sentence = text.slice(0, m.index).split(/[.;!?]/).pop() ?? '';
      const said = syms.map((s) => [s, sentence.lastIndexOf(s)]).filter(([, at]) => at >= 0).sort((a, b) => b[1] - a[1])[0]?.[0];
      // the company may also be named right after the figure: "against {F6} at INFY"
      const after = text.slice(m.index + m[0].length).split(/[.;!?]|\{F/)[0].slice(0, 30);
      if (own && said && said !== own && !after.includes(own)) { bad = `gives ${own}'s ${f.label.replace(/^[^:]+: /, '')} as ${said}'s`; break; }
    }
    if (!bad && WINNER.test(text)) bad = 'names a winner (no winner column, §22.5)';
    if (bad) wrong.push({ text: text.trim().slice(0, 400), reason: bad }); else ok.push(c);
  }
  const res = validateClaims({ ...raw, claims: ok }, facts);
  return { ...res, withheld: [...wrong, ...res.withheld] };
}
