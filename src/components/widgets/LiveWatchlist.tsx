'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Chg, Flash, Rv, Skel } from '@/components/ui';
import { snapLabel, useToday } from '@/components/widgets/DayContext';
import { dateLabel, num } from '@/lib/format';
import { istDate } from '@/lib/live';
import { companyHref } from '@/lib/slug';
import { useStoredList } from '@/lib/store';

const SHOW = 8;

/** The reader's watchlist (kept in this browser) with each name's live price and one-day change from /api/live. A symbol the
 *  snapshot does not carry says so; nothing is filled in. */
export function LiveWatchlist() {
  const t = useToday();
  const [watch] = useStoredList('alpha-watchlist');
  const snap = t?.live.snap ?? null;
  const names = useMemo(() => new Map((t?.live.universe?.rows ?? []).map(([s, , n]) => [s, n] as const)), [t?.live.universe]);
  const label = snap ? snapLabel(snap, t?.screenAsOf ?? null) : null;
  const loading = !t || (t.live.loading && !snap);
  return (
    <Rv className="panel lw">
      <div className="lw-h">
        <h2>Your watchlist, live</h2>
        {label && watch.length > 0 && <span className={`lw-stamp${label.live ? ' on' : ''}`}>{label.text}</span>}
      </div>
      {watch.length === 0 ? (
        <div className="lw-empty">
          <p className="muted" style={{ margin: 0 }}>Nothing on your watchlist yet. Add a company from the screen or from its own page, and its price and today&apos;s move will show here. The list is kept in this browser only.</p>
          <Link className="btn ghost" href="/screen/" style={{ marginTop: 14 }}>Find stocks on the screen →</Link>
        </div>
      ) : (
        <>
          {!loading && !snap && <p className="muted lw-empty" style={{ marginBottom: 4 }}>Live prices are not available right now{t?.live.error ? ` (${t.live.error})` : ''}. Nothing is estimated in their place.</p>}
          <ul className="list lw-list">
            {watch.slice(0, SHOW).map((sym) => {
              const p = snap?.pct[sym], px = snap?.price[sym], at = snap?.at[sym];
              // a symbol with no trade in this session (suspended, renamed) keeps an old price: show it with its date, no "today" move
              const stale = !!snap && typeof at === 'number' && istDate(at) !== snap.session;
              return (
                <li key={sym}>
                  <Link href={companyHref(sym)} className="li">
                    <div style={{ minWidth: 0 }}><div className="t">{sym}</div><div className="s lw-nm">{names.get(sym) ?? 'Not in the screened universe'}</div></div>
                    <div style={{ textAlign: 'right' }}>
                      {loading ? <Skel h={18} w={72} /> : stale && typeof px === 'number' && typeof at === 'number' ? (
                        <><span className="num">₹{num(px, 2)}</span><div className="s dim">last traded {dateLabel(istDate(at))}</div></>
                      ) : typeof p === 'number' && typeof px === 'number' ? (
                        <><Flash value={p}><Chg v={p} /></Flash><div className="s num">₹{num(px, 2)}</div></>
                      ) : <span className="s dim">no live price</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link className="more lw-more" href="/watchlist/">{watch.length > SHOW ? `All ${watch.length} on your watchlist →` : 'Open your watchlist →'}</Link>
        </>
      )}
    </Rv>
  );
}
