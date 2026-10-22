'use client';
/** My Desk (brief Part I §4, Pro §17, §18, §25.2): one continuous personal workspace. Four views of the same browser-local
 *  records, as tabs (#following, #cards, #journal, #conditions): the companies you follow, the research cards you saved,
 *  your decision journal and your data conditions. A company links across all four without a second copy of anything:
 *  every tab reads the same keys the company page, Today and the Screen write (lib/deskStore.ts names them).
 *
 *  /watchlist/ and /journal/ render this same component on their own tab, so bookmarks and pre-filled journal links keep
 *  working. Nothing is synced (lib/account.ts); "needs review" comes only from the reader's own triggers and from recorded
 *  snapshots, never from invented history. */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { PageHead } from '@/components/ui';
import dynamic from 'next/dynamic';
import { Following } from '@/components/desk/Following';
import { BackupBar } from '@/components/desk/BackupBar';
// the tabs other than the one a page opens on load when first opened
const wait = () => <div className="skel" style={{ height: 320 }} aria-hidden />;
const CardPanel = dynamic(() => import('@/components/CardPanel'), { loading: wait });
const JournalTab = dynamic(() => import('@/components/desk/JournalTab').then((m) => m.JournalTab), { loading: wait });
const ConditionsTab = dynamic(() => import('@/components/desk/ConditionsTab').then((m) => m.ConditionsTab), { loading: wait });
import { QuickAdd, istToday, type DeskTab } from '@/components/desk/common';
import { reviewDue, type CurrentCompany } from '@/lib/card';
import { useFeed, useLive, usePx, useSignals } from '@/lib/data';
import { parseJournal } from '@/lib/journal';
import { useCards } from '@/lib/library';
import { parseScreens } from '@/lib/deskStore';
import { readSnapshots, REVIEW_KEY, type Snapshot } from '@/lib/review';
import { companyHref } from '@/lib/slug';
import { useStoredJson, useStoredList } from '@/lib/store';
import type { Row } from '@/lib/types';

const TABS: { id: DeskTab; label: string }[] = [
  { id: 'following', label: 'Following' },
  { id: 'cards', label: 'Research cards' },
  { id: 'journal', label: 'Journal' },
  { id: 'conditions', label: 'Conditions' },
];
const ALIAS: Record<string, DeskTab> = { following: 'following', watchlist: 'following', cards: 'cards', research: 'cards', journal: 'journal', conditions: 'conditions', alerts: 'conditions' };
const tabFromHash = (h: string): DeskTab | null => ALIAS[h.replace(/^#/, '').toLowerCase()] ?? null;

export default function Desk({ start = 'following' }: { start?: DeskTab }) {
  const [tab, setTab] = useState<DeskTab>(start);
  const [focus, setFocus] = useState<string | null>(null);      // one company, followed across the tabs
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => { const t = tabFromHash(window.location.hash); if (t) setTab(t); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {      // on a phone the tab row scrolls sideways: keep the selected tab in view
    const box = tabsRef.current, el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !el) return;
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.left < b.left || r.right > b.right) box.scrollLeft += r.left - b.left - 8;
  }, [tab]);
  const go = useCallback((t: DeskTab, sym?: string | null) => {
    setTab(t);
    if (sym !== undefined) setFocus(sym);
    try { window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${t}`); } catch { /* the tab still changes */ }
    const top = tabsRef.current?.closest('nav');
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
  }, []);

  // The shared records: one read each, handed to every tab.
  const s = useFeed('screen');
  const eng = useSignals();
  const lv = useLive();
  const [watch, addWatch, removeWatch, , watchErr] = useStoredList('alpha-watchlist');
  const px = usePx(watch);
  const lib = useCards();
  const [journal, setJournal, journalErr, journalReady] = useStoredJson('alpha-journal', parseJournal);
  const [conditions, addCond, removeCond, , condErr] = useStoredList('alpha-conditions');
  const [screens] = useStoredJson('alpha-screen-saved', parseScreens);
  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  useEffect(() => {
    const read = () => setSnaps(readSnapshots());
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === REVIEW_KEY || e.key === null) read(); };
    window.addEventListener(REVIEW_KEY, read);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(REVIEW_KEY, read); window.removeEventListener('storage', onStorage); };
  }, []);

  const rows = s.data?.rows;
  const bySym = useMemo(() => new Map<string, Row>((rows ?? []).map((r) => [r.sym, r])), [rows]);
  const current = useMemo(() => {
    const m: Record<string, CurrentCompany> = {};
    for (const r of rows ?? []) m[r.sym] = { price: typeof r.price === 'number' ? r.price : null, asOf: r.last_date ?? null, nextResults: r.next_earnings ?? null, engines: (eng.data?.signals ?? []).filter((x) => x.sym === r.sym && (x.status === 'open' || x.status === 'pending')).map((x) => ({ engine: `Swing ${x.setup}`, rankingStatus: null, tradingStatus: null })) };
    return m;
  }, [rows, eng.data]);
  const today = istToday();
  const due = useMemo(() => lib.cards.map((c) => ({ c, why: reviewDue(c, today, current) })).filter((x) => x.why.length), [lib.cards, current, today]);

  const counts: Record<DeskTab, number> = { following: watch.length, cards: lib.cards.length, journal: journal.length, conditions: conditions.length };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const t = TABS[(n + TABS.length) % TABS.length].id;
    go(t);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#desk-tab-${t}`)?.focus();
  };

  return (
    <div className="desk2">
      <PageHead eyebrow="My Desk" title="What you follow," em="and what needs a look." />
      <BackupBar storageOk={lib.ok} />
      <FirstUse watch={watch} cards={lib.cards.length} onAdd={addWatch} />

      <nav className="secnav desk-tabs" aria-label="My Desk views">
        <div className="wrap" role="tablist" aria-label="My Desk" ref={tabsRef} onKeyDown={onKey}>
          {TABS.map((t) => (
            <button key={t.id} id={`desk-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls="desk-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => go(t.id)}>
              {t.label}<span className="desk-tab-n num" aria-label={`, ${counts[t.id]} saved`}>{counts[t.id]}</span>
              {t.id === 'cards' && due.length > 0 && <span className="desk-tab-due" aria-label={`, ${due.length} due for review`}>{due.length} due</span>}
            </button>
          ))}
        </div>
      </nav>

      <section className="wrap desk-panel" id="desk-panel" role="tabpanel" aria-labelledby={`desk-tab-${tab}`} tabIndex={-1}>
        {focus && tab !== 'following' && tab !== 'conditions' && (
          <div className="desk-focus" role="status">
            <span>Showing <b>{focus}</b> only.</span>
            <Link className="link" href={companyHref(focus)}>Company page</Link>
            <button type="button" className="act quiet" onClick={() => setFocus(null)}>Show all</button>
          </div>
        )}
        {tab === 'following' && (
          <Following watch={watch} onAdd={addWatch} onRemove={removeWatch} storeError={watchErr} rows={rows ?? null} loading={s.loading} error={s.error} bySym={bySym} snap={lv.snap} quotes={px.quotes}
            snaps={snaps} cards={lib.cards} journal={journal} due={due} screens={screens} go={go} closeOn={s.data?.breadth.as_of ?? null} />
        )}
        {tab === 'cards' && <CardPanel cards={lib.cards} ok={lib.ok} current={current} today={today} focus={focus} journal={journal} watch={watch} onUpdate={lib.update} onRemove={lib.remove} go={go} />}
        {tab === 'journal' && <JournalTab list={journal} setList={setJournal} ready={journalReady} storeError={journalErr} rows={rows ?? null} loading={s.loading} error={s.error} snap={lv.snap} focus={focus} cards={lib.cards} go={go} />}
        {tab === 'conditions' && <ConditionsTab list={conditions} add={addCond} remove={removeCond} storeError={condErr} rows={rows ?? []} watch={watch} asOf={rows?.[0]?.last_date ?? null} loading={s.loading} />}
      </section>
    </div>
  );
}

/** First use: find a company, watch it, save one research question. One company is enough; nothing is gated on a count. */
function FirstUse({ watch, cards, onAdd }: { watch: string[]; cards: number; onAdd: (s: string) => boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || (watch.length > 0 && cards > 0)) return null;
  const first = watch[0] ?? null;
  const steps: { t: string; d: string; done: boolean }[] = [
    { t: 'Find a company', d: 'Search by name or symbol, or browse the screen.', done: watch.length > 0 },
    { t: 'Watch it', d: 'Press Watch on its page, or add it here. One is enough to start.', done: watch.length > 0 },
    { t: 'Save one research question', d: first ? `On ${first}'s page, write the question you are asking under “Your research question”.` : 'On the company page, write the question you are asking. It is saved with the evidence and the data dates.', done: cards > 0 },
  ];
  return (
    <section className="wrap desk-start" aria-labelledby="start-h">
      <div className="card">
        <div className="card-h"><h2 id="start-h">{watch.length ? 'One step left' : 'Start with one company'}</h2><span className="pill nodot num">{steps.filter((x) => x.done).length} of 3 done</span></div>
        <ol className="desk-steps">
          {steps.map((x, i) => (
            <li key={x.t} className={x.done ? 'done' : ''}>
              <span className="desk-step-n" aria-hidden>{x.done ? '✓' : i + 1}</span>
              <span><b>{x.t}</b>{x.done && <span className="sr"> (done)</span>}<span className="dim">{x.d}</span></span>
            </li>
          ))}
        </ol>
        <div className="desk-start-acts">
          {!watch.length ? (
            <>
              <button type="button" className="act primary" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button>
              <QuickAdd onAdd={onAdd} />
              <Link className="act quiet" href="/screen/">Browse the screen</Link>
            </>
          ) : first && <Link className="act primary" href={`${companyHref(first)}#notes`}>Write a question about {first}</Link>}
        </div>
      </div>
    </section>
  );
}
