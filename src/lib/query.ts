// query.ts — the advanced text query for the Screen (Pro §28 P2): `roe > 14 and debt_to_equity < 0.5`.
// A strict little grammar, so a typo is an explained error and never a silently different screen:
//   query   := or
//   or      := and ( "or" and )*
//   and     := term ( "and" term )*
//   term    := "(" or ")" | "not" term | field op number
//   op      := > | >= | < | <= | = | !=
// Fields are a fixed list with their units; an unknown field names the closest known one. The result is the same Filter
// shape the plain-English box produces, so the chips, the "x of y match" count and the save-to-card flow are shared.
import type { Row } from './types';
import type { Filter } from './nl';

type Get = (r: Row) => number | null | undefined;
export const FIELDS: Record<string, { label: string; unit: string; get: Get; aliases?: string[] }> = {
  roce: { label: 'ROCE', unit: '%', get: (r) => r.roce },
  roe: { label: 'ROE', unit: '%', get: (r) => r.roe },
  debt_to_equity: { label: 'Debt/equity', unit: '', get: (r) => r.de, aliases: ['de', 'd_e', 'debt_equity'] },
  pe: { label: 'P/E', unit: '×', get: (r) => r.pe, aliases: ['p_e', 'price_to_earnings'] },
  pb: { label: 'P/B', unit: '×', get: (r) => r.pb, aliases: ['p_b', 'price_to_book'] },
  pe_percentile: { label: 'P/E percentile of own history', unit: '', get: (r) => r.pe_pctile, aliases: ['pe_pctile'] },
  revenue_cagr: { label: 'Revenue CAGR', unit: '%', get: (r) => r.rev_cagr, aliases: ['rev_cagr', 'sales_growth', 'revenue_growth'] },
  eps_cagr: { label: 'EPS CAGR', unit: '%', get: (r) => r.eps_cagr, aliases: ['eps_growth', 'profit_growth'] },
  net_margin: { label: 'Net margin', unit: '%', get: (r) => r.net_margin },
  ebit_margin: { label: 'EBIT margin', unit: '%', get: (r) => r.ebit_margin, aliases: ['operating_margin'] },
  interest_cover: { label: 'Interest cover', unit: '×', get: (r) => r.icover, aliases: ['icover'] },
  cash_conversion: { label: 'Operating cash ÷ profit', unit: '×', get: (r) => r.cfo_pat, aliases: ['cfo_pat'] },
  dividend_yield: { label: 'Dividend yield', unit: '%', get: (r) => r.div_yield, aliases: ['div_yield', 'yield'] },
  piotroski: { label: 'Piotroski F', unit: '', get: (r) => r.piotroski },
  promoter_holding: { label: 'Promoter holding', unit: '%', get: (r) => r.insiders, aliases: ['promoter', 'insiders'] },
  market_cap: { label: 'Market cap', unit: ' cr', get: (r) => r.mcap_cr, aliases: ['mcap', 'mcap_cr'] },
  turnover: { label: 'Daily turnover', unit: ' cr', get: (r) => r.turnover_cr, aliases: ['turnover_cr'] },
  price: { label: 'Price', unit: '', get: (r) => r.price },
  rsi: { label: 'RSI (14)', unit: '', get: (r) => r.rsi },
  return_1m: { label: '1-month return', unit: '%', get: (r) => r.r1m, aliases: ['r1m'] },
  return_3m: { label: '3-month return', unit: '%', get: (r) => r.r3m, aliases: ['r3m'] },
  return_1y: { label: '1-year return', unit: '%', get: (r) => r.r1y, aliases: ['r1y'] },
  from_high: { label: 'Distance from 52-week high', unit: '%', get: (r) => r.from_high },
  relative_strength: { label: '3-month return vs the Nifty (points)', unit: '', get: (r) => r.rs3m, aliases: ['rs3m'] },
  quality: { label: 'Quality score', unit: '', get: (r) => r.q, aliases: ['q'] },
  growth: { label: 'Growth score', unit: '', get: (r) => r.g, aliases: ['g'] },
  value: { label: 'Value score', unit: '', get: (r) => r.v, aliases: ['v'] },
  technical: { label: 'Technical score', unit: '', get: (r) => r.tech, aliases: ['tech'] },
  composite: { label: 'Composite score', unit: '', get: (r) => r.comp, aliases: ['comp'] },
};
const ALIAS: Record<string, string> = Object.fromEntries(Object.entries(FIELDS).flatMap(([k, f]) => [[k, k], ...(f.aliases ?? []).map((a) => [a, k])]));

export interface QueryError { message: string; at: number }
export interface QueryResult { ok: true; filters: Filter[]; combined: Filter; fields: string[] }
type Node = { k: 'cmp'; field: string; op: string; v: number } | { k: 'and' | 'or'; a: Node; b: Node } | { k: 'not'; a: Node };
type Tok = { t: 'id' | 'num' | 'op' | '(' | ')' | 'and' | 'or' | 'not'; v: string; at: number };

/** Does this text look like the query language rather than plain English? A field, then a comparison sign. */
export const looksLikeQuery = (q: string) => /[a-z_][a-z0-9_]*\s*(>=|<=|!=|>|<|=)\s*-?\d/i.test(q);

function lex(q: string): Tok[] | QueryError {
  const out: Tok[] = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c, v: c, at: i }); i++; continue; }
    const op = /^(>=|<=|!=|==|>|<|=)/.exec(q.slice(i));
    if (op) { out.push({ t: 'op', v: op[1] === '==' ? '=' : op[1], at: i }); i += op[1].length; continue; }
    const num = /^-?\d+(?:\.\d+)?/.exec(q.slice(i));
    if (num) { out.push({ t: 'num', v: num[0], at: i }); i += num[0].length; if (q[i] === '%') i++; continue; }
    const id = /^[a-z_][a-z0-9_]*/i.exec(q.slice(i));
    if (id) { const w = id[0].toLowerCase(); out.push({ t: w === 'and' || w === 'or' || w === 'not' ? w : 'id', v: w, at: i }); i += id[0].length; continue; }
    if (c === '&' && q[i + 1] === '&') { out.push({ t: 'and', v: 'and', at: i }); i += 2; continue; }
    if (c === '|' && q[i + 1] === '|') { out.push({ t: 'or', v: 'or', at: i }); i += 2; continue; }
    return { message: `"${c}" is not part of the query language`, at: i };
  }
  return out;
}

/** Edit distance, for "did you mean". */
function dist(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export const suggestField = (w: string) => Object.keys(ALIAS).map((k) => [k, dist(w, k)] as const).sort((x, y) => x[1] - y[1])[0];

export function parseQuery(q: string): QueryResult | QueryError {
  const toks = lex(q.trim());
  if (!Array.isArray(toks)) return toks;
  if (!toks.length) return { message: 'Type a clause such as roe > 14', at: 0 };
  let p = 0;
  const peek = () => toks[p];
  const fail = (message: string, at = peek()?.at ?? q.length): QueryError => ({ message, at });
  const term = (): Node | QueryError => {
    const t = peek();
    if (!t) return fail('The query ends where a clause was expected');
    if (t.t === '(') { p++; const n = or(); if ('message' in n) return n; if (peek()?.t !== ')') return fail('A "(" is not closed'); p++; return n; }
    if (t.t === 'not') { p++; const a = term(); return 'message' in a ? a : { k: 'not', a }; }
    if (t.t !== 'id') return fail(t.t === 'num' ? `A number (${t.v}) needs a field before it, e.g. roe > ${t.v}` : `"${t.v}" cannot start a clause`, t.at);
    const field = ALIAS[t.v];
    if (!field) { const [s, d] = suggestField(t.v); return fail(`"${t.v}" is not a field${d <= 3 ? `: did you mean ${s}?` : ''} Fields: ${Object.keys(FIELDS).join(', ')}`, t.at); }
    p++;
    const o = peek();
    if (o?.t !== 'op') return fail(`"${t.v}" needs a comparison next: >, >=, <, <=, = or !=`);
    p++;
    const n = peek();
    if (n?.t !== 'num') return fail(`"${t.v} ${o.v}" needs a number next`);
    p++;
    return { k: 'cmp', field, op: o.v, v: Number(n.v) };
  };
  const and = (): Node | QueryError => { let a = term(); while (!('message' in a) && peek()?.t === 'and') { p++; const b = term(); if ('message' in b) return b; a = { k: 'and', a, b }; } return a; };
  const or = (): Node | QueryError => { let a = and(); while (!('message' in a) && peek()?.t === 'or') { p++; const b = and(); if ('message' in b) return b; a = { k: 'or', a, b }; } return a; };
  const ast = or();
  if ('message' in ast) return ast;
  if (p < toks.length) return fail(`Expected "and" or "or" before "${toks[p].v}"`, toks[p].at);

  const word: Record<string, string> = { '>': 'above', '>=': 'at least', '<': 'below', '<=': 'at most', '=': 'equal to', '!=': 'not equal to' };
  const label = (n: Node): string => n.k === 'cmp' ? `${FIELDS[n.field].label} ${word[n.op]} ${n.v}${FIELDS[n.field].unit}` : n.k === 'not' ? `not (${label(n.a)})` : `(${label(n.a)} ${n.k} ${label(n.b)})`;
  // a company with no value for a field cannot match a clause on it, and is never counted as passing a "not"
  const test = (n: Node) => (r: Row): boolean => {
    if (n.k === 'cmp') { const x = FIELDS[n.field].get(r); if (typeof x !== 'number' || !Number.isFinite(x)) return false; return n.op === '>' ? x > n.v : n.op === '>=' ? x >= n.v : n.op === '<' ? x < n.v : n.op === '<=' ? x <= n.v : n.op === '=' ? x === n.v : x !== n.v; }
    if (n.k === 'not') return fieldsOf(n.a).every((f) => { const x = FIELDS[f].get(r); return typeof x === 'number' && Number.isFinite(x); }) && !test(n.a)(r);
    return n.k === 'and' ? test(n.a)(r) && test(n.b)(r) : test(n.a)(r) || test(n.b)(r);
  };
  const fieldsOf = (n: Node): string[] => (n.k === 'cmp' ? [n.field] : n.k === 'not' ? fieldsOf(n.a) : [...fieldsOf(n.a), ...fieldsOf(n.b)]);
  // a pure conjunction becomes one chip per clause (each can be switched off); anything with "or"/"not" is one chip
  const conj = (n: Node): Node[] | null => (n.k === 'and' ? [...(conj(n.a) ?? [n.a]), ...(conj(n.b) ?? [n.b])] : null);
  const parts = conj(ast) ?? [ast];
  const filters = parts.map((n) => ({ label: label(n).replace(/^\((.*)\)$/, '$1'), test: test(n) }));
  return { ok: true, filters, combined: { label: label(ast), test: test(ast) }, fields: [...new Set(fieldsOf(ast))] };
}
