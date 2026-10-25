'use client';

// Signal engines v3 (research): the four views from engines_v3.json, with its truthful missing and stale states (lib/enginesV3.ts).
// "compact" is the Setups view's one-card status; "full" is the Method view's section with the four views.
import { useEnginesV3 } from '@/lib/data';
import Link from 'next/link';
import { FUNNEL_STAGES, STATE_WORD, healthModel, lifecycleRows, viewModel } from '@/lib/enginesV3';
import { sessionLabel } from '@/lib/price';
import { LIFECYCLE_TONE, type Lifecycle } from '@/lib/signalsView';

export function EnginesV3({ mode = 'full', onMethod }: { mode?: 'compact' | 'full'; onMethod?: () => void }) {
  const f = useEnginesV3();
  if (f.loading) return null;
  const feed = f.error ? null : f.data;
  const vm = viewModel(feed, new Date());
  const reg = lifecycleRows(feed);
  const hm = healthModel(feed, new Date());
  const status = vm.status === 'missing' ? ['warn', 'Not published'] : vm.status === 'stale' ? ['warn', 'Stale'] : ['acc', 'Published'];
  const chips = (
    <ul className="sg-chips" aria-label={`Lifecycle of each v3 engine, ${reg.source === 'feed' ? 'from the feed' : 'decision record of'} ${sessionLabel(reg.asOf)}`}>
      {reg.rows.map((r) => { const w = (STATE_WORD[r.state] ?? 'Research') as Lifecycle; return <li key={r.id} title={`${r.name}: ${r.why}`}><b>{r.id}</b><span className={`pill ${LIFECYCLE_TONE[w] ?? ''} nodot`}>{w}</span></li>; })}
    </ul>
  );
  // Lane A 0.2.4: with nothing in any view, one line replaces four empty record boxes; the lifecycle stays visible.
  const empty = vm.views.every((v) => v.cards.length === 0);
  const LINE = 'v3 records open when the first engine passes validation. The bar is a holdout t of +2.0, published either way.';
  if (mode === 'compact') {
    return (
      <section className="section2 sg-sec" aria-labelledby="v3-h">
        <div className="card sg-v3">
          <div className="card-h"><h2 id="v3-h">Signal engines v3 <span className="dim sg-h-note">· research</span></h2><span className={`pill ${status[0]}`}>{status[1]}</span></div>
          <p className={vm.status === 'stale' ? 'sg-v3-note warn' : 'sg-v3-note'} role={vm.status === 'stale' ? 'status' : undefined}>{empty && vm.status !== 'stale' ? LINE : vm.note}{vm.status === 'missing' ? ' No v3 setup appears on this page, and none of their research counts toward Swing v2.' : ''}</p>
          {chips}
          {onMethod && <p className="card-foot">States as of {sessionLabel(reg.asOf)}. <button type="button" className="link sg-linkbtn" onClick={onMethod}>Each engine&apos;s reason, under Method and validation</button></p>}
        </div>
      </section>
    );
  }
  return (
    <section className="section2 sg-sec" aria-labelledby="v3f-h">
      <div className="card-h"><div><h2 id="v3f-h" className="sec-title">Signal engines v3, each tested on its own</h2><p className="sec-sub">{vm.note}</p></div><span className={`pill ${status[0]}`}>{status[1]}</span></div>
      {empty ? (
        <div className="card sg-v3">
          <p className="sg-v3-note">{LINE}</p>
          {chips}
        </div>
      ) : (
      <div className="grid-2 sg-v3views">
        {vm.views.map((v) => (
          <div key={v.key} className="card tight">
            <div className="card-h"><h3>{v.title}</h3><span className="dim num sg-h-note">{v.cards.length}</span></div>
            {v.cards.length === 0 ? <p className="dim sg-note">{v.empty}</p> : (
              <ul className="rows">
                {v.cards.slice(0, 12).map((c) => (
                  <li key={c.key} className="sg-v3card">
                    <div className="sg-v3card-h"><b>{c.symbol}</b><span className="pill nodot">{c.badge}</span></div>
                    <div className="dim sg-sub">{c.engine} · {c.engineName} · as of {c.asOf}</div>
                    <ul>{c.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                    {c.links.length > 0 && <p className="sg-v3links">{c.links.map((l) => <Link key={l.label} className="link" href={l.href}>{l.label}</Link>)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      )}
      {hm.status !== 'missing' && (
        <div className="card tight sg-health" aria-labelledby="v3h-h">
          <div className="card-h"><h3 id="v3h-h">Engine health and what was excluded</h3><span className={`pill ${hm.status === 'ok' ? 'acc' : 'warn'}`}>{hm.status === 'ok' ? 'Current' : 'Stale'}</span></div>
          <p className="sg-note" role={hm.status === 'stale' ? 'status' : undefined}>{hm.line}</p>
          {hm.rows.length > 0 ? (
            <div className="sg-table-wrap">
              <table className="sg-table">
                <caption className="sr">Symbols remaining after each filter, on the latest session, per engine</caption>
                <thead><tr><th scope="col">Engine</th>{FUNNEL_STAGES.map((s) => <th key={s.id} scope="col" title={s.why}>{s.label}</th>)}</tr></thead>
                <tbody>{hm.rows.map((r) => <tr key={r.engine}><th scope="row">{r.engine} <span className="dim">{r.state}</span></th>{r.stages.map((n, i) => <td key={FUNNEL_STAGES[i].id} className="num" title={n === null ? FUNNEL_STAGES[i].why : undefined}>{n === null ? '—' : n.toLocaleString('en-IN')}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : <p className="dim sg-note">This feed carries no exclusion counts.</p>}
          <p className="card-foot">A dash means the stage is not decided on the night: whether an order can be filled is settled at the next open, and the portfolio limits apply to the whole book. An engine that is retired or paused is not run, so it has no row.{hm.detail.length > 0 && <> {hm.detail.join(' · ')}.</>}</p>
        </div>
      )}
    </section>
  );
}
