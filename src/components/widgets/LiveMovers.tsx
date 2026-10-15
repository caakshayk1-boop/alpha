'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Chg, Flash, Rv, Skel } from '@/components/ui';
import { snapLabel, useToday } from '@/components/widgets/DayContext';
import { num, pct } from '@/lib/format';
import { istDate, type LiveSnap, type Universe } from '@/lib/live';
import { companyHref } from '@/lib/slug';

export interface Mover { sym: string; name: string; pct: number; price: number }

/** Beyond this one-day move the change is held out of the ranking and named instead: on 15 Oct 2026 the only such row was a
 *  stock whose previous close (13.83) was ten times below its price (138.50), the shape of a share consolidation the feed's
 *  previous close does not reflect, not a 901% day. */
export const HOLD_OUT_PCT = 20;

/** Top `n` risers and fallers by one-day % in the live snapshot, over the screen's universe only. Only stocks that traded in
 *  the snapshot's own session count (a suspended or renamed symbol keeps an old price); moves beyond ±HOLD_OUT_PCT are
 *  returned separately. A riser must be above zero and a faller below it: on a day with three gainers the list has three,
 *  never a "gainer" that fell. Ties sort by symbol. */
export function topMovers(snap: LiveSnap, uni: Universe, n = 5): { up: Mover[]; down: Mover[]; counted: number; stale: number; held: Mover[] } {
  const all: Mover[] = [];
  const held: Mover[] = [];
  let stale = 0;
  for (const [sym, , name] of uni.rows) {
    const p = snap.pct[sym], px = snap.price[sym], t = snap.at[sym];
    if (typeof p !== 'number' || typeof px !== 'number' || typeof t !== 'number') continue;
    if (istDate(t) !== snap.session) { stale++; continue; }
    (Math.abs(p) > HOLD_OUT_PCT ? held : all).push({ sym, name, pct: p, price: px });
  }
  const up = all.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct || a.sym.localeCompare(b.sym)).slice(0, n);
  const down = all.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct || a.sym.localeCompare(b.sym)).slice(0, n);
  return { up, down, counted: all.length, stale, held };
}

/** Today's biggest one-day moves among the screened stocks, from /api/live. Labelled live only when the prices are a newer
 *  session than the end-of-day screen; with no live prices it says so and shows no list. */
export function LiveMovers() {
  const t = useToday();
  const snap = t?.live.snap ?? null;
  const uni = t?.live.universe ?? null;
  const m = useMemo(() => (snap && uni ? topMovers(snap, uni) : null), [snap, uni]);
  const label = snap ? snapLabel(snap, t?.screenAsOf ?? null) : null;
  const loading = !t || (t.live.loading && !snap);
  return (
    <Rv className="panel lw" >
      <div className="lw-h">
        <h2>Today&apos;s movers</h2>
        {label && <span className={`lw-stamp${label.live ? ' on' : ''}`}>{label.text}</span>}
      </div>
      {loading ? (
        <div className="lw-cols" aria-hidden>{[0, 1].map((c) => <div key={c}>{Array.from({ length: 5 }, (_, i) => <Skel key={i} h={40} style={{ margin: '8px 0' }} />)}</div>)}</div>
      ) : !m || !uni ? (
        <p className="muted lw-empty">Live prices are not available right now{t?.live.error ? ` (${t.live.error})` : ''}. No movers are shown in their place; the week&apos;s movers further down come from the end-of-day screen.</p>
      ) : (
        <>
          <div className="lw-cols">
            <MoverList title="Rose most" list={m.up} />
            <MoverList title="Fell most" list={m.down} />
          </div>
          <p className="dim lw-foot">
            One-day change against the previous close, ranked over {num(m.counted)} of {num(uni.count)} screened stocks that traded in this session
            {m.stale > 0 ? ` (${m.stale} with no trade in it left out)` : ''}.
            {m.held.length > 0 && <> Held out as a likely split or bonus the previous close does not reflect: {m.held.map((h) => `${h.sym} ${pct(h.pct, 0)}`).join(', ')}.</>}
            {' '}Prices from Yahoo Finance, cached up to a minute.
          </p>
        </>
      )}
    </Rv>
  );
}

function MoverList({ title, list }: { title: string; list: Mover[] }) {
  return (
    <div>
      <h3 className="eyebrow lw-sub">{title}</h3>
      {list.length === 0 ? <p className="dim" style={{ margin: '8px 0 0', fontSize: 14 }}>None in this snapshot.</p> : (
        <ol className="list lw-list">
          {list.map((x) => (
            <li key={x.sym}>
              <Link href={companyHref(x.sym)} className="li">
                <div style={{ minWidth: 0 }}><div className="t">{x.sym}</div><div className="s lw-nm">{x.name}</div></div>
                <div style={{ textAlign: 'right' }}>
                  <Flash value={x.pct}><Chg v={x.pct} /></Flash>
                  <div className="s num">₹{num(x.price, 2)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
