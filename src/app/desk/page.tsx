'use client';
/** My Desk (Pro §17, §18, §25.2): what you track, what needs review, and what you concluded, in one place. It reads the
 *  same browser-local stores as Watchlist, Journal and the research cards; it owns no data of its own.
 *  "Needs review" comes only from the reader's own triggers (a review date, "when the next results are out") and from
 *  observed changes in saved figures: no invented urgency. Sync is not claimed: there is no account, so it says so. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Chg, PageHead } from '@/components/ui';
import { TickerLink } from '@/components/TickerLink';
import { reviewDue, type CurrentCompany } from '@/lib/card';
import { useFeed, useLive, useSignals } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { parseJournal, type JournalEntry } from '@/lib/journal';
import { useCards } from '@/lib/library';
import { priceView } from '@/lib/price';
import { SCREEN_DEFAULT, toQuery } from '@/lib/screenUrl';
import { useStoredList } from '@/lib/store';

interface SavedScreen { name: string; conds: { f: string; op: '>=' | '<='; v: string }[]; flags: string[]; sector: string; tier: string; nl?: { text: string; off: string[] } }

export default function Desk() {
  const s = useFeed('screen');
  const eng = useSignals();
  const lv = useLive();
  const [watch] = useStoredList('alpha-watchlist');
  const { cards, ok } = useCards();
  const [saved, setSaved] = useState<SavedScreen[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [lastExport, setLastExport] = useState<string | null>(null);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem('alpha-screen-saved') ?? '[]'); if (Array.isArray(v)) setSaved(v); } catch { /* none */ }
    try { setJournal(parseJournal(localStorage.getItem('alpha-journal'))); } catch { /* none */ }
    try { setLastExport(localStorage.getItem('alpha-last-export')); } catch { /* none */ }
  }, []);
  const current = useMemo(() => {
    const m: Record<string, CurrentCompany> = {};
    for (const r of s.data?.rows ?? []) m[r.sym] = { price: typeof r.price === 'number' ? r.price : null, asOf: r.last_date ?? null, nextResults: r.next_earnings ?? null, engines: (eng.data?.signals ?? []).filter((x) => x.sym === r.sym && (x.status === 'open' || x.status === 'pending')).map((x) => ({ engine: `Swing ${x.setup}`, rankingStatus: null, tradingStatus: null })) };
    return m;
  }, [s.data, eng.data]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const due = useMemo(() => cards.map((c) => ({ c, why: reviewDue(c, today, current) })).filter((x) => x.why.length), [cards, current, today]);
  const rows = useMemo(() => watch.map((sym) => s.data?.rows.find((r) => r.sym === sym)).filter((r): r is NonNullable<typeof r> => !!r), [watch, s.data]);
  const empty = !watch.length && !cards.length && !saved.length && !journal.length;
  return (
    <>
      <PageHead eyebrow="My Desk" title="What you track," em="and what needs a look." />
      <section className="wrap" style={{ paddingTop: 0 }}>
        <p className="desk-store dim" role="status">
          <span className="tag">Saved in this browser only</span> Nothing here is uploaded and there is no account, so it is not synced to another device.
          {lastExport ? <> Last exported {dateLabel(lastExport.slice(0, 10))}.</> : <> Not exported yet: <Link href="/watchlist/#cards">export a copy</Link> to keep it safe.</>}
          {!ok && <> <b className="warn">This browser is blocking storage, so changes are not being kept.</b></>}
        </p>
      </section>
      {empty ? (
        <section className="wrap">
          <div className="panel spot">
            <div className="eyebrow">Your desk is empty</div>
            <p className="disp" style={{ fontSize: 28, margin: '8px 0' }}>Add three companies you already follow to see what changes.</p>
            <div className="filters"><Link className="btn" href="/watchlist/">Add companies</Link><Link className="chip" href="/screen/">Find some on the screen</Link></div>
          </div>
        </section>
      ) : (
        <section className="wrap desk">
          <div className="panel spot desk-review">
            <div className="eyebrow">Needs review · {due.length ? `${due.length} card${due.length > 1 ? 's' : ''}` : 'nothing due'}</div>
            {due.length ? (
              <ul className="xw-list">{due.map(({ c, why }) => <li key={c.id}><Link href="/watchlist/#cards"><b>{c.question ?? c.companies.map((x) => x.sym).slice(0, 3).join(', ')}</b></Link><span className="dim"> · {why.join('; ')}</span></li>)}</ul>
            ) : <p className="muted" style={{ margin: '6px 0 0' }}>No card has reached its review date, its results trigger, or a change in its saved figures. {cards.length ? 'Set a review date on a card under “What would change my mind”.' : 'Save a research card from a company page to track a question.'}</p>}
          </div>
          <div className="grid g2">
            <div className="panel">
              <div className="eyebrow">Watchlist · {num(watch.length)}</div>
              {rows.length ? (
                <ul className="desk-list">{rows.slice(0, 8).map((r) => { const pv = priceView(r.sym, r, lv.snap); return <li key={r.sym}><TickerLink sym={r.sym}><b data-ticker>{r.sym}</b></TickerLink><span className="dim">{r.name}</span><span className="num">{pv.price !== null ? `₹${num(pv.price, 2)}` : '—'}</span><Chg v={pv.pct} /></li>; })}</ul>
              ) : <p className="muted" style={{ margin: '6px 0 0' }}>No companies yet. <Link href="/watchlist/">Add three you already follow</Link>.</p>}
              {rows.length > 8 && <Link className="more" href="/watchlist/">All {rows.length} →</Link>}
            </div>
            <div className="panel">
              <div className="eyebrow">Saved screens · {num(saved.length)}</div>
              {saved.length ? <ul className="desk-list">{saved.slice(0, 8).map((v) => <li key={v.name}><Link href={`/screen/${toQuery({ ...SCREEN_DEFAULT, conds: v.conds ?? [], flags: v.flags ?? [], sector: v.sector ?? '', tier: v.tier ?? '', ask: v.nl?.text ?? '', off: v.nl?.off ?? [] })}`}><b>{v.name}</b></Link><span className="dim">{[v.nl?.text, v.sector, v.tier && `${v.tier} cap`, v.conds?.length ? `${v.conds.length} filter${v.conds.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'all companies'}</span></li>)}</ul>
                : <p className="muted" style={{ margin: '6px 0 0' }}>None yet. On the <Link href="/screen/">screen</Link>, set filters and press &ldquo;Save screen&rdquo;.</p>}
            </div>
            <div className="panel">
              <div className="eyebrow">Research cards · {num(cards.length)}</div>
              {cards.length ? <ul className="desk-list">{cards.slice(0, 6).map((c) => <li key={c.id}><Link href="/watchlist/#cards"><b>{c.question ?? 'Untitled research'}</b></Link><span className="dim">{c.companies.map((x) => x.sym).slice(0, 4).join(', ')} · {c.createdAt.slice(0, 10)}{c.decision?.thesis ? ' · thesis written' : ''}</span></li>)}</ul>
                : <p className="muted" style={{ margin: '6px 0 0' }}>None yet. &ldquo;Save research card&rdquo; on a company page keeps the question, the evidence for and against, and the data dates.</p>}
            </div>
            <div className="panel">
              <div className="eyebrow">Journal · {num(journal.length)} {journal.length === 1 ? 'decision' : 'decisions'}</div>
              {journal.length ? <ul className="desk-list">{[...journal].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map((e) => <li key={e.id}><TickerLink sym={e.sym}><b data-ticker>{e.sym}</b></TickerLink><span className="dim">{e.action === 'took' ? 'Took it' : e.action === 'skipped' ? 'Skipped' : 'Watching'} · {dateLabel(e.date)}</span><span className="dim desk-why">{e.why}</span></li>)}</ul>
                : <p className="muted" style={{ margin: '6px 0 0' }}>No decisions recorded. The <Link href="/journal/">journal</Link> keeps why you decided, and where the price went after.</p>}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
