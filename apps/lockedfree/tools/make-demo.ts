// SYNTHETIC data for layout and proof checks ONLY. Output goes to demo/ (gitignored) and is built into dist-demo, which is never deployed.
// Uses the real ledger builder so the demo exercises the same code as production. Every number is made up.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildNext, emptyLedger, type Bars, type RunIn, type Ledger } from '../src/lib/ledger.ts';
import { SCREENS, type Company, type Year } from '../src/lib/screens.ts';
const out = join(process.cwd(), 'demo'); rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'detail'), { recursive: true }); mkdirSync(join(out, 'prices'), { recursive: true });
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const days: string[] = []; for (let d = new Date('2026-08-03'); d <= new Date('2026-11-18'); d = new Date(+d + 864e5)) { const w = d.getUTCDay(); const iso = d.toISOString().slice(0, 10); if (w && w < 6 && !['2026-09-14', '2026-10-02', '2026-10-20', '2026-11-10'].includes(iso)) days.push(iso); }
const syms = Array.from({ length: 60 }, (_, i) => 'DEMO' + String.fromCharCode(65 + (i % 26)) + (i > 25 ? '2' : '')); const bars: Bars = {}; const bench: Record<string, number> = {};
let b = 1000; for (const d of days) { b *= 1 + (rnd() - 0.48) * 0.012; bench[d] = Math.round(b * 100) / 100; }
for (const s of syms) { let p = 100 + rnd() * 400; const drift = (rnd() - 0.5) * 0.002; bars[s] = {}; for (const d of days) { const o = p * (1 + (rnd() - 0.5) * 0.01); p = o * (1 + drift + (rnd() - 0.5) * 0.03); const c = p; bars[s][d] = { o: +o.toFixed(2), h: +(Math.max(o, c) * 1.01).toFixed(2), l: +(Math.min(o, c) * 0.99).toFixed(2), c: +c.toFixed(2) }; } }
const yr = (fy: number): Year => ({ fy, revenue: 1000, gross_profit: 300, net_income: 100, cfo: 120, total_assets: 1000, long_term_debt: 100, current_assets: 500, current_liabilities: 250, shares: 1e8, ebit: 150, net_fixed_assets: 400, equity: 600, total_debt: 100, cash: 50 });
const fridays = days.filter((d) => new Date(d).getUTCDay() === 5); let L: Ledger = emptyLedger(); const sc = SCREENS.map((s) => ({ id: s.id, name: s.name, version: s.version, started_on: fridays[0] }));
const lastDetail: Record<string, any> = {};
fridays.forEach((fri, wi) => { const runs: RunIn[] = [];
  for (const [si, s] of SCREENS.entries()) { const pool: Company[] = syms.map((sym, i) => ({ symbol: sym, name: 'Demo Company ' + sym.slice(4), sector: 'Industrials', mcap_cr: 3000, years: [yr(2026), yr(2025), yr(2024)].map((y, k) => ({ ...y, net_income: 100 + (i % 7) * 10 - k * 5, cfo: 100 + (i % 5) * 20 })), close: 100, ma200: 90, mom_12_1: i }));
    pool.forEach((c, i) => { c.years[0].net_income = i % 3 === 0 ? 140 : 90; });
    let pass: string[] = si === 3 && wi % 3 !== 2 ? [] : syms.filter((_, i) => (i + wi * 3 + si * 5) % 9 === 0).slice(0, 6 + si);
    const near = syms.filter((x) => !pass.includes(x)).slice(0, 3).map((symbol) => ({ symbol, failed_rule: 'Cash flow exceeds net income', gap: '₹92 cr vs ₹110 cr' }));
    runs.push({ screen_id: s.id, run_date: fri, passed: pass, near_miss: near, refused: syms.filter((x) => !pass.includes(x)).slice(0, 4), universe_n: 600, not_scorable_n: 41 });
    const stocks: any = {}; for (const sym of [...pass, ...near.map((n) => n.symbol)]) { const c = pool.find((x) => x.symbol === sym)!; const det = s.run([c]).detail[sym]; stocks[sym] = { ...det, name: c.name, sector: c.sector }; }
    writeFileSync(join(out, 'detail', `${s.id}__${fri}.json`), JSON.stringify({ screen_id: s.id, run_date: fri, stocks })); lastDetail[s.id] = pass; }
  const asOf = days[Math.min(days.indexOf(fri) + 1, days.length - 1)]; for (const d of days.filter((x) => x > (wi ? fridays[wi - 1] : '') && x <= asOf)) L = buildNext(L, { as_of: d, built_on: d + 'T11:30:00Z', runs: d === asOf ? runs : [], bars, benchmark_close: bench[d], screens: sc }); });
for (const d of days.filter((x) => x > L.as_of!)) L = buildNext(L, { as_of: d, built_on: d + 'T11:30:00Z', runs: [], bars, benchmark_close: bench[d], screens: sc });
// a synthetic void: listed on 17 Nov with no price bar after it, then dropped on 18 Nov before any entry fill
L = buildNext(L, { as_of: L.as_of!, built_on: L.built_on!, runs: [{ screen_id: 'piotroski', run_date: '2026-11-17', passed: ['DEMOVOID'], universe_n: 600, not_scorable_n: 41 }], bars, benchmark_close: bench[L.as_of!], screens: sc });
L = buildNext(L, { as_of: L.as_of!, built_on: L.built_on!, runs: [{ screen_id: 'piotroski', run_date: '2026-11-18', passed: [], universe_n: 600, not_scorable_n: 41 }], bars, benchmark_close: bench[L.as_of!], screens: sc });
writeFileSync(join(out, 'ledger.json'), JSON.stringify(L)); const marks: Record<string, number> = {}; for (const p of L.picks) if (p.status === 'open') marks[p.symbol] = bars[p.symbol][L.as_of!].c; writeFileSync(join(out, 'marks.json'), JSON.stringify(marks));
for (const s of syms.slice(0, 40)) writeFileSync(join(out, 'prices', `${s}.json`), JSON.stringify(days.map((d) => ({ date: d, c: bars[s][d].c }))));
console.log('demo ledger', L.as_of, 'picks', L.picks.length, 'closed', L.aggregates.find((a) => a.screen_id === 'all')!.n_closed, 'voids', L.voids.length);
