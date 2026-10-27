// What kind of event a headline reports. KEYWORD RULES, in a fixed order, applied to the headline text: this is not a model and is never called one. A rule says what a headline is ABOUT,
// never whether it is good or bad news; no word below is a sentiment word. `significance` is a fixed number per type (0 to 1), printed on the News page.

/** [type, pattern, significance]. A headline gets the matching type with the highest significance; none matching is `Update` (significance 0.1, kept in the archive, never on Today). */
export const EVENT_RULES = [
  ['Regulator', /\b(sebi (order|orders|bars?|bans?|penal\w+|fines?|probe|notice|show[- ]cause|alleges?|directs?|rules?)|(penalty|penalised|fined|fines|banned|barred|show[- ]cause notice|raid|raids|searches?|probe|investigat\w+|fraud|default|insolvency|nclt|ibc|cci|usfda|cdsco|tax (demand|notice)|gst (demand|notice)|enforcement directorate|\bcbi\b|forensic audit|auditor resigns?)\b)/i, 0.9],
  ['Deal', /\b(acquires?|acquisition|acquired|merger|merges?|demerger|amalgamation|buyout|stake (sale|buy|purchase)|(buys?|sells?|picks? up|offloads?|raises?|hikes?|cuts?) (a )?\d*\.?\d*\s?%? ?stake|block deal|bulk deal|buyback|open offer|takeover|fund ?raise|raises? (rs\.?|₹)|qip\b|rights issue|preferential (issue|allotment)|ncd|joint venture|\bjv\b|strategic partnership|divest\w*|spin-?off)\b/i, 0.8],
  ['Policy', /\b(rbi (keeps?|holds?|cuts?|hikes?|raises?|lowers?|announces?|policy|mpc|repo)|repo rate|reverse repo|monetary policy|mpc\b|union budget|budget \d{4}|tariffs?|\bgst (council|rate|cut|hike)|customs duty|export (ban|duty|curbs?)|import (duty|curbs?)|ban on|cabinet (approves?|clears?)|government (approves?|clears?|notifies)|sebi (circular|board|consultation|new rules?)|circular|notification)\b/i, 0.85],
  ['Results', /\b(q[1-4]\s?(fy)?\s?\d{0,4}|quarter(ly)?\b|(first|second|third|fourth)[- ]quarter|results?\b|net profit|profit (after tax|before tax|rises?|falls?|jumps?|declines?|surges?|slumps?|grows?|dips?|up|down|at)|\bpat\b|\bebitda\b|earnings|revenue (rises?|falls?|jumps?|grows?|declines?|up|down|at)|net loss|(loss|profit) (widens?|narrows?)|turnover|guidance|full[- ]year|fy\d{2}\b)/i, 0.75],
  ['Order', /\b(order (win|book|inflow|worth)|bags? (an )?orders?|wins? (an? )?(order|contract)s?|secures? (an? )?(order|contract)|(order|contract)s? (worth|from|for)|letter of (award|intent)|loa\b|empanel\w+|allotted|tender)\b/i, 0.65],
  ['IPO', /\b(ipo|initial public offering|price band|anchor investors?|listing (gains?|day|date)|lists? (at|on)|grey market premium|\bgmp\b|subscription status|subscribed|draft (red herring|prospectus)|drhp|rhp\b|ofs\b|offer for sale)\b/i, 0.6],
  ['Payout', /\b(dividend|bonus (issue|shares?)|stock split|share split|record date|ex-?date|ex-dividend|interim dividend|final dividend)\b/i, 0.6],
  ['Macro', /\b(inflation|cpi\b|wpi\b|gdp\b|iip\b|pmi\b|crude|brent|rupee|bond yields?|fii\b|fpi\b|foreign (portfolio|institutional|investors?)|fiscal deficit|current account|trade deficit|forex reserves?|liquidity|credit growth)\b/i, 0.6],
  ['Rating', /\b(upgrades?|upgraded|downgrades?|downgraded|initiates? coverage|reiterates?|(credit|crisil|icra|care|india ratings|moody'?s|fitch|s&p) (rating|ratings|reaffirms?|assigns?|revises?|outlook))\b/i, 0.45],
  ['People', /\b(appoints?|appointed|appointment|joins as|resigns?|resignation|steps down|quits|new (ceo|cfo|md|chairman)|ceo|cfo|managing director|chairman|promoter(s)? (sell|buy|pledge))\b/i, 0.45],
];
export const EVENT_TYPES = [...EVENT_RULES.map((r) => r[0]), 'Filing', 'Update'];
/** Significance by type, for the ranker and the documentation. */
export const SIGNIFICANCE = Object.fromEntries([...EVENT_RULES.map((r) => [r[0], r[2]]), ['Filing', 0.7], ['Update', 0.1]]);

/** `{ eventType, significance, matched }` for a headline. A dated filing that matches no rule is a `Filing`. */
export function classify(headline, { filing = false } = {}) {
  const t = String(headline ?? ''); let best = null;
  for (const [type, re, sig] of EVENT_RULES) if (re.test(t) && (!best || sig > best.significance)) best = { eventType: type, significance: sig, matched: type };
  if (best) return best;
  return filing ? { eventType: 'Filing', significance: SIGNIFICANCE.Filing, matched: 'filing' } : { eventType: 'Update', significance: SIGNIFICANCE.Update, matched: null };
}
