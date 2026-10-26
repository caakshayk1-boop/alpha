/** "Ask in words": a plain sentence turned into the screener's own conditions. No model and no network: a fixed table of words and phrases.
 *  Everything it understood is returned as conditions the user can see and remove; everything it did not is returned as text and is NOT guessed at.
 *  "Cheap", "good" and "safe" are not here on purpose: they are opinions, and the figures behind them are named in the shortcuts instead. */
import { METRICS, type Cond, type MetricKey } from './screener.ts';

const ALIASES: [MetricKey, string[]][] = [
  ['pe', ['pe', 'p/e', 'price to earnings', 'price/earnings']],
  ['pb', ['pb', 'p/b', 'price to book']],
  ['roce_med', ['roce', 'return on capital']],
  ['roe', ['roe', 'return on equity']],
  ['rev_cagr', ['sales growth', 'revenue growth', 'sales cagr', 'revenue cagr']],
  ['eps_cagr', ['eps growth', 'profit growth', 'earnings growth']],
  ['de', ['debt to equity', 'd/e', 'debt equity', 'de']],
  ['net_margin', ['net margin', 'profit margin', 'margin']],
  ['piotroski', ['piotroski', 'f-score', 'f score', 'fscore']],
  ['comp', ['composite', 'screen score']],
  ['rsi', ['rsi']],
  ['price', ['price', 'share price']],
  ['r1d', ['day change', 'today', '1 day', '1d']],
  ['r1m', ['1 month return', '1 month', 'one month', '1m', 'monthly return']],
  ['r3m', ['3 month return', '3 months', '3 month', 'three months', '3m', 'quarterly return']],
  ['rs3m', ['against the nifty', 'vs nifty', 'relative strength', 'over the nifty', 'outperform the nifty']],
  ['from_high', ['from high', 'from 52 week high', 'from the 52 week high', 'off high', 'off the high']],
  ['vol_spike', ['volume spike', 'volume']],
  ['turnover_cr', ['turnover', 'traded value']],
  ['atr_pct', ['atr', 'daily range']],
];
/** Whole-phrase shortcuts. Each states exactly what it stands for, and that is shown back to the user as the conditions it makes. */
const PHRASES: [RegExp, Cond[]][] = [
  [/\bdebt[- ]?free\b/, [{ m: 'de', op: 'gte', v: 0 }, { m: 'de', op: 'lte', v: 0.1 }]],
  [/\boversold\b/, [{ m: 'rsi', op: 'lte', v: 30 }]],
  [/\boverbought\b/, [{ m: 'rsi', op: 'gte', v: 70 }]],
  [/\b(high|heavy|unusual) volume\b/, [{ m: 'vol_spike', op: 'gte', v: 2 }]],
  [/\b(near|close to|at) (its |the )?(52[- ]?week|52w|yearly) high\b/, [{ m: 'from_high', op: 'gte', v: -5 }]],
  [/\b(beating|ahead of|outperforming) the nifty\b/, [{ m: 'rs3m', op: 'gte', v: 0 }]],
  [/\bliquid\b/, [{ m: 'turnover_cr', op: 'gte', v: 25 }]],
];
const GTE = '(?:above|over|greater than|more than|higher than|at least|min(?:imum)?|>=|>|≥)';
const LTE = '(?:below|under|less than|lower than|at most|max(?:imum)?|<=|<|≤)';
const NUM = '(-?₹?\\s?[0-9][0-9,]*(?:\\.[0-9]+)?)\\s?(?:%|x|×|cr|crore|rs|pts|points)?';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export interface Asked { conds: Cond[]; unread: string[] }

export function askInWords(text: string): Asked {
  const conds: Cond[] = []; const unread: string[] = [];
  let q = ` ${text.toLowerCase().replace(/[’']/g, '')} `;
  for (const [re, cs] of PHRASES) if (re.test(q)) { for (const c of cs) if (!conds.some((x) => x.m === c.m && x.op === c.op)) conds.push({ ...c }); q = q.replace(re, ' , '); }
  const names = ALIASES.flatMap(([m, as]) => as.map((a) => [m, a] as const)).sort((a, b) => b[1].length - a[1].length);
  for (const piece of q.split(/,|;|\band\b|\bwith\b|\bwhose\b|\bthat has\b|\bhaving\b|&/)) {
    const t = piece.trim().replace(/\s+/g, ' '); if (!t) continue;
    let got = false;
    for (const [m, a] of names) {
      const pat = new RegExp(`(?:^|\\s)${esc(a)}\\s*(?:is |are |of |at )?\\s*(${GTE}|${LTE})\\s*${NUM}(?:\\s|$)`);
      const x = pat.exec(t); if (!x) continue;
      const v = parseFloat(x[2].replace(/[₹,\s]/g, '')); if (!Number.isFinite(v)) continue;
      const op = new RegExp(`^${GTE}$`).test(x[1]) ? 'gte' : 'lte';
      if (!conds.some((c) => c.m === m && c.op === op && c.v === v)) conds.push({ m, op, v });
      got = true; break;
    }
    if (!got && !/^(show|find|list|me|stocks?|companies|with|a|the|that|have|has|is|are|all|give)( |$)/.test(t) || (!got && t.length > 12)) unread.push(t);
  }
  return { conds, unread: unread.filter((u) => !/^(show|find|list|give)( me)?( (all|the))?( (stocks?|companies))?$/.test(u)) };
}
export const ASK_EXAMPLES = ['debt free and roce above 15', 'pe under 25, sales growth over 10%', 'oversold with high volume', 'near 52 week high and beating the nifty'];
export const known = () => METRICS.map((m) => m.short).join(', ');
