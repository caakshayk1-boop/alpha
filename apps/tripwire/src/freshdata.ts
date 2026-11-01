/** The facts the freshness module judges, gathered from the feeds the app already reads (nothing new is fetched beyond /data/freshness.json, written by the build). The STATUS of each
 *  file is never stored: it is computed here from the clock by freshness.ts, so a tab left open past the next close turns amber by itself. */
import { useEffect, useMemo, useState } from 'react';
import { useJson, useLedger, useFactors, useScreen, useSignals, type RsiSheet } from './data.ts';
import { gateLine } from './components/gate.ts';
import { ledgerRowNote, signalsRowNote } from './coverage.ts';
import { assessFiles, FILE_IDS, type FileFact, type FileId } from './freshness.ts';
import { breadthGap } from './universe.ts';

interface Manifest { files: { id: FileId; asOf: string | null; built: string | null; rows: number | null; oldest?: string | null }[] }
export function useFreshness() {
  const man = useJson<Manifest>('/data/freshness.json'); const scr = useScreen(); const led = useLedger(); const rsi = useJson<RsiSheet>('/api/rsi'); const fac = useFactors(); const sig = useSignals();
  const [now, setNow] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  return useMemo(() => {
    const facts: FileFact[] = []; const pending: FileId[] = []; const by = Object.fromEntries((man.data?.files ?? []).map((f) => [f.id, f]));
    if (man.loading) pending.push('screen', 'companies', 'signals');
    else for (const id of ['screen', 'companies', 'signals'] as const) { const f = by[id]; facts.push({ id, asOf: f ? f.asOf : null, built: f?.built ?? null, rows: f?.rows ?? null, note: id === 'companies' && f?.oldest && f.oldest !== f.asOf ? `oldest row ${f.oldest}` : id === 'signals' ? signalsRowNote(f?.rows ?? null, gateLine(sig.data)) : undefined }); }
    if (scr.data) facts.push({ id: 'breadth', asOf: scr.data.as_of, built: scr.data.built_at ?? null, rows: breadthGap(scr.data.rows).counted, note: 'read from the screen, re-priced live' }); else if (scr.loading) pending.push('breadth');
    if (led.loading) pending.push('ledger'); else { const L = led.data?.ledger; facts.push({ id: 'ledger', asOf: L?.days?.length ? L.days[L.days.length - 1].asOf : null, built: L?.updated ?? null, rows: L?.picks?.length ?? null, note: ledgerRowNote(L) }); }
    if (rsi.loading) pending.push('rsi'); else facts.push({ id: 'rsi', asOf: rsi.data?.ok ? rsi.data.as_of : null, rows: rsi.data?.ok ? Object.keys(rsi.data.rows ?? {}).length : null, note: rsi.data?.ok ? undefined : 'not available right now' });
    if (fac.loading) pending.push('factors'); else facts.push({ id: 'factors', asOf: fac.data?.ok ? fac.data.as_of : null, rows: fac.data?.ok ? fac.data.universe : null, note: fac.data?.ok ? undefined : 'not available right now' });
    facts.sort((a, b) => FILE_IDS.indexOf(a.id) - FILE_IDS.indexOf(b.id));
    return { ...assessFiles(facts, now), loading: pending.length > 0, waiting: pending, now };
  }, [man.data, man.loading, sig.data, scr.data, scr.loading, led.data, led.loading, rsi.data, rsi.loading, fac.data, fac.loading, now]);
}
