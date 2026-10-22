'use client';

// Signal engines v3 (research): the four views from engines_v3.json, with its truthful missing and stale states (lib/enginesV3.ts).
import { useEnginesV3 } from '@/lib/data';
import { viewModel } from '@/lib/enginesV3';
import { Rv, StatusChip } from '@/components/ui';

export function EnginesV3() {
  const f = useEnginesV3();
  if (f.loading) return null;
  const vm = viewModel(f.error ? null : f.data, new Date());
  return (
    <section className="wrap section" aria-labelledby="v3-h">
      <div className="eyebrow">Signal engines v3 · research</div>
      <h2 id="v3-h" className="disp" style={{ fontSize: 'clamp(26px, 3vw, 34px)', margin: '8px 0 6px' }}>Six engines, each tested on its own</h2>
      <p className={vm.status === 'stale' ? 'notice warn' : 'muted'} style={{ maxWidth: '72ch' }} role={vm.status === 'stale' ? 'status' : undefined}>{vm.note}</p>
      {vm.engines.length > 0 && (
        <ul className="v3-eng">
          {vm.engines.map((e) => <li key={e.id}><b>{e.id}</b> {e.name} <StatusChip kind={e.state === 'Validated' ? 'observed' : 'experimental'}>{e.state}</StatusChip>{e.why ? <span className="dim"> · {e.why}</span> : null}</li>)}
        </ul>
      )}
      <div className="v3-views">
        {vm.views.map((v) => (
          <div key={v.key} className="panel tight">
            <h3 className="eyebrow" style={{ margin: 0 }}>{v.title} · {v.cards.length}</h3>
            {v.cards.length === 0 ? <p className="dim" style={{ margin: '8px 0 0', fontSize: 14 }}>{v.empty}</p> : (
              <ul className="v3-cards">
                {v.cards.slice(0, 12).map((c) => (
                  <Rv as="li" key={c.key} className="v3-card">
                    <div className="v3-card-h"><b>{c.symbol}</b><span className="tag">{c.badge}</span></div>
                    <div className="dim" style={{ fontSize: 13 }}>{c.engine} · {c.engineName} · as of {c.asOf}</div>
                    <ul>{c.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                  </Rv>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
