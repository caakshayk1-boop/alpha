'use client';

import { useState } from 'react';
import { InstrumentSheet } from '@/components/InstrumentSheet';
import { Chg, Flash, Rv } from '@/components/ui';
import { useLiveQuotes } from '@/lib/data';
import { num, quoteState } from '@/lib/format';
import type { Quote } from '@/lib/types';

/** The seven numbers people check first, in a fixed order. Each states its own last-trade time: markets keep different hours
 *  (gold and Brent trade while NSE is shut), so no group label claims "live". Nothing scrolls by itself; on a phone the strip
 *  scrolls sideways inside its own box and the page never does. */
export const STRIP_IDS = ['nifty', 'sensex', 'banknifty', 'vix', 'usdinr', 'gold', 'brent'] as const;
const NAMES: Record<(typeof STRIP_IDS)[number], string> = { nifty: 'Nifty 50', sensex: 'Sensex', banknifty: 'Nifty Bank', vix: 'India VIX', usdinr: 'USD/INR', gold: 'Gold', brent: 'Brent' };

export function IndexStrip() {
  const q = useLiveQuotes();
  const byId = new Map((q.data?.quotes ?? []).map((x) => [x.id, x] as const));
  const [open, setOpen] = useState<string | null>(null);
  const sheet = open ? byId.get(open) : undefined;
  return (
    <section className="wrap istrip-sec" aria-labelledby="istrip-h">
      <h2 id="istrip-h" className="eyebrow istrip-h">Indices, rupee and commodities · each with its own last-trade time</h2>
      <Rv>
        {/* a scrolling region must be reachable by keyboard, so it takes focus */}
        <div className="istrip" role="region" aria-label="Index, currency and commodity quotes, scrolls sideways" tabIndex={0}>
          <ul>
            {STRIP_IDS.map((id) => <Item key={id} id={id} q={byId.get(id)} loading={q.loading} onOpen={() => setOpen(id)} />)}
          </ul>
        </div>
      </Rv>
      {sheet && typeof sheet.price === 'number' && <InstrumentSheet q={sheet} onClose={() => setOpen(null)} />}
      {q.error && !q.data && <p className="dim istrip-note">Quotes could not be loaded ({q.error}). Nothing is estimated in their place.</p>}
    </section>
  );
}

function Item({ id, q, loading, onOpen }: { id: (typeof STRIP_IDS)[number]; q: Quote | undefined; loading: boolean; onOpen: () => void }) {
  const ok = q && typeof q.price === 'number' ? q : null;
  const st = ok ? quoteState(ok.at) : null;
  return (
    <li className={`istrip-i${ok ? ' qbtn' : ''}`} title={ok && st ? `${ok.name}: ${st.label}${ok.group === 'Commodities' ? ' (futures contract)' : ''}` : undefined}>
      {ok && <button type="button" className="qhit" onClick={onOpen} aria-label={`${NAMES[id]}: open levels, ranges and returns`} />}
      <span className="nm">{NAMES[id]}</span>
      <span className="px num">
        {ok ? <Flash value={ok.price}>{ok.prefix}{num(ok.price, ok.dp)}</Flash> : loading ? <span className="skel" style={{ display: 'inline-block', width: 84, height: 18 }} aria-hidden /> : '—'}
      </span>
      <span className="ch">{ok ? <Flash value={ok.pct ?? null}><Chg v={ok.pct} /></Flash> : loading ? ' ' : <span className="dim">unavailable</span>}</span>
      <span className="qt">{st ? st.label : ' '}</span>
    </li>
  );
}
