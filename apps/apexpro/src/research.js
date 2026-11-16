import { finite, number as num, percent as pct, money, escape as esc } from './model.js';
export function movingAverage(values, period) {
  return values.map((_, i) => { if (i < period - 1) return null; const slice = values.slice(i - period + 1, i + 1); return slice.every(finite) ? slice.reduce((s, v) => s + v, 0) / period : null; });
}
export function chartStats(values, periodsPerYear = 252) {
  const c = values.filter(v => finite(v) && v > 0);
  if (c.length < 2) return { change: null, drawdown: null, volatility: null };
  let peak = c[0], drawdown = 0; const returns = [];
  c.forEach((v, i) => { peak = Math.max(peak, v); drawdown = Math.min(drawdown, (v / peak - 1) * 100); if (i) returns.push(Math.log(v / c[i - 1])); });
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.length > 1 ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1) : null;
  return { change: (c.at(-1) / c[0] - 1) * 100, drawdown, volatility: variance === null ? null : Math.sqrt(variance * periodsPerYear) * 100 };
}
export function chartSeries(data, limit, benchmark = false) {
  if (!Array.isArray(data?.c) || !Array.isArray(data?.t)) return [];
  const ma20 = movingAverage(data.c, 20), ma50 = movingAverage(data.c, 50);
  let points = data.t.map((t, i) => ({ t, c: data.c[i], o: data.o?.[i], h: data.h?.[i], l: data.l?.[i], v: data.v?.[i], n: data.n?.[i], ma20: ma20[i], ma50: ma50[i] })).filter(p => finite(p.t) && p.c > 0 && finite(p.c)).slice(-limit);
  if (benchmark) {
    points = points.filter(p => p.n > 0 && finite(p.n));
    if (!points.length) return [];
    const first = points[0];
    return points.map(p => ({ ...p, y: p.c / first.c * 100, benchmark: p.n / first.n * 100 }));
  }
  return points.map(p => ({ ...p, y: p.c }));
}
export function healthChecks(r) {
  return [
    { name: 'Capital efficiency', value: r.roce, pass: finite(r.roce) ? r.roce >= 15 : null, text: finite(r.roce) ? num(r.roce) + '% ROCE' : 'Not supplied', rule: 'ROCE ≥15%' },
    { name: 'Cash conversion', value: r.cfo_pat, pass: finite(r.cfo_pat) ? r.cfo_pat >= 1 : null, text: finite(r.cfo_pat) ? num(r.cfo_pat, 2) + '× cash / profit' : 'Not supplied', rule: 'Operating cash / profit ≥1×' },
    { name: 'Revenue growth', value: r.rev_cagr, pass: finite(r.rev_cagr) ? r.rev_cagr >= 10 : null, text: finite(r.rev_cagr) ? num(r.rev_cagr) + '% CAGR' : 'Not supplied', rule: 'Revenue CAGR ≥10%' },
    { name: 'Balance sheet', value: r.de, pass: finite(r.de) ? r.de <= .5 : null, text: finite(r.de) ? num(r.de, 2) + '× debt / equity' : 'Not supplied', rule: 'Debt / equity ≤0.5×' },
  ];
}
export function snapshot(r) { return { date: r.last_date || '', captured: new Date().toISOString(), price: finite(r.price) ? r.price : null, roce: finite(r.roce) ? r.roce : null, pe: finite(r.pe) ? r.pe : null, sma200: finite(r.sma200) ? r.sma200 : null }; }
export function changesSince(r, before) {
  if (!before) return [];
  const changes = [];
  if (r.price > 0 && before.price > 0 && r.price !== before.price) changes.push({ label: 'Price since review', value: (r.price / before.price - 1) * 100, text: `${money(before.price)} → ${money(r.price)}` });
  if (finite(r.roce) && finite(before.roce) && r.roce !== before.roce) changes.push({ label: 'Return on capital', text: `${num(before.roce)}% → ${num(r.roce)}%`, value: null });
  if (finite(r.pe) && finite(before.pe) && r.pe !== before.pe) changes.push({ label: 'Valuation multiple', text: `${num(before.pe)}× → ${num(r.pe)}× P/E`, value: null });
  if ([r.price,r.sma200,before.price,before.sma200].every(v => finite(v) && v > 0) && (r.price > r.sma200) !== (before.price > before.sma200)) changes.push({label:'Long-term trend',text:`Close crossed ${r.price > r.sma200 ? 'above' : 'below'} the 200-day average`,value:null});
  return changes;
}
export function healthPanel(r) {
  const checks = healthChecks(r), available = checks.filter(x => x.pass !== null), passed = checks.filter(x => x.pass).length;
  return `<section class="health-panel panel"><div class="health-intro"><div class="eyebrow">THE BUSINESS, DECODED / ${esc(r.fy || 'LATEST FY')}</div><h2>A company is more<br>than its <em>price.</em></h2><p>Four transparent checks. No black-box rating.</p><div class="health-total"><strong>${passed}<span> / ${available.length}</span></strong><small>available checks met</small></div></div><div class="health-checks">${checks.map((c,i)=>`<div class="health-check"><span class="check-number">0${i+1}</span><div><h3>${c.name}</h3><strong>${c.text}</strong><small>${c.rule}</small></div><span class="health-status ${c.pass === true ? 'pass' : c.pass === false ? 'caution' : ''}">${c.pass === null ? '—' : c.pass ? '✓' : '↘'}</span></div>`).join('')}<p class="quiet">Sector context matters. Debt and cash-flow checks are less meaningful for banks and insurers. These checks do not measure investment suitability.</p></div></section>`;
}
export function radar(rows) {
  const points = rows.filter(r=>finite(r.q)&&finite(r.g)&&finite(r.turnover_cr)).sort((a,b)=>b.turnover_cr-a.turnover_cr).slice(0,60);
  if (!points.length) return '';
  return `<section class="radar-panel panel"><div class="panel-heading"><div><div class="eyebrow">RESEARCH RADAR / UP TO 60 NAMES BY TURNOVER</div><h2>Research radar</h2></div><a class="text-button" href="#/discover">Open the screener <svg class="icon" aria-hidden="true"><use href="/icons.svg#arrow"/></svg></a></div><div class="radar-layout"><div class="radar-chart"><svg viewBox="0 0 720 340" role="group" aria-label="Company quality versus growth scores. Open any plotted company to research it."><path d="M45 15V295H690M45 155H690M367 15V295" fill="none" stroke="var(--line)" stroke-dasharray="4 6"/><text x="53" y="36" class="quadrant-label">GROWTH, WITH QUESTIONS</text><text x="477" y="36" class="quadrant-label">QUALITY MEETS GROWTH</text><text x="53" y="280" class="quadrant-label">ROOM TO IMPROVE</text><text x="495" y="280" class="quadrant-label">ESTABLISHED QUALITY</text><text x="367" y="329" text-anchor="middle" class="axis-label">QUALITY SCORE</text><text transform="translate(15 160) rotate(-90)" text-anchor="middle" class="axis-label">GROWTH SCORE</text>${points.map(r=>`<a href="#/company/${encodeURIComponent(r.sym)}" aria-label="${esc(r.sym)}: quality ${num(r.q)}, growth ${num(r.g)}"><circle class="radar-dot" cx="${45+Math.max(0,Math.min(100,r.q))*6.45}" cy="${295-Math.max(0,Math.min(100,r.g))*2.8}" r="${r.tier==='large'?7:5}" fill="var(--compare)"><title>${esc(r.sym)} · Quality ${num(r.q)} · Growth ${num(r.g)} · ${esc(r.sector)}</title></circle></a>`).join('')}</svg></div><div class="radar-notes"><span class="radar-symbol"><svg class="icon" aria-hidden="true"><use href="/icons.svg#arrow"/></svg></span><h3>Strong businesses.<br>Different trajectories.</h3><p>Each dot is a company. Position shows Alpha’s published quality and growth scores (0–100). Larger dots are large-cap names.</p><p>Explore a dot to see what is behind the score. This is a map of the dataset, not a prediction.</p><div class="radar-key"><i></i> Size indicates large-cap classification</div></div></div></section>`;
}
