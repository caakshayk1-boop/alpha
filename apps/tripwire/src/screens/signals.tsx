import { useMemo, useState } from 'react';
import { go } from '../app.tsx';
import { useEnginesV3, useScreen, useSignals } from '../data.ts';
import { Seg, Empty, Icon } from '../ui.tsx';
import { Failed, Head, Loading, PageBar } from './common.tsx';
import { RULES, THEMES, WIDE_SHARE, printValue, runRules } from '../../../../src/lib/rules.ts';
import { ENGINES, LIFECYCLE, STATE_WORD } from '../engines.ts';
import { dayWord, inr, pct } from '../fmt.ts';

type Seg = 'rules' | 'engines' | 'ledger';
export function Signals({ seg }: { seg: string }) {
  const v: Seg = seg === 'engines' || seg === 'ledger' ? seg : 'rules';
  return <div>
    <PageBar title="Signals" sub="Paper only. Nothing here is advice." />
    <Seg label="Signals view" value={v} onChange={(x) => go(`/signals?v=${x}`)} items={[{ id: 'rules', label: 'Rules' }, { id: 'engines', label: 'Engines' }, { id: 'ledger', label: 'Paper ledger' }]} />
    {v === 'rules' ? <RuleBoard /> : v === 'engines' ? <Engines /> : <Ledger />}
  </div>;
}
function RuleBoard() {
  const scr = useScreen(); const [theme, setTheme] = useState<string>('All');
  const out = useMemo(() => (scr.data ? runRules(scr.data.rows as never) : null), [scr.data]);
  if (scr.loading) return <Loading what="the rules" />;
  if (scr.err || !out) return <Failed what="the rules" err={scr.err ?? 'no data'} retry={scr.retry} />;
  const list = out.results.filter((r) => theme === 'All' || r.rule.theme === theme);
  return <>
    <p className="dim" style={{ margin: '0 0 12px' }}>Ten fixed public tests run on {out.liquid} liquid names at the close of {dayWord(scr.data!.as_of)}. A rule firing describes price and volume. It is not a recommendation, target or probability.</p>
    <div className="chips" role="group" aria-label="Theme">{['All', ...THEMES].map((t) => <button key={t} className="chip" aria-pressed={theme === t} onClick={() => setTheme(t)}>{t}</button>)}</div>
    {list.map((r) => <details key={r.rule.id} className="ev"><summary>
      <span className="grow"><span style={{ display: 'block' }}>{r.rule.title}</span><span className="small dim" style={{ fontWeight: 400 }}>{r.rule.check.length > 70 ? r.rule.check.slice(0, 68) + '…' : r.rule.check}</span></span>
      <span className="tag lime num">{r.hits.length}</span><span className="chev">▾</span></summary>
      <div className="body">
        {r.wide && <div className="note" style={{ marginBottom: 10 }}>This rule fires on {Math.round((r.share ?? 0) * 100)}% of liquid names (the line is {WIDE_SHARE * 100}%). It describes the market, not a stock.</div>}
        <p className="small dim" style={{ marginTop: 0 }}>{r.rule.check}{r.unmeasured ? ` ${r.unmeasured} names lacked a figure and are counted as unmeasured, not as misses.` : ''}</p>
        {r.hits.length ? <div className="list">{r.hits.slice(0, 8).map((h) => <a key={h.sym} className="li" href={`#/c/${h.sym}`}><span className="grow"><span className="sym">{h.sym}</span><span className="dim small trunc" style={{ display: 'block' }}>{h.name}</span></span><span className="px num"><b>{inr(h.price)}</b><span className="dim">{r.rule.measure.label} {printValue(r.rule, h.value)}</span></span></a>)}</div>
          : <span className="dim">Nothing fired.</span>}
        {r.hits.length > 8 && <p className="mute small">Showing 8 of {r.hits.length}, most notable first.</p>}
      </div></details>)}
  </>;
}
function Engines() {
  const v3 = useEnginesV3(); const sig = useSignals();
  const feed = v3.data;
  const rows = ENGINES.map((e) => ({ ...e, state: (feed?.engines?.[e.id]?.state as typeof e.state) ?? e.state, why: feed?.engines?.[e.id]?.why ?? e.why }));
  return <>
    <div className="note info" style={{ marginBottom: 12 }}><b>Alerts are off.</b> No engine has met its evidence bar, so none can alert. {sig.data ? sig.data.alert_why : ''}</div>
    <p className="dim small" style={{ margin: '0 0 8px' }}>{feed ? `Published feed, data through ${dayWord(feed.data_watermark)}.` : 'The nightly engine feed is not published yet, so this is the last decision record (22 Oct 2026), not live output.'}</p>
    {rows.map((e) => { const i = LIFECYCLE.indexOf(e.state); return <div key={e.id} className="card"><div className="row between"><div><span className="k">{e.id}</span><div style={{ fontWeight: 650 }}>{e.name}</div></div><span className={`tag ${e.state === 'PAPER' || e.state === 'VALIDATED' ? 'lime' : e.state === 'RETIRED' || e.state === 'BLOCKED_DATA' ? 'peach' : ''}`}>{STATE_WORD[e.state]}</span></div>
      <div className="stage" role="img" aria-label={`Lifecycle position: ${STATE_WORD[e.state]}`}>{LIFECYCLE.map((s, k) => <i key={s} className={k <= i ? (e.state === 'RETIRED' || e.state === 'BLOCKED_DATA' ? 'off' : 'on') : ''} />)}</div>
      <p className="dim small" style={{ margin: '8px 0 0' }}>{e.why}</p></div>; })}
    <p className="mute small">Lifecycle: blocked (data) → research → paper → validated → paused or retired. Rankings are not win probabilities. Promotion needs far more independent observations than any engine has.</p>
  </>;
}
function Ledger() {
  const v3 = useEnginesV3(); const sig = useSignals();
  const f = v3.data;
  const Sec = ({ title, n, children }: { title: string; n: number; children: React.ReactNode }) => <><Head aside={<span className="tag num">{n}</span>}>{title}</Head>{children}</>;
  return <>
    <Sec title="Forming setups" n={f?.forming?.length ?? 0}>{f?.forming?.length ? f.forming.map((x) => <div key={x.engine + x.symbol} className="card"><b>{x.symbol}</b> <span className="tag">{x.engine}</span><p className="small dim" style={{ margin: '6px 0 0' }}>Met: {x.met}. Missing: {x.missing}.</p></div>) : <Empty title="None forming">{f ? 'No engine has a candidate waiting on a trigger.' : 'The engine feed is not published yet.'}</Empty>}</Sec>
    <Sec title="Paper signals" n={f?.paper?.length ?? 0}>{f?.paper?.length ? f.paper.map((x) => <a key={x.id} href={`#/c/${x.symbol}`} className="card" style={{ display: 'block' }}><b>{x.symbol}</b> <span className="tag">{x.engine}</span><p className="small dim" style={{ margin: '6px 0 0' }}>{x.entry_rule ?? 'Entry rule not stated'}{x.invalidation ? ` · invalidation ${inr(x.invalidation)}` : ''}</p></a>) : <Empty title="No paper signals">Swing v2 {sig.data?.gate.on ? 'is on but filed nothing' : 'is gated off'}; the six engines have filed nothing yet. Rules are never weakened to fill this list.</Empty>}</Sec>
    <Sec title="Validated alerts" n={f?.validated?.length ?? 0}><Empty title="None, by design">An engine reaches this list only after its pre-registered evidence bar. None has.</Empty></Sec>
    <Sec title="Closed paper record" n={f?.closed?.length ?? sig.data?.record.closed ?? 0}>{f?.closed?.length ? f.closed.map((x) => <div key={x.id} className="card"><b>{x.symbol}</b> <span className="tag">{x.engine}</span> <span className="num">{x.r_net == null ? 'R not recorded' : `${x.r_net > 0 ? '+' : '−'}${Math.abs(x.r_net).toFixed(2)}R after costs`}</span></div>) : <Empty title="No closed trades">{sig.data ? `Swing v2 has closed ${sig.data.record.closed} paper trades since ${dayWord(sig.data.launched)}.` : 'The record is not available.'} A record of zero is not a record.</Empty>}</Sec>
    <p className="mute small">Paper ledger: planned entries, not fills. Tripwire places no orders.</p>
  </>;
}
void pct; void Icon;
