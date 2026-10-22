'use client';
/** Research: the hub for the "what supports or weakens the case" pages (Pro §17). It holds no data logic of its own: each
 *  block is a live summary of an existing page, read from the same feeds, with one way in. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import SymbolPicker from '@/components/SymbolPicker';
import { PageHead } from '@/components/ui';
import { useFeed, useSignals } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { pageOf } from '@/lib/routes';
import { companyHref } from '@/lib/slug';

interface Recent { kind: string; label: string; sub: string; href?: string }

function Tile({ href, children, extra }: { href: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const p = pageOf(href);
  return (
    <Link href={href} className="hub-tile panel spot">
      <div className="eyebrow">{p?.label}</div>
      <div className="hub-tile-body">{children}</div>
      {extra}
      <span className="more" aria-hidden>Open →</span>
    </Link>
  );
}

export default function Research() {
  const router = useRouter();
  const reads = useFeed('weekly_reads');
  const sig = useSignals();
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem('alpha-recent') ?? '[]'); if (Array.isArray(r)) setRecent(r.filter((x: Recent) => x.kind === 'company' && x.href).slice(0, 6)); } catch { /* none */ } }, []);
  const ed = reads.data?.editions?.[0];
  const underReview = useMemo(() => (reads.data?.editions ?? []).flatMap((e) => e.studies).filter((s) => s.review?.status === 'under_review').length, [reads.data]);
  const open = (sig.data?.signals ?? []).filter((s) => s.status === 'open').length;
  const pending = (sig.data?.signals ?? []).filter((s) => s.status === 'pending').length;
  const g = sig.data?.gate;
  return (
    <>
      <PageHead eyebrow="Research" title="What supports the case," em="and what weakens it." />
      <section className="wrap">
        <div className="panel spot hub-lookup">
          <div className="eyebrow">Look up a company</div>
          <p className="muted" style={{ margin: '6px 0 10px', fontSize: 14.5 }}>Every company page starts with its case and its countercase, then the chart, the financials and the sources.</p>
          <SymbolPicker placeholder="Name or ticker, e.g. TCS" onPick={(s) => navigate(router, companyHref(s))} />
          {recent.length > 0 && <div className="filters" style={{ marginTop: 10 }}><span className="eyebrow">Recent</span>{recent.map((r) => <Link key={r.href} href={r.href!} className="chip">{r.label}</Link>)}</div>}
          <p className="dim" style={{ fontSize: 13, margin: '10px 0 0' }}>Tip: press <kbd className="kbd">/</kbd> anywhere to search.</p>
        </div>
        <div className="grid g3 hub-grid">
          <Tile href="/compare/"><p>Two to four companies on the same measures, with a metric marked only when the difference is material, and &ldquo;not comparable&rdquo; where a measure does not apply to a sector.</p></Tile>
          <Tile href="/reads/" extra={underReview > 0 ? <p className="dim" style={{ fontSize: 13, margin: '6px 0 0' }}><span className="tag warn">{underReview} under review</span> across all {reads.data?.editions.length ?? 0} editions, not this week&apos;s count; see the corrections log</p> : null}>
            <p>{ed ? <>Latest edition: week of {dateLabel(ed.week)}, {ed.studies.length} {ed.studies.length === 1 ? 'study' : 'studies'}. Machine-written from the figures, each with its review status.</> : reads.error ? 'The weekly studies did not load.' : 'Loading the latest edition…'}</p>
          </Tile>
          <Tile href="/engines/" extra={<p className="dim" style={{ fontSize: 13, margin: '6px 0 0' }}><span className="tag exp">Experimental research</span></p>}>
            <p>{sig.data ? <>{sig.data.alertable ? 'Alerts are on.' : 'Alerts are off: the current engine has not passed its holdout test.'} Market gate {g?.on ? 'on' : 'off'} ({g?.passed ?? '—'} of 4 checks).</> : sig.error ? 'The signal book did not load.' : 'Loading…'}</p>
          </Tile>
          <Tile href="/trades/"><p>{sig.data ? (open + pending === 0 ? 'No paper trades are open or pending.' : `${num(open)} open, ${num(pending)} pending, marked to the latest price. Paper only, never a broker fill.`) : 'Loading…'}</p></Tile>
          <Tile href="/tools/"><p>Position size from a risk budget, a plan&rsquo;s arithmetic with gaps and costs, valuation scenarios and a holdings X-ray. Arithmetic on your assumptions, not forecasts.</p></Tile>
        </div>
      </section>
    </>
  );
}
