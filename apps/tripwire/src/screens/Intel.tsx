import { useMemo } from 'react';
import { useFactors, type Company } from '../data.ts';
import type { Row } from '../screen.ts';
import { eligibilityOf } from '../eligibility.ts';
import { FACTOR_META, earningsQuality, holders, ownershipRead, ownershipTree, peerLadder, riskMap, seasonRead, type OwnNode } from '../intel.ts';
import { Spark } from '../live.tsx';
import { dayWord, pct } from '../fmt.ts';

const Sec = ({ title, head, children, open = false }: { title: string; head: string; children: React.ReactNode; open?: boolean }) =>
  <details className="ev" open={open}><summary><span className="grow"><span className="k" style={{ display: 'block' }}>{title}</span><span style={{ fontWeight: 600 }}>{head}</span></span><span className="chev">▾</span></summary><div className="body">{children}</div></details>;

const OwnRow = ({ h, depth }: { h: OwnNode; depth: number }): React.ReactNode => <>
  <div className="contrib" style={{ gridTemplateColumns: '1fr 92px 82px', paddingLeft: depth * 14 }}><span className="trunc">{h.label}{h.derived ? <span className="mute small"> · worked out</span> : null}</span><span className="bar2"><i style={{ width: `${Math.min(100, h.pct)}%`, left: 0, background: h.key === 'promoter' ? 'var(--dim)' : 'var(--lime)', opacity: depth ? 0.6 : 0.85 }} /></span><span className="num" style={{ textAlign: 'right' }}>{h.pct.toFixed(1)}%{h.pp != null && Math.abs(h.pp) >= 0.1 ? <span className={h.pp > 0 ? 'up' : 'down'}> {h.pp > 0 ? '▲' : '▼'}{Math.abs(h.pp).toFixed(2)}</span> : null}</span></div>
  {h.children?.map((k) => <OwnRow key={k.key} h={k} depth={depth + 1} />)}</>;

/** Everything the screen and the filings tell us about a company that a price chart does not: who owns it, when it tends to move, how its
 *  valuation compares with its own past, whether profit is real, where it stands among peers, how big a move is ordinary, and a fingerprint of
 *  less common indicators that carries the verdict of the study that tested them. */
export function Intel({ c, rows }: { c: Company; rows: readonly Row[] }) {
  const r = c.row; const month = new Date(Date.now() + 330 * 60000).getUTCMonth();
  const own = holders(c.inst); const tree = ownershipTree(c.inst); const season = seasonRead(c.season, month); const ladder = useMemo(() => peerLadder(r, rows), [r, rows]);
  const eq = earningsQuality(r, eligibilityOf(r, c.years)); const rm = riskMap(r); const fac = useFactors(); const fr = fac.data?.rows[c.sym];
  const mx = Math.max(1, ...(c.season?.m ?? []).map((x) => Math.abs(x?.[1] ?? 0)));
  return <>
    {own.length > 0 && <Sec title="Who owns it" head={c.inst?.signal_label ?? 'Shareholding'} open>
      {tree && tree.nodes.map((h) => <OwnRow key={h.key} h={h} depth={0} />)}
      {tree && <p className="small mute" style={{ margin: '8px 0 0' }}>{tree.basis}</p>}
      {tree && <details className="more"><summary>What the groups mean</summary><div>{(() => { const out: OwnNode[] = []; const walk = (x: OwnNode) => { out.push(x); x.children?.forEach(walk); }; tree.nodes.forEach(walk); return out.map((x) => <p key={x.key} style={{ margin: '0 0 4px' }}><b>{x.label}:</b> {x.def}.</p>); })()}</div></details>}
      {ownershipRead(c.inst) && <p className="small" style={{ margin: '10px 0 4px' }}>{ownershipRead(c.inst)}</p>}
      {c.inst?.series && c.inst.series.length > 2 && <div className="row" style={{ gap: 12, marginTop: 6 }}><div className="grow"><div className="k">FII, {c.inst.series.length} quarters</div><Spark c={c.inst.series.map((s) => s.f)} up label="Foreign institutions' stake by quarter" /></div><div className="grow"><div className="k">DII</div><Spark c={c.inst.series.map((s) => s.d)} up label="Domestic institutions' stake by quarter" /></div></div>}
      {c.inst?.quality === 'partial' && <p className="small mute" style={{ margin: '8px 0 0' }}>Part of the shareholding data is missing for this company.</p>}
      <p className="small mute" style={{ margin: '8px 0 0' }}>Quarterly shareholding patterns. Arrows show the change since the previous quarter, in percentage points. A holder buying says what they did, not what will happen.</p></Sec>}
    {season && <Sec title="Seasonality" head={`${season.month}: up in ${season.hit}% of ${season.years} years, average ${pct(season.avg)}`}>
      <div className="bars" style={{ height: 70 }} role="img" aria-label={`Average return by calendar month over ${c.season?.y} years; ${season.month} averaged ${pct(season.avg)}`}>{(c.season?.m ?? []).map((m, k) => <div key={k} className="b"><i style={{ height: `${Math.max(6, (Math.abs(m[1]) / mx) * 100)}%`, background: m[1] >= 0 ? 'var(--up)' : 'var(--down)', opacity: k === month ? 1 : .45, outline: k === month ? '1.5px solid var(--tx)' : 'none' }} /><span>{'JFMAMJJASOND'[k]}</span></div>)}</div>
      <p className="small" style={{ margin: '8px 0 0' }}>Best month: {season.best.month} ({pct(season.best.avg)}). Weakest: {season.worst.month} ({pct(season.worst.avg)}).</p>
      <p className="small mute" style={{ margin: '4px 0 0' }}>Month-to-month closes over {c.season?.y} years{season.thin ? ', a thin sample' : ''}. Seasonal patterns are weak and often vanish; this is context.</p></Sec>}
    {r.pe_pctile != null && <Sec title="Against its own history" head={`PE is higher than ${Math.round(r.pe_pctile)}% of its own past readings`}>
      <div className="meter" style={{ margin: '14px 0 6px' }}><div className="fill" style={{ width: `${r.pe_pctile}%` }} /><span className="now" style={{ left: `${r.pe_pctile}%` }} /></div>
      <div className="row between small dim"><span>cheapest it has been</span><span>most expensive</span></div>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Its trailing PE now, against its own history in the data. A company can deserve a higher or lower multiple than before.</p></Sec>}
    {eq.length > 0 && <Sec title="Earnings quality" head={eq.filter((q) => q.tone === 'good').length >= 3 ? 'Profit looks real and well covered' : eq.some((q) => q.tone === 'warn') ? 'Something to look at' : 'Mixed'}>
      {eq.map((q) => <div key={q.label} className="li" style={{ alignItems: 'flex-start' }}><span className="grow"><span style={{ display: 'block' }}>{q.label}</span><span className="small dim">{q.read}</span></span><span className={`num ${q.tone === 'good' ? 'up' : q.tone === 'warn' ? 'down' : ''}`} style={{ fontWeight: 650 }}>{q.value}</span></div>)}</Sec>}
    {ladder.lines.length > 0 && <Sec title="Among its peers" head={`${ladder.lines[0].label.startsWith('Return') ? 'Return on capital' : ladder.lines[0].label}: #${ladder.lines[0].rank} of ${ladder.lines[0].of} in ${ladder.sector}`}>
      {ladder.lines.map((l) => <div key={l.label} className="contrib" style={{ gridTemplateColumns: '1fr 70px 70px' }}><span className="trunc">{l.label}</span><span className="bar2"><i style={{ width: `${((l.of - l.rank + 1) / l.of) * 100}%`, left: 0, background: l.rank <= l.of / 3 ? 'var(--lime)' : l.rank > (2 * l.of) / 3 ? 'var(--peach)' : 'var(--dim)' }} /></span><span className="num" style={{ textAlign: 'right' }}>#{l.rank} of {l.of}</span></div>)}
      <p className="small mute" style={{ margin: '8px 0 0' }}>Among {ladder.peers} liquid companies in the sector with the figure. Rank 1 is the best on that measure; a loss-maker has no PE rank.</p></Sec>}
    <Sec title="Risk map" head={rm.daily != null ? `Ordinary day: about ±${rm.daily.toFixed(1)}%, ordinary month: about ±${rm.swing20!.toFixed(0)}%` : 'Risk figures are not available'}>
      <div className="grid2">{[['Ordinary daily move', rm.daily != null ? `${rm.daily.toFixed(1)}%` : '—'], ['Ordinary 20-session swing', rm.swing20 != null ? `${rm.swing20.toFixed(0)}%` : '—'], ['Above its 52-week low', rm.fromLow != null ? pct(rm.fromLow, 0) : '—'], ['From its 52-week high', rm.fromHigh != null ? pct(rm.fromHigh, 0) : '—'], ['Volatility, 1 year', rm.volAnnual != null ? `${rm.volAnnual.toFixed(0)}% a year` : '—'], ['₹10 lakh as a share of a day', rm.tenLakhPct != null ? `${rm.tenLakhPct < 0.01 ? '<0.01' : rm.tenLakhPct.toFixed(2)}%` : '—']].map(([a, b]) => <div key={a} className="cell"><div className="k">{a}</div><div className="num" style={{ fontWeight: 650 }}>{b}</div></div>)}</div>
      <p className="small" style={{ margin: '8px 0 0' }}>{rm.liquidity}</p>
      <p className="small mute" style={{ margin: '4px 0 0' }}>The daily move is the average true range; the 20-session swing is that times √20, a rough guide, not a forecast. Stops tighter than an ordinary day get hit by noise.</p></Sec>
    {fr && fac.data && <Sec title="Indicator fingerprint" head={`${Object.keys(fr).length} less common indicators, ranked among ${fac.data.universe} stocks`}>
      {Object.entries(fr).map(([k, v]) => { const m = FACTOR_META[k]; if (!m) return null; const st = fac.data!.study?.[k]; const tag = !st ? '' : st.kind === 'common baseline' ? 'common indicator' : st.adopt ? 'passed the study' : 'did not pass the study';
        return <div key={k} style={{ marginBottom: 10 }}><div className="row between small"><span>{m.label}</span><span className={`tag ${st?.adopt ? 'lime' : ''}`} style={{ fontSize: '0.625rem' }}>{tag}</span></div>
          <div className="contrib" style={{ gridTemplateColumns: '1fr auto', margin: '4px 0 0' }}><span className="bar2"><i style={{ width: `${v}%`, left: 0, background: v >= 66 ? 'var(--lime)' : v <= 33 ? 'var(--peach)' : 'var(--dim)' }} /></span><span className="num small">{Math.round(v)}</span></div>
          <div className="small mute">{v >= 66 ? m.high : v <= 33 ? m.low : 'in the middle of the pack'}</div></div>; })}
      <p className="small" style={{ margin: '6px 0 0' }}>Each bar is the stock's rank among eligible names, 100 being the end the research calls favourable. As of {dayWord(fac.data.as_of)}.</p>
      {(() => { const cands = Object.values(fac.data.study ?? {}).filter((s) => s.kind === 'candidate'); const passed = cands.filter((s) => s.adopt).length;
        return cands.length ? <p className={`small ${passed ? '' : 'down'}`} style={{ margin: '4px 0 0' }}>{passed ? `${passed} of ${cands.length} less common indicators passed our pre-registered test on ten years of Indian prices; the rest did not.` : `None of the ${cands.length} less common indicators passed our pre-registered test on ten years of Indian prices. Read this as description, not as a signal.`}</p> : null; })()}</Sec>}
    {!fr && !fac.loading && <p className="small mute" style={{ margin: '6px 0 0' }}>The indicator fingerprint appears once the nightly factor sheet has run.</p>}
  </>;
}
