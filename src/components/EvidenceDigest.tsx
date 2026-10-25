'use client';
/** The evidence digest for the companies you follow: what the site's own feeds recorded lately, each item with its source and
 *  time (lib/evidence.ts has the rules). It sits on My Desk as a tab and, shortened, on Today. The feeds refresh each evening;
 *  the digest is assembled in this browser from them, so it needs no account and nothing about your list leaves the device.
 *  "Nothing on the record" is shown as its own state per company, and says what the digest cannot see. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Skel } from '@/components/ui';
import { useFeed, useSignals } from '@/lib/data';
import type { NewsItem } from '@/lib/types';
import { dateLabel } from '@/lib/format';
import { KIND_LABEL, NEWS_HOURS, MOVE_PCT, RESULTS_DAYS, VOLUME_X, evidenceFor, newestFirst, type Evidence } from '@/lib/evidence';
import { plainText } from '@/lib/format';
import { makeMatcher } from '@/lib/newsdesk';
import { readSnapshots, type Snapshot } from '@/lib/review';
import { companyHref } from '@/lib/slug';
import { useStoredList } from '@/lib/store';

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const stamp = (at: string | null) => {
  if (!at) return 'time not stated';
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return dateLabel(at);
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? 'time not stated' : `${d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })} IST`;
};

export interface EvidenceState { watch: string[]; byName: { sym: string; name: string; items: Evidence[] }[]; total: number; ready: boolean; error: boolean; asOf: string | null; newsOk: boolean }

export function useEvidence(): EvidenceState {
  const [watch] = useStoredList('alpha-watchlist');
  const scr = useFeed('screen');
  const news = useFeed('news');
  const eng = useSignals();
  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  useEffect(() => { const read = () => setSnaps(readSnapshots()); read(); window.addEventListener('alpha-reviewed', read); return () => window.removeEventListener('alpha-reviewed', read); }, []);
  const rows = scr.data?.rows;
  const state = useMemo<EvidenceState>(() => {
    const bySym = new Map((rows ?? []).map((r) => [r.sym, r]));
    const followed = watch.map((s) => bySym.get(s)).filter((r): r is NonNullable<typeof r> => !!r);
    // The matcher sees the whole universe, then keeps your names: matching against your list alone would let "Reliance Power" read as
    // "Reliance" because the longer name was never offered to it (the A01 fault).
    const match = makeMatcher((rows ?? []).map((r) => ({ sym: r.sym, name: r.name, mcap: r.mcap_cr })));
    const mine = new Set(followed.map((r) => r.sym));
    const storiesBy = new Map<string, { story: NewsItem; basis: string }[]>();
    for (const story of news.data ?? []) for (const m of match(`${plainText(story.title)}. ${plainText(story.summary)}`).filter((x) => mine.has(x.sym))) storiesBy.set(m.sym, [...(storiesBy.get(m.sym) ?? []), { story, basis: m.basis }]);
    const now = Date.now(), today = istToday();
    const byName = followed.map((r) => ({ sym: r.sym, name: r.name, items: evidenceFor({ sym: r.sym, row: r, snap: snaps[r.sym] ?? null, signals: eng.data?.signals ?? [], stories: storiesBy.get(r.sym) ?? [], todayIso: today, nowMs: now }) }));
    return { watch, byName, total: byName.reduce((n, x) => n + x.items.length, 0), ready: !!rows, error: !rows && !!scr.error, asOf: rows?.[0]?.last_date ?? null, newsOk: !!news.data };
  }, [watch, rows, news.data, eng.data, snaps, scr.error]);
  return state;
}

function Item({ e, sym }: { e: Evidence; sym?: boolean }) {
  return (
    <li className="ev-i">
      <span className="pill nodot ev-k">{KIND_LABEL[e.kind]}</span>
      <span className="ev-b">
        <span className="ev-t">{sym && <Link className="link" href={companyHref(e.sym)}><b>{e.sym}</b></Link>}{sym && ' '}{e.href ? <a className="link" href={e.href} target={e.href.startsWith('/') ? undefined : '_blank'} rel={e.href.startsWith('/') ? undefined : 'noopener noreferrer'}>{e.text}</a> : e.text}</span>
        <span className="ev-s">{e.source} · {stamp(e.at)}{e.basis ? ` · matched on ${e.basis}` : ''}</span>
      </span>
    </li>
  );
}

const RULES = `News from the last ${NEWS_HOURS} hours that names the company by ticker or full name; the estimated results date when within ${RESULTS_DAYS} days; a one-day move of ${MOVE_PCT}% or more; volume at ${VOLUME_X}x its recent average; a close at a 52-week high; figures that changed since you last marked the company reviewed; a pending or open Swing v2 paper setup.`;

export function EvidenceDigest({ compact = false, state }: { compact?: boolean; state?: EvidenceState }) {
  const own = useEvidence();
  const ev = state ?? own;
  const all = ev.byName.flatMap((x) => x.items);
  if (!ev.watch.length) return (
    <div className="state"><b>Follow a company to get its evidence digest.</b><p>For each name you follow, this gathers the news, results date, big moves and changes since your last review, each with its source and time. Kept in this browser only.</p>
      <div className="acts"><button type="button" className="act primary" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button></div></div>
  );
  if (ev.error) return <div className="state"><b>The screen did not load, so no digest can be built.</b><p>Your list is safe in this browser. Reload the page to try again.</p></div>;
  if (!ev.ready) return <Skel h={compact ? 140 : 220} />;
  if (compact) {
    const top = newestFirst(all, 5);
    return (
      <>
        {top.length === 0
          ? <p className="dim" style={{ margin: 0 }}>Nothing on the record for {ev.byName.length === 1 ? 'your name' : `your ${ev.byName.length} names`} from these sources. That is not an all-clear: filings and announcements are not in this digest.</p>
          : <ul className="ev-list">{top.map((e, i) => <Item key={`${e.sym}${e.kind}${i}`} e={e} sym />)}</ul>}
        <p className="card-foot"><Link className="link" href="/desk/#digest">The full digest</Link>{ev.newsOk ? '' : ' · The news feed did not load, so stories are missing.'}</p>
      </>
    );
  }
  return (
    <>
      <p className="dim" style={{ margin: '0 0 12px' }}>{all.length === 0 ? 'Nothing new on the record for the companies you follow.' : `${all.length} item${all.length === 1 ? '' : 's'} on ${ev.byName.filter((x) => x.items.length).length} of ${ev.byName.length} companies.`} Built in this browser from the site&apos;s feeds{ev.asOf ? `, screen close ${dateLabel(ev.asOf)}` : ''}.{!ev.newsOk && ' The news feed did not load, so stories are missing.'}</p>
      <div className="ev-names">
        {ev.byName.map((n) => (
          <section key={n.sym} className="ev-n" aria-label={n.name}>
            <h3><Link className="link" href={companyHref(n.sym)}>{n.sym}</Link> <span className="dim">{n.name}</span></h3>
            {n.items.length ? <ul className="ev-list">{n.items.map((e, i) => <Item key={`${e.kind}${i}`} e={e} />)}</ul>
              : <p className="dim ev-none">Nothing on the record from these sources. That is not an all-clear: filings, exchange announcements and anything outside these feeds are not in this digest.</p>}
          </section>
        ))}
      </div>
      <p className="card-foot"><b>What counts as evidence.</b> {RULES} A move or a volume spike is a record that it happened, not a reason it did. Nothing here predicts or recommends.</p>
    </>
  );
}
