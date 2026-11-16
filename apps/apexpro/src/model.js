export const finite = v => typeof v === 'number' && Number.isFinite(v);
export const number = (v, digits = 1) => finite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: digits }) : '—';
export const percent = v => finite(v) ? `${v > 0 ? '+' : ''}${number(v)}%` : '—';
export const money = v => finite(v) ? `₹${number(v, 2)}` : '—';
export const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function trend(r) {
  if (![r.price, r.sma50, r.sma200].every(finite)) return 'Unknown';
  return r.price > r.sma50 && r.sma50 > r.sma200 ? 'Uptrend' : r.price < r.sma50 && r.sma50 < r.sma200 ? 'Downtrend' : 'Mixed';
}
export function evidence(r) {
  const yes = [], no = [];
  if (finite(r.roce)) (r.roce >= 15 ? yes : no).push(`Return on capital is ${number(r.roce)}% (${escape(r.fy || 'latest FY')}); the research threshold is 15%.`);
  if (finite(r.cfo_pat)) (r.cfo_pat >= 1 ? yes : no).push(`Operating cash flow is ${number(r.cfo_pat, 2)}× reported profit across the available history.`);
  if (finite(r.rev_cagr)) (r.rev_cagr >= 10 ? yes : no).push(`Revenue grew ${number(r.rev_cagr)}% annually across the available financial history.`);
  if (finite(r.de)) (r.de <= .5 ? yes : no).push(`Debt-to-equity is ${number(r.de, 2)}×. Compare with sector peers, especially for financial companies.`);
  if ([r.price, r.sma200].every(finite)) (r.price > r.sma200 ? yes : no).push(`The published close is ${r.price > r.sma200 ? 'above' : 'below'} its 200-day average of ${money(r.sma200)}.`);
  for (const f of (r.risk?.flags || []).slice(0, 3)) if (f.t) no.push(escape(f.t));
  return { yes, no };
}
export function filterRows(rows, { query = '', sector = '', preset = 'all', sort = 'comp', direction = -1 } = {}) {
  return rows.filter(r => (!query || `${r.sym} ${r.name}`.toLowerCase().includes(query.toLowerCase())) && (!sector || r.sector === sector) &&
    (preset === 'all' || preset === 'quality' && finite(r.roce) && r.roce >= 20 && finite(r.cfo_pat) && r.cfo_pat >= 1 || preset === 'trend' && trend(r) === 'Uptrend' || preset === 'value' && r.pe > 0 && r.pe <= 20 && r.roce >= 15 || preset === 'volume' && r.vol_spike >= 2))
    .sort((a, b) => finite(a[sort]) && finite(b[sort]) ? (a[sort] - b[sort]) * direction : finite(a[sort]) ? -1 : finite(b[sort]) ? 1 : a.sym.localeCompare(b.sym));
}
export function sectors(rows) {
  const groups = new Map();
  for (const r of rows) if (r.sector && finite(r.r1d)) { const a = groups.get(r.sector) || []; a.push(r.r1d); groups.set(r.sector, a); }
  return [...groups].map(([name, a]) => ({ name, change: a.reduce((s, n) => s + n, 0) / a.length, count: a.length })).sort((a, b) => b.change - a.change);
}
export function normalizeDesk(value) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!object(value)) throw new Error('Invalid backup');
  const watch = Array.isArray(value.watch) ? [...new Set(value.watch.filter(s => typeof s === 'string' && /^[A-Z0-9][A-Z0-9&.\-]{0,24}$/.test(s)))].slice(0, 200) : [];
  const notes = {};
  if (object(value.notes)) for (const [s, n] of Object.entries(value.notes).slice(0, 200)) {
    if (!/^[A-Z0-9][A-Z0-9&.\-]{0,24}$/.test(s) || !object(n)) continue;
    notes[s] = { thesis: String(n.thesis || '').slice(0, 5000), risk: String(n.risk || '').slice(0, 5000), review: /^\d{4}-\d{2}-\d{2}$/.test(n.review) ? n.review : '', updated: String(n.updated || '').slice(0, 40) };
  }
  const snapshots = {};
  if (object(value.snapshots)) for (const [symbol, entry] of Object.entries(value.snapshots).slice(0, 200)) {
    if (!/^[A-Z0-9][A-Z0-9&.\-]{0,24}$/.test(symbol) || !object(entry)) continue;
    snapshots[symbol] = { date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : '', captured: String(entry.captured || '').slice(0,40) };
    for (const key of ['price','roce','pe','sma200']) snapshots[symbol][key] = finite(entry[key]) ? entry[key] : null;
  }
  const conditions = {};
  if (object(value.conditions)) for (const [symbol,c] of Object.entries(value.conditions).slice(0,200)) {
    if (/^[A-Z0-9][A-Z0-9&.\-]{0,24}$/.test(symbol) && object(c) && ['above','below'].includes(c.direction) && finite(c.target) && c.target >= .01 && c.target <= 1e9) conditions[symbol]={direction:c.direction,target:c.target};
  }
  return { watch, notes, snapshots, conditions };
}
export function chartPoints(data, limit = 126) {
  if (!Array.isArray(data?.c) || !Array.isArray(data?.t)) return [];
  return data.t.map((t, i) => ({ t, v: data.c[i] })).filter(p => finite(p.t) && finite(p.v) && p.v > 0).slice(-limit);
}
