'use client';
/** A quick look at one company without leaving the page you are on, plus the two small visuals it is built from.
 *  Everything shown is a figure already on the screen feed; the two lists are the same rules `decide()` uses on the company page. */
import Link from 'next/link';
import { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Chg } from '@/components/ui';
import { decide } from '@/lib/decision';
import { useSignals, useFeed, useLive } from '@/lib/data';
import { priceLabel, priceView } from '@/lib/price';
import { crore, num } from '@/lib/format';
import { ordinal } from '@/lib/status';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';
import { useModal } from '@/lib/useModal';

const fin = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const FACTORS = [['Quality', 'Q', 'q'], ['Growth', 'G', 'g'], ['Value', 'V', 'v'], ['Technical', 'T', 'tech']] as const;

/** Four percentile bars (Quality, Growth, Value, Technical). One hue for all four: a percentile is a position among peers, not a verdict,
 *  so it never borrows the green and red that mean a gain or a loss. The tick marks the median company (50). */
export function FactorStrip({ row }: { row: Row }) {
  const label = FACTORS.map(([name, , k]) => `${name} ${fin(row[k]) ? `${ordinal(row[k] as number)} percentile` : 'not scored'}`).join(', ');
  return (
    <div className="factors" role="img" aria-label={label}>
      {FACTORS.map(([name, initial, k]) => {
        const v = row[k];
        return (
          <div key={k} className="factor" title={`${name}: ${fin(v) ? `${ordinal(v)} percentile within the screen` : 'not scored'}`}>
            <span className="factor-h"><span>{initial}</span><b className="num">{fin(v) ? Math.round(v) : '–'}</b></span>
            <span className="factor-bar"><i style={{ width: `${fin(v) ? Math.max(0, Math.min(100, v)) : 0}%` }} /><u aria-hidden /></span>
          </div>
        );
      })}
    </div>
  );
}

/** Where the price sits between its 52-week low and high, with the 50- and 200-day averages marked. The marks are named in text underneath, so no mark relies on colour. */
export function RangeBar({ row }: { row: Row }) {
  const { price, low52, high52, sma50, sma200 } = row;
  if (!fin(price) || !fin(low52) || !fin(high52) || high52 <= low52) return <p className="dim" style={{ fontSize: 14, margin: 0 }}>52-week range not available.</p>;
  const at = (v: number) => Math.max(0, Math.min(100, ((v - low52) / (high52 - low52)) * 100));
  const p = at(price);
  const above200 = fin(sma200) ? price >= sma200 : null;
  return (
    <div className="rangebar">
      <div className="rangebar-ends num"><span>₹{num(low52, 2)}</span><span>₹{num(high52, 2)}</span></div>
      <div className="rangebar-track" role="img" aria-label={`Price is ${p.toFixed(0)}% of the way from the 52-week low to the high${above200 === null ? '' : `, ${above200 ? 'above' : 'below'} its 200-day average`}`}>
        {fin(sma200) && <span className="mark m200" style={{ left: `${at(sma200)}%` }} />}
        {fin(sma50) && <span className="mark m50" style={{ left: `${at(sma50)}%` }} />}
        <span className="dot" style={{ left: `${p}%` }} />
      </div>
      <div className="rangebar-key num">
        <span><i className="k-dot" /> Price ₹{num(price, 2)}</span>
        {fin(sma50) && <span><i className="k-50" /> 50-day ₹{num(sma50, 0)}</span>}
        {fin(sma200) && <span><i className="k-200" /> 200-day ₹{num(sma200, 0)}</span>}
      </div>
    </div>
  );
}


/** Slide-over for one company. Opens over the current page so filters, scroll position and unfinished work stay where they were. */
export function CompanyPeek({ sym, onClose }: { sym: string | null; onClose: () => void }) {
  const scr = useFeed('screen');
  const eng = useSignals();
  const panel = useRef<HTMLDivElement>(null);
  const row = useMemo(() => (sym ? scr.data?.rows.find((r) => r.sym === sym) ?? null : null), [sym, scr.data]);
  const lv = useLive();
  const pv = row ? priceView(row.sym, row, lv.snap) : null;
  const mine = useMemo(() => (eng.data?.signals ?? []).filter((s) => s.sym === sym && (s.status === 'open' || s.status === 'pending')), [eng.data, sym]);
  const read = useMemo(() => (row ? decide(row, mine) : null), [row, mine]);

  useModal(panel, !!sym, onClose);

  if (!sym) return null;
  const href = companyHref(sym);
  return createPortal(
    <div className="peek-back" onClick={onClose}>
      <div ref={panel} className="peek" role="dialog" aria-modal="true" aria-label={`${sym}: quick look`} onClick={(e) => e.stopPropagation()}>
        <div className="peek-top">
          <span className="eyebrow">Quick look</span>
          <button type="button" className="chip" data-close onClick={onClose} aria-label="Close quick look">Close ✕</button>
        </div>
        {!row ? (
          <p className="muted" style={{ marginTop: 16 }}>{scr.loading ? 'Loading the company…' : `${sym} is not in the screen's company list.`}</p>
        ) : (
          <>
            <div className="peek-id">
              <span className="monogram" aria-hidden>{row.sym.slice(0, 2)}</span>
              <div style={{ minWidth: 0 }}>
                <h2 className="disp">{row.sym}</h2>
                <p>{row.name}</p>
                <p className="dim">{[row.sector, row.tier ? `${row.tier} cap` : null, fin(row.mcap_cr) ? crore(row.mcap_cr) : null].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="peek-px">
                <div className="num">{fin(pv?.price) ? `₹${num(pv!.price, 2)}` : '—'}</div>
                <Chg v={pv?.pct ?? null} dp={1} />
                <div className="dim">{pv ? priceLabel(pv).text : ''}</div>
              </div>
            </div>

            <h3 className="peek-h">Scores <span>percentile among {num(scr.data?.rows.length ?? 0)} companies; the tick is the median</span></h3>
            <div className="peek-factors">
              {FACTORS.map(([name, , k]) => { const v = row[k]; return (
                <div key={k} className="pbar">
                  <span className="eyebrow">{name}</span>
                  <div className="pbar-track" style={{ position: 'relative', height: 8, borderRadius: 9, background: 'var(--panel-3)' }}>
                    {fin(v) && <div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: '100%', borderRadius: 9, background: 'var(--accent)' }} />}
                    <span aria-hidden style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: 'var(--text)', opacity: 0.45 }} />
                  </div>
                  <span className="num pbar-v">{fin(v) ? `${ordinal(v)} percentile` : <span className="dim">not scored</span>}</span>
                </div>
              ); })}
            </div>

            <h3 className="peek-h">Where the price is <span>within its 52-week range</span></h3>
            <RangeBar row={row} />

            {mine.length > 0 && <p className="peek-sig">{mine.map((s) => <span key={s.id} className="tag acc">Swing {s.setup.toLowerCase()} signal</span>)}</p>}

            {read && (
              <div className="peek-cols">
                <div>
                  <h3 className="peek-h">Points in its favour</h3>
                  {read.bull.length ? <ul>{read.bull.slice(0, 3).map((p) => <li key={p.text}><span className="up" aria-hidden>▲</span> {p.text}</li>)}</ul> : <p className="dim">None of the favourable checks apply.</p>}
                </div>
                <div>
                  <h3 className="peek-h">Points to check</h3>
                  {read.bear.length ? <ul>{read.bear.slice(0, 3).map((p) => <li key={p.text}><span className="down" aria-hidden>▼</span> {p.text}</li>)}</ul> : <p className="dim">None of the cautionary checks apply.</p>}
                </div>
              </div>
            )}
            <p className="dim peek-note">Built from the figures on the screen, with the rule written beside each. Not a recommendation or a forecast.</p>
            <Link className="btn" href={href}>Open the full page <span aria-hidden>→</span></Link>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
