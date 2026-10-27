import { useMemo, useState } from 'react';
import { Sheet } from '../ui.tsx';
import type { Row } from '../screen.ts';
import { condsFor, coverage, checkRange, describeCond, distribution, fmtMetric, metricOf, METRICS, unitWords, type Cond, type MetricKey, type RangeMode } from '../screener.ts';
import { plural } from '../plural.ts';

const MODES: [RangeMode, string][] = [['gte', 'At least'], ['lte', 'At most'], ['between', 'Between'], ['around', 'Around']];
const clean = (x: number) => String(Math.round(x * 1e4) / 1e4);
/** The conditions already set on a figure, read back as the mode that wrote them. */
function modeOf(existing: readonly Cond[]): { mode: RangeMode; a: number; b: number; unk: boolean } | null {
  const g = existing.find((c) => c.op === 'gte'), l = existing.find((c) => c.op === 'lte'); const unk = existing.some((c) => c.unk);
  if (g && l) return { mode: 'between', a: g.v, b: l.v, unk }; if (g) return { mode: 'gte', a: g.v, b: 0, unk }; if (l) return { mode: 'lte', a: l.v, b: 0, unk }; return null;
}
/** The two boxes' starting numbers for a figure and a mode, from how the figure is spread (quartiles, or the middle). */
function startText(rows: Row[], id: MetricKey, md: RangeMode): [string, string] {
  const d = distribution(rows, id); if (!d) return ['', '']; const mt = metricOf(id)!; const st = Math.max(Math.pow(10, -mt.dp), (d.hi - d.lo) / 400); const sn = (x: number) => clean(Math.round(x / st) * st);
  return md === 'between' ? [sn(d.lo + (d.hi - d.lo) * 0.25), sn(d.lo + (d.hi - d.lo) * 0.75)] : md === 'around' ? [sn(d.median), clean(Math.max(st, (d.hi - d.lo) / 40))] : [sn(d.median), ''];
}
/** One numeric condition: a figure, at least or at most, a value. The boxes always hold the number in force (never an empty box with a hint behind it), so what is read out is what is applied.
 *  Inputs are checked as they are typed and the reason is printed under the box; "Add" waits until they are sound. */
export function CondSheet({ onClose, onAdd, rows, count, metrics, initial, existing, allowUnknown = false, blocked }: {
  onClose: () => void; onAdd: (c: Cond[]) => void; rows: Row[]; count: (c: Cond[]) => number; metrics?: MetricKey[]; initial?: MetricKey;
  /** the conditions the list already has (all figures): the sheet opens on the ones for its figure, so a figure is edited, not added twice */ existing?: readonly Cond[];
  /** offer "also include names with no figure" (Discover does; the Lab's test cannot honour it) */ allowUnknown?: boolean; /** a reason a figure cannot be filtered right now, or null */ blocked?: (m: MetricKey) => string | null;
}) {
  const start = (id: MetricKey) => modeOf((existing ?? []).filter((c) => c.m === id));
  const [m, setM] = useState<MetricKey>(initial ?? (metrics?.includes('rsi') || !metrics ? 'rsi' : metrics[0]));
  const first = start(m);
  const [mode, setMode] = useState<RangeMode>(first?.mode ?? 'between');
  const [a, setA] = useState(() => (first ? clean(first.a) : startText(rows, m, 'between')[0])); const [b, setB] = useState(() => (first && first.mode === 'between' ? clean(first.b) : startText(rows, m, 'between')[1]));
  const [unk, setUnk] = useState(first?.unk ?? false);
  const met = metricOf(m)!; const dist = useMemo(() => distribution(rows, m), [rows, m]); const cov = useMemo(() => coverage(rows, m), [rows, m]);
  const step = Math.max(Math.pow(10, -met.dp), dist ? (dist.hi - dist.lo) / 400 : 1);
  const reset = (id: MetricKey, md: RangeMode) => { const t = startText(rows, id, md); setA(t[0]); setB(t[1]); };
  const why = blocked?.(m) ?? null;
  const chk = checkRange(m, mode, a, b); const conds: Cond[] = chk.ok && chk.a !== null ? condsFor(m, mode, chk.a, chk.b ?? 0).map((c) => (unk ? { ...c, unk: true } : c)) : [];
  const hits = conds.length ? count(conds) : null; const fmt = (v: number) => fmtMetric({ ...met, signed: false }, v);
  const inside = (v: number) => conds.every((c) => (c.op === 'gte' ? v >= c.v : v <= c.v)); const maxBin = dist ? Math.max(1, ...dist.bins) : 1;
  const num = (t: string, d: number) => { const v = Number(t); return t.trim() !== '' && Number.isFinite(v) ? v : d; };
  const sliderA = dist ? Math.min(Math.max(num(a, dist.lo), dist.lo), dist.hi) : 0, sliderB = dist ? Math.min(Math.max(num(b, dist.hi), dist.lo), dist.hi) : 0;
  const editing = (existing ?? []).some((c) => c.m === m); const rsiSheet = m === 'rsi_w' || m === 'rsi_m';
  return <Sheet title={editing ? 'Edit condition' : 'Add a condition'} onClose={onClose}>
    <label className="l" htmlFor="c-m">Figure</label>
    <select id="c-m" className="field" value={m} onChange={(e) => { const id = e.target.value as MetricKey; setM(id); const ex = start(id); const md = ex?.mode ?? mode; setMode(md); setUnk(ex?.unk ?? false); if (ex) { setA(clean(ex.a)); setB(ex.mode === 'between' ? clean(ex.b) : ''); } else reset(id, md); }}>{METRICS.filter((x) => !metrics || metrics.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
    <p className="small mute" style={{ margin: '6px 0 0' }}>{met.hint || 'Last close.'} Judged at the last close.</p>
    {why && <p className="small warn" role="note" style={{ margin: '6px 0 0' }}>{why}</p>}
    {!why && cov.have < rows.length && <p className="small mute" role="note" style={{ margin: '6px 0 0' }}>{cov.have === 0 ? `No company has this figure yet${rsiSheet ? ': it comes from the nightly RSI sheet, which has not loaded' : ''}, so nothing can match.` : `${plural(cov.have, 'company', 'companies')} of ${rows.length.toLocaleString('en-IN')} have it${rsiSheet ? ' (the nightly RSI sheet covers only some names)' : ''}${cov.na ? `; ${plural(cov.na, 'financial-sector name')} it is not defined for` : ''}.`}</p>}
    <div className="c-bar" role="radiogroup" aria-label="How to compare" style={{ marginTop: 10 }}>{MODES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className="seg-b" onClick={() => { setMode(k); reset(m, k); }}>{l}</button>)}</div>
    {dist ? <>
      <div className="hist" role="img" aria-label={`How ${met.label} is spread across ${plural(dist.n, 'company', 'companies')}: the middle is ${fmt(dist.median)}, most sit between ${fmt(dist.p1)} and ${fmt(dist.p99)}`}>
        {dist.bins.map((n, k) => { const x0 = dist.lo + ((dist.hi - dist.lo) * k) / dist.bins.length, x1 = dist.lo + ((dist.hi - dist.lo) * (k + 1)) / dist.bins.length; return <i key={k} className={conds.length && (inside(x0) || inside(x1)) ? 'on' : ''} style={{ height: `${Math.max(4, (n / maxBin) * 100)}%` }} />; })}
      </div>
      <div className="row between small mute num"><span>{fmt(dist.p1)}</span><span>middle {fmt(dist.median)}</span><span>{fmt(dist.p99)}</span></div>
      {mode === 'between' ? <>
        <label className="l" htmlFor="c-r1">From {chk.a !== null ? fmt(chk.a) : '…'}</label>
        <input id="c-r1" type="range" className="rng" min={dist.lo} max={dist.hi} step={step} value={sliderA} onChange={(e) => setA(clean(Number(e.target.value)))} aria-label={`${met.short} lower end`} />
        <label className="l" htmlFor="c-r2">To {chk.b !== null ? fmt(chk.b) : '…'}</label>
        <input id="c-r2" type="range" className="rng" min={dist.lo} max={dist.hi} step={step} value={sliderB} onChange={(e) => setB(clean(Number(e.target.value)))} aria-label={`${met.short} upper end`} />
      </> : <>
        <label className="l" htmlFor="c-r1">{mode === 'gte' ? 'At least' : mode === 'lte' ? 'At most' : 'Around'} {chk.a !== null ? fmt(chk.a) : '…'}</label>
        <input id="c-r1" type="range" className="rng" min={dist.lo} max={dist.hi} step={step} value={sliderA} onChange={(e) => setA(clean(Number(e.target.value)))} aria-label={`${met.short} value`} />
      </>}
    </> : <p className="small mute">Too few companies have this figure to draw it.</p>}
    <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'flex-start' }}>
      <div className="grow"><label className="l" htmlFor="c-v">{mode === 'between' ? 'From' : mode === 'around' ? 'Around' : 'Value'}{met.unit.trim() ? ` (${met.unit.trim()})` : ''}</label><input id="c-v" className="field" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} aria-invalid={!!chk.errors.a} aria-describedby="c-e1" autoComplete="off" /></div>
      {(mode === 'between' || mode === 'around') && <div className="grow"><label className="l" htmlFor="c-v2">{mode === 'between' ? 'To' : 'Plus or minus'}</label><input id="c-v2" className="field" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} aria-invalid={!!chk.errors.b} aria-describedby="c-e2" autoComplete="off" /></div>}
    </div>
    <p className="small mute" style={{ margin: '4px 0 0' }}>This figure is {unitWords(met)}.</p>
    <div id="c-e1" className="small err" role="alert">{chk.errors.a ?? ''}</div><div id="c-e2" className="small err" role="alert">{chk.errors.b ?? chk.errors.range ?? ''}</div>
    <div className="chips wrap" style={{ marginTop: 8 }} role="group" aria-label="Typical values">{met.presets.map((p) => <button key={p} type="button" className="chip" onClick={() => setA(String(p))}>{fmtMetric({ ...met, signed: false }, p)}</button>)}</div>
    {allowUnknown && <label className="chk"><input type="checkbox" checked={unk} onChange={(e) => setUnk(e.target.checked)} /> Also include names with no figure{cov.missing ? ` (${plural(cov.missing, 'name')} now)` : ''}</label>}
    <p className="small num" role="status" style={{ margin: '10px 0 0' }}>{hits === null ? 'Fix the number above to see how many match.' : <><b className="lime">{hits}</b> of {rows.length.toLocaleString('en-IN')} companies match with your other filters{conds.length ? ` (${conds.map(describeCond).join(' and ')})` : ''}.</>}{!unk && cov.missing > 0 ? <span className="mute"> {plural(cov.missing, 'name')} with no figure {cov.missing === 1 ? 'is' : 'are'} left out.</span> : null}</p>
    <p className="small dim">A company with no figure for this is left out unless you choose to include them, and is never counted as zero. For the financial sector, ratios built on capital employed are not defined and stay out either way.</p>
    <div className="row" style={{ marginTop: 12 }}><button className="btn grow" onClick={onClose}>Cancel</button><button className="btn pri grow" disabled={!conds.length || !!why || cov.have < 2} onClick={() => onAdd(conds)}>{editing ? 'Update' : 'Add'}</button></div>
  </Sheet>;
}
