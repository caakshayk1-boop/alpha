'use client';
/** Following: each company you watch, with its price and day move (the site's one price rule, lib/price.ts), what changed
 *  since you last marked it reviewed (lib/review.ts: recorded snapshots only, never a reconstructed history), the results
 *  date on file (the screen's estimate, unconfirmed), and links to its page, its research cards and its journal entries. */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chg, Skel } from '@/components/ui';
import { AskAI } from '@/components/Explain';
import { Overflow } from '@/components/company/Parts';
import { QuickAdd, plural, type DeskTab } from '@/components/desk/common';
import type { ResearchCard } from '@/lib/card';
import { csvProvenance, csvRow } from '@/lib/csv';
import { downloadText } from '@/lib/deskStore';
import { dateLabel, num } from '@/lib/format';
import type { JournalEntry } from '@/lib/journal';
import type { LiveSnap } from '@/lib/live';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { diffSnapshot, saveSnapshot, snapshotOf, type Snapshot } from '@/lib/review';
import { SCREEN_DEFAULT, toQuery } from '@/lib/screenUrl';
import type { SavedScreen } from '@/lib/backup';
import { companyHref } from '@/lib/slug';
import type { PxQuote, Row } from '@/lib/types';

export function Following(p: {
  watch: string[]; onAdd: (s: string) => boolean; onRemove: (s: string) => boolean; storeError: string | null;
  rows: Row[] | null; loading: boolean; error: string | null; bySym: Map<string, Row>; snap: LiveSnap | null; quotes: Record<string, PxQuote>;
  snaps: Record<string, Snapshot>; cards: ResearchCard[]; journal: JournalEntry[]; due: { c: ResearchCard; why: string[] }[]; screens: SavedScreen[];
  go: (t: DeskTab, sym?: string | null) => void; closeOn: string | null;
}) {
  const { watch, bySym } = p;
  const known = watch.map((s) => bySym.get(s)).filter((r): r is Row => !!r);
  const csv = () => {
    const lines = [...csvProvenance('alpha.askakshay.com companies you follow (screen close prices and figures)', sessionLabel(p.closeOn)), csvRow(['symbol', 'name', 'close_date', 'close_price', '1d_pct', '1m_pct', '1y_pct', 'composite', 'next_results_unconfirmed']), ...known.map((r) => csvRow([r.sym, r.name, r.last_date, r.price, r.r1d, r.r1m, r.r1y, r.comp, r.next_earnings]))];
    downloadText('alpha-following.csv', lines.join('\n'), 'text/csv');
  };
  const changed = watch.filter((s) => { const r = bySym.get(s), sn = p.snaps[s]; return r && sn && diffSnapshot(sn, r).length > 0; });

  return (
    <div className="grid-lead desk-follow">
      <section className="card" aria-labelledby="fol-h">
        <div className="card-h">
          <h2 id="fol-h">Following <span className="dim num" style={{ fontWeight: 500 }}>· {num(watch.length)}</span></h2>
          {known.length > 0 && (
            <Overflow label="More for the companies you follow">
              <button type="button" onClick={csv}>Download CSV</button>
              <Link href={`/compare/?s=${known.slice(0, 4).map((r) => r.sym).join(',')}`}>Compare the first {Math.min(4, known.length)}</Link>
            </Overflow>
          )}
        </div>
        <QuickAdd onAdd={p.onAdd} exclude={watch} label="Follow another company…" />
        {p.storeError && <p className="desk-err" role="alert">{p.storeError}</p>}
        {watch.length === 0 ? (
          <div className="state">
            <b>You are not following any company yet.</b>
            <p>Follow one name you already know. Its move, its results date and what changes after you review it will show here.</p>
            <div className="acts"><button type="button" className="act" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Search for a company</button><Link className="act quiet" href="/screen/">Browse the screen</Link></div>
          </div>
        ) : p.error && !p.rows ? (
          <div className="state"><b>The screen did not load, so there are no figures to show.</b><p>Your list is safe in this browser. Reload the page to try again.</p><ul className="desk-plain">{watch.map((s) => <li key={s}><Link className="link" href={companyHref(s)}>{s}</Link></li>)}</ul></div>
        ) : (
          <ul className="rows desk-frows">
            {watch.map((sym) => <li key={sym}><FollowRow sym={sym} r={bySym.get(sym) ?? null} loading={p.loading} snap={p.snap} quote={p.quotes[sym]} review={p.snaps[sym] ?? null}
              cards={p.cards.filter((c) => c.companies.some((x) => x.sym === sym)).length} entries={p.journal.filter((e) => e.sym === sym).length} onRemove={() => p.onRemove(sym)} go={p.go} /></li>)}
          </ul>
        )}
        {watch.length > 0 && <p className="card-foot">Prices follow the site&apos;s one rule: the live price when it is from a newer session than the screen, else the screen close, dated. &ldquo;Since your review&rdquo; compares only the snapshot saved when you pressed Mark reviewed; nothing earlier is reconstructed.</p>}
      </section>

      <div className="desk-aside">
        <section className="card tight" aria-labelledby="due-h">
          <div className="card-h"><h3 id="due-h">Needs a look</h3></div>
          {p.due.length === 0 && changed.length === 0 ? (
            <div className="state"><b>Nothing is due.</b><p>{p.cards.length ? 'No card has reached its review date or its results trigger, and no followed company changed since you reviewed it.' : 'A research card with a review date, or a company you marked reviewed, will show here when it needs another look.'}</p></div>
          ) : (
            <ul className="rows">
              {p.due.slice(0, 5).map(({ c, why }) => <li key={c.id}><button type="button" className="row desk-rowbtn" onClick={() => p.go('cards', c.companies[0]?.sym ?? null)}><span style={{ minWidth: 0 }}><span className="row-t">{c.question ?? 'Untitled research'}</span><span className="row-s">{why.join('; ')}</span></span><span className="pill warn">Review due</span></button></li>)}
              {changed.slice(0, 5).map((s) => <li key={s}><Link className="row" href={companyHref(s)}><span style={{ minWidth: 0 }}><span className="row-t">{s}</span><span className="row-s">{plural(diffSnapshot(p.snaps[s], bySym.get(s)!).length, 'change')} since you reviewed on {dateLabel(p.snaps[s].at.slice(0, 10))}</span></span><span className="pill acc">Changed</span></Link></li>)}
            </ul>
          )}
        </section>
        <section className="card tight" aria-labelledby="scr-h">
          <div className="card-h"><h3 id="scr-h">Saved screens <span className="dim num" style={{ fontWeight: 500 }}>· {num(p.screens.length)}</span></h3><Link className="more" href="/screen/">Screen →</Link></div>
          {p.screens.length === 0 ? (
            <div className="state"><b>No saved screens.</b><p>On the Screen, set your filters and press &ldquo;Save screen&rdquo; to come back to them here.</p><div className="acts"><Link className="act" href="/screen/">Open the screen</Link></div></div>
          ) : (
            <ul className="rows">{p.screens.slice(0, 8).map((v) => <li key={v.name}><Link className="row" href={`/screen/${toQuery({ ...SCREEN_DEFAULT, conds: v.conds ?? [], flags: v.flags ?? [], sector: v.sector ?? '', tier: v.tier ?? '', ask: v.nl?.text ?? '', off: v.nl?.off ?? [] })}`}><span style={{ minWidth: 0 }}><span className="row-t">{v.name}</span><span className="row-s">{[v.nl?.text, v.sector, v.tier && `${v.tier} cap`, v.conds?.length ? plural(v.conds.length, 'filter') : ''].filter(Boolean).join(' · ') || 'all companies'}</span></span></Link></li>)}</ul>
          )}
        </section>
        {watch.length > 0 && (
          <section className="card tight" aria-label="Ask about the companies you follow">
            <AskAI subject="watchlist" syms={watch.slice(0, 12)} title="Brief me on my names" compact />
            <p className="dim desk-small">Asking sends the symbols you follow (up to twelve, never your notes or cards) to Alpha&apos;s server, which builds the figures and asks the model. Nothing is sent until you press the button, and nothing is stored.</p>
          </section>
        )}
      </div>
    </div>
  );
}

function FollowRow({ sym, r, loading, snap, quote, review, cards, entries, onRemove, go }: { sym: string; r: Row | null; loading: boolean; snap: LiveSnap | null; quote?: PxQuote; review: Snapshot | null; cards: number; entries: number; onRemove: () => void; go: (t: DeskTab, sym?: string | null) => void }) {
  const [confirm, setConfirm] = useState(false);
  const pv = r ? priceView(sym, r, snap, quote) : null;
  const pl = pv ? priceLabel(pv) : null;
  const changes = useMemo(() => (r && review ? diffSnapshot(review, r) : []), [r, review]);
  return (
    <div className="frow">
      <div className="frow-top">
        <Link href={companyHref(sym)} className="frow-id">
          <span className="row-t">{sym}</span>
          <span className="row-s">{r?.name ?? (loading ? 'Loading…' : 'Not in the screened universe')}</span>
        </Link>
        <div className="row-r frow-px">
          {pv?.price != null ? <><span className="num">₹{num(pv.price, 2)}</span> <Chg v={pv.pct} dp={1} /><small>{pl?.text}</small></> : loading ? <Skel h={16} w={72} /> : <small>no price on file</small>}
        </div>
      </div>
      <div className="frow-since">
        {!r ? <span className="dim">{loading ? 'Reading the screen…' : 'No figures to compare: this symbol is not in the screen.'}</span>
          : review ? (
            changes.length ? (
              <>
                <span className="frow-k">Since your review on {dateLabel(review.at.slice(0, 10))}</span>
                <ul className="frow-ch">{changes.map((c) => <li key={c.field}><span className="dim">{c.field}</span> {c.from} → <b>{c.to}</b></li>)}</ul>
              </>
            ) : <span><span className="frow-k">Since your review on {dateLabel(review.at.slice(0, 10))}</span> no change in its figures.</span>
          ) : <span><span className="frow-k">No review baseline yet.</span> Mark it reviewed to see what changes from here.</span>}
      </div>
      <div className="frow-meta">
        {r?.next_earnings ? <span className="pill warn nodot" title="The screen's estimate, not an exchange confirmation">Results on file {dateLabel(r.next_earnings)} · unconfirmed</span> : r ? <span className="dim">No results date on file</span> : null}
        <span className="frow-links">
          {r && <button type="button" className="act quiet frow-btn" onClick={() => saveSnapshot(sym, snapshotOf(r, new Date().toISOString()))} aria-label={`Mark ${sym} reviewed now`}>{review ? 'Mark reviewed again' : 'Mark reviewed'}</button>}
          <button type="button" className="act quiet frow-btn" onClick={() => go('cards', sym)}>{plural(cards, 'card')}</button>
          <button type="button" className="act quiet frow-btn" onClick={() => go('journal', sym)}>{plural(entries, 'journal entry', 'journal entries')}</button>
          {confirm ? (
            <span className="frow-confirm" role="group" aria-label={`Stop following ${sym}?`}>
              <button type="button" className="act frow-btn" onClick={() => { onRemove(); setConfirm(false); }}>Unfollow {sym}</button>
              <button type="button" className="act quiet frow-btn" onClick={() => setConfirm(false)}>Keep</button>
            </span>
          ) : <button type="button" className="act quiet frow-btn" onClick={() => setConfirm(true)} aria-label={`Stop following ${sym}`}>Unfollow</button>}
        </span>
      </div>
    </div>
  );
}
