// Which company a headline is about. Names, aliases and symbols, matched on whole words; never a substring. A match is VERIFIED only at confidence VERIFIED (0.6) or more.
//
// The rules, in order of how much they trust the text:
//   0.95  the full legal name without its suffix ("Tata Consultancy Services"), or an exchange marker beside the symbol ("NSE: SAIL", "SAIL (NSE)")
//   0.90  an alias that is a phrase ("Larsen & Toubro", "Apollo Hospitals"), a shortened name of two or more words, or the name WITH its suffix where the bare name is three letters or fewer ("BSE Ltd")
//   0.85  an upper-case alias the company uses itself ("TCS", "L&T", "RIL"), written in capitals
//   0.80  a bare symbol of four letters or more, in capitals, that is not also an ordinary word (INFY, HINDALCO), in a headline that is not all capitals
//   0.75  a single distinctive word from the name or an alias ("Castrol", "Laurus"), and ONLY when the headline also carries a corporate cue (shares, Q2, profit, order, dividend ...)
// Never matched: a symbol of three letters or fewer on its own, a symbol that is also a common word (SAIL, PAGE, IDEA, COAL, MAX, ZEE, APOLLO ...) without an exchange marker,
// a group name alone ("Tata", "Adani", "Bharat", "Indian"), or any word inside another word.

export const GENERIC = new Set('tata adani bharat bharti indian india indus state national hindustan power coal oil gas steel bank finance financial capital global international united general first new east west north south central asian western eastern pacific royal star sun moon blue green white gold silver apollo reliance sterling prime max page idea star titan wave nova alpha omega delta sigma micro mega ultra super infra info tech systems services solutions industries enterprises holdings group company technologies laboratories labs pharma foods motors energy engineering electric electricals chemicals cement paper paints textiles hotels retail ventures trading investments securities insurance life health care'.split(' '));
/** Symbols that are also ordinary English words or the exchanges themselves: written without an exchange marker they match nothing. */
export const COMMON_TICKERS = new Set('SAIL PAGE IDEA GAIL COAL MAX ZEE APOLLO TITAN STAR ETERNAL BSE NSE MCX CAMS FORCE SWAN BATA SOLAR SOUTH WAVE GOLD SILVER ASIAN BEST BOSCH ULTRA GRAND PRIME UNION CHAMBLFERT HONDA EXIDE LIFE INDIA TRENT'.split(' '));
const TRAIL_LEGAL = new Set(['ltd', 'limited', 'inc', 'corp', 'corporation', 'pvt', 'private', 'plc', 'llp']);
const TRAIL_GENERIC = new Set(['industries', 'industry', 'enterprises', 'enterprise', 'technologies', 'technology', 'systems', 'services', 'solutions', 'holdings', 'group', 'company', 'co', 'limited', 'india']);
export const CUE = /\b(shares?|stocks?|q[1-4]|fy\d{2}|results?|profit|loss|revenues?|earnings|ebitda|margins?|orders?|ipo|dividend|bonus|split|board|nse|bse|brokerage|stakes?|deals?|acquires?|acquisition|merger|demerger|buyback|ratings?|upgrades?|downgrades?|ceo|cfo|chairman|capex|guidance|sebi|rbi|nclt|probe|penalty|fined?|raises?|launch(es)?|approves?|appoints?|resigns?|declares?|posts?|reports?|reported|files?|filed|plant|contract|wins?|bags?|secures?|sells?|buys?)\b/i;

/** Lower-case, possessives and apostrophes gone, `&` read as "and", everything else that is not a letter or digit a space. */
export const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[‘’`]/g, "'").replace(/'s\b/g, '').replace(/'/g, '').replace(/\s*&\s*/g, ' and ').replace(/[^a-z0-9À-ɏ]+/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The phrases a legal name stands for, with the confidence each carries. */
export function nameKeys(name) {
  let toks = norm(String(name).replace(/\([^)]*\)/g, (m) => ` ${m.slice(1, -1)} `)).split(' ').filter(Boolean); if (!toks.length) return [];
  const full = toks.slice(); while (toks.length > 1 && TRAIL_LEGAL.has(toks[toks.length - 1])) toks.pop();
  const keys = []; const add = (arr, conf, kind) => { const t = arr.join(' '); if (t && !keys.some((k) => k.text === t)) keys.push({ text: t, conf, kind }); };
  const base = toks.join(' ');
  if (base.length <= 3) { add(full, 0.9, 'name'); return keys; }                       // "BSE Ltd": the bare three letters are the exchange, the name with its suffix is the company
  add(toks, 0.95, 'name');
  const noIndia = toks.filter((t) => t !== 'india'); if (noIndia.length >= 2 && noIndia.length < toks.length) add(noIndia, 0.9, 'short');
  const cut = noIndia.slice(); while (cut.length > 2 && TRAIL_GENERIC.has(cut[cut.length - 1])) cut.pop(); if (cut.length >= 2 && cut.length < noIndia.length) add(cut, 0.9, 'short');
  const first = (cut.length ? cut : noIndia)[0] ?? toks[0];
  if (toks.length >= 2 && first.length >= 5 && !GENERIC.has(first) && !/^\d/.test(first)) add([first], 0.75, 'word');       // "castrol", "laurus": needs a corporate cue
  if (toks.length === 1) { if (toks[0].length >= 5 && !GENERIC.has(toks[0])) { keys[0].conf = 0.85; keys[0].kind = 'word-name'; } else keys.length = 0; }   // a one-word name is a common word until the headline says it is a company
  return keys;
}

/** A registry entity: `{ sym, name, keys, caps, markers }`. `aliases` are strings; an upper-case one of five characters or fewer is a house abbreviation written in capitals. */
export function buildEntity({ sym, name, aliases = [] }) {
  const keys = nameKeys(name || sym || ''); const caps = [];
  for (const a of aliases) {
    const raw = String(a).trim(); if (!raw) continue;
    if (/^[A-Z][A-Z0-9&.]{1,5}$/.test(raw)) { caps.push(raw); continue; }
    const t = norm(raw); if (!t || keys.some((k) => k.text === t)) continue;
    const single = !t.includes(' '); keys.push({ text: t, conf: single ? 0.75 : 0.9, kind: single ? 'word' : 'alias' });
  }
  const S = String(sym || '').toUpperCase();
  const markers = S ? [new RegExp(`\\b(?:NSE|BSE)\\s*[:\\-]\\s*${esc(S)}(?![A-Z0-9&])`, 'i'), new RegExp(`(?<![A-Z0-9&])${esc(S)}\\s*\\(\\s*(?:NSE|BSE)\\s*\\)`, 'i')] : [];
  const bare = S && /^[A-Z]{4,}$/.test(S) && !COMMON_TICKERS.has(S) ? new RegExp(`(?<![A-Za-z0-9&-])${esc(S)}(?![A-Za-z0-9&-])`) : null;
  return { sym: S || null, name: name || null, keys, caps: caps.map((c) => new RegExp(`(?<![A-Za-z0-9&-])${esc(c)}(?![A-Za-z0-9&-])`)), markers, bare };
}
export const buildRegistry = (list) => list.map(buildEntity);

const upperShare = (t) => { const L = t.match(/[A-Za-z]/g) ?? []; return L.length ? L.filter((c) => c === c.toUpperCase()).length / L.length : 0; };
/** Entities a headline is about, best first. Longest phrase wins and is consumed, so "Tata Motors Passenger Vehicles" does not also match "Tata Motors". */
export function matchEntities(headline, registry) {
  const text = String(headline ?? ''); const cue = CUE.test(text); const caps = upperShare(text) >= 0.7;
  let padded = ` ${norm(text)} `; const found = new Map();
  const put = (e, confidence, matchedOn, at) => { const old = found.get(e.sym ?? e.name); if (!old || confidence > old.confidence) found.set(e.sym ?? e.name, { sym: e.sym, name: e.name, confidence, matchedOn, at }); };
  const phrases = []; for (const e of registry) for (const k of e.keys) phrases.push({ e, k });
  phrases.sort((a, b) => b.k.text.length - a.k.text.length);
  for (const { e, k } of phrases) {
    if ((k.kind === 'word' || k.kind === 'word-name') && !cue) continue;
    const needle = ` ${k.text} `; const at = padded.indexOf(needle); if (at < 0) continue;
    padded = padded.split(needle).join(` ${'§ '.repeat(k.text.split(' ').length)}`);
    put(e, k.conf, k.kind === 'name' || k.kind === 'word-name' ? 'name' : k.kind === 'word' ? 'single word + corporate cue' : k.kind, at);
  }
  for (const e of registry) {
    if (e.markers.some((m) => m.test(text))) { put(e, 0.95, 'symbol with exchange marker', -1); continue; }
    if (e.caps.some((r) => r.test(text)) && !caps) { put(e, 0.85, 'house abbreviation', -1); continue; }
    if (e.bare && !caps && e.bare.test(text)) put(e, 0.8, 'symbol', -1);
  }
  return [...found.values()].sort((a, b) => b.confidence - a.confidence || a.at - b.at).map(({ sym, name, confidence, matchedOn }) => ({ sym, name, confidence, matchedOn }));
}
