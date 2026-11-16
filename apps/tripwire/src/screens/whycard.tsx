import { useMemo } from 'react';
import { useFactors } from '../data.ts';
import type { Row } from '../screen.ts';
import type { EngineDef, EngineId, Evaluation } from '../quant.ts';
import { whyLines } from '../whystock.ts';
import { ShareRow } from './sharerow.tsx';

interface PickIn { sym: string; engine: string; asOf: string; ref: number; stop: number; final: boolean }
/** "Why this stock?" (4.0, F4): the lead of the company page, in plain sentences made from the real values. A missing value drops its sentence. */
export function WhyCard({ sym, row, evals, picks }: { sym: string; row: Row; evals: readonly { e: EngineDef; ev: Evaluation }[]; picks: readonly PickIn[] }) {
  const fac = useFactors();
  const pick = useMemo(() => picks.filter((p) => p.sym === sym && !p.final).sort((a, b) => b.asOf.localeCompare(a.asOf))[0] ?? null, [picks, sym]);
  const lines = useMemo(() => whyLines({
    sym, row, engines: evals.length ? evals.map((x) => ({ id: x.e.id, name: x.e.name, pass: x.ev.pass })) : null,
    pick: pick ? { engine: pick.engine as EngineId, asOf: pick.asOf, ref: pick.ref, stop: pick.stop } : null,
    factors: fac.data?.rows[sym] ? { universe: fac.data.universe, values: fac.data.rows[sym] } : null,
  }), [sym, row, evals, pick, fac.data]);
  if (!lines.length) return null;
  return <section className="card co-why" aria-labelledby="why-h" data-why>
    <h2 id="why-h" className="sec">Why this stock?</h2>
    <ul className="why-list">{lines.map((l) => <li key={l.id} data-why-line={l.id}>{l.text}</li>)}</ul>
    {pick && <ShareRow sym={sym} />}
    <p className="small mute">Written from the screen and the ledger, not by a model. A missing figure is left out. Paper research, not advice.</p>
  </section>;
}
