'use client';
/** Research: find a company first, then a short set of ways into the pages that read evidence (Pro §17). It holds no data
 *  logic of its own: each entry is a live one-line status of an existing page, read from the same feeds. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { here } from '@/lib/edition';
import SymbolPicker from '@/components/SymbolPicker';
import { PageHead } from '@/components/ui';
import { useFeed, useSignals } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { companyHref } from '@/lib/slug';
import { useStoredList } from '@/lib/store';

interface Recent { kind: string; label: string; sub: string; href?: string }

export default function Research() {
  const router = useRouter();
  const reads = useFeed('weekly_reads');
  const sig = useSignals();
  const [watch] = useStoredList('alpha-watchlist');
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem('alpha-recent') ?? '[]'); if (Array.isArray(r)) setRecent(r.filter((x: Recent) => x.kind === 'company' && x.href).slice(0, 6)); } catch { /* none */ } }, []);
  const ed = reads.data?.editions?.[0];
  const underReview = useMemo(() => (reads.data?.editions ?? []).flatMap((e) => e.studies).filter((s) => s.review?.status === 'under_review').length, [reads.data]);
  const open = (sig.data?.signals ?? []).filter((s) => s.status === 'open').length;
  const pending = (sig.data?.signals ?? []).filter((s) => s.status === 'pending').length;
  const g = sig.data?.gate;
  const entries: { href: string; t: string; s: string; cta: string; tag?: string }[] = [
    { href: '/screen/', t: 'Screen', cta: 'Find companies', s: 'Every company on four separate scores, with the data each one rests on.' },
    { href: '/compare/', t: 'Compare', cta: 'Compare companies', s: 'Two to four companies on the same measures; “not comparable” where a measure does not apply.' },
    { href: '/reads/', t: 'Weekly case studies', cta: 'Read studies', s: ed ? `Week of ${dateLabel(ed.week)}: ${ed.studies.length} quantitative case ${ed.studies.length === 1 ? 'study' : 'studies'}, machine-written from the figures.` : reads.error ? 'The weekly studies did not load.' : 'Loading the latest edition…', tag: underReview > 0 ? `${underReview} under review, all editions` : undefined },
    { href: '/engines/', t: 'Signals and method', cta: 'Inspect signal rules', s: sig.data ? `${sig.data.alertable ? 'Alerts on.' : 'Research only: the engine has not passed its holdout test.'} Market gate ${g?.on ? 'on' : 'off'} (${g?.passed ?? '—'} of 4 checks).` : sig.error ? 'The signal book did not load.' : 'Loading…', tag: 'Experimental' },
    { href: '/trades/', t: 'Paper trades', cta: 'Open paper book', s: sig.data ? (open + pending === 0 ? 'No paper trade is open or pending.' : `${num(open)} open, ${num(pending)} pending, marked to the latest price. Paper only.`) : 'Loading…' },
    { href: '/tools/', t: 'Tools', cta: 'Open calculators', s: 'Position size, a plan’s arithmetic, a reverse DCF and a holdings X-ray. Arithmetic on your assumptions.' },
  ];
  return (
    <div className="sp">
      <PageHead eyebrow="Research" title="Research a company," em="case and countercase." />
      <section className="wrap">
        <section className="card rs-find" aria-labelledby="rs-find">
          <h2 id="rs-find" className="rs-h">Look up a company</h2>
          <p className="sp-note">Each company page opens with its case and countercase, then the chart, financials and sources.</p>
          <div className="rs-pick"><SymbolPicker placeholder="Name or ticker, e.g. TCS" onPick={(s) => navigate(router, companyHref(s))} /></div>
          {(recent.length > 0 || watch.length > 0) && (
            <div className="rs-quick">
              {recent.length > 0 && <div><span className="lbl">Recent</span><span className="sp-chips">{recent.map((r) => <Link key={r.href} href={r.href!} className="sp-chip">{r.label}</Link>)}</span></div>}
              {watch.length > 0 && <div><span className="lbl">Following</span><span className="sp-chips">{watch.slice(0, 8).map((s) => <Link key={s} href={companyHref(s)} className="sp-chip">{s}</Link>)}</span></div>}
            </div>
          )}
          <p className="sp-note">Press <kbd className="kbd">/</kbd> anywhere to search.</p>
        </section>
        <section className="sp-sec" aria-labelledby="rs-in">
          <h2 id="rs-in" className="sec-title rs-sub">Ways in</h2>
          <ul className="rows card rs-list">
            {entries.filter((e) => here(e.href)).map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="row rs-row"><span className="rs-id"><span className="row-t">{e.t}{e.tag && <span className="pill warn nodot rs-tag">{e.tag}</span>}</span><span className="row-s">{e.s}</span></span><span className="row-r link">{e.cta} →</span></Link>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </div>
  );
}
