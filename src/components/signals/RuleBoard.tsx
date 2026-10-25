'use client';
/** The rule board: ten plain rules run on every liquid stock at the last close, each a tile with how many stocks meet it, the first few
 *  names and, on tap, the full list with the figure that put each stock there (lib/rules.ts). A rule that fires on a quarter of the
 *  market or more says it describes the market. Observations at one close, not recommendations; Swing v2's paper setups are separate. */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/company/Parts';
import { Chg, Skel } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { THEMES, WIDE_SHARE, printValue, runRules, type RuleResult, type Theme } from '@/lib/rules';
import { companyHref } from '@/lib/slug';
import { useStoredList } from '@/lib/store';
import { useFirstPlay } from '@/lib/useFirstPlay';

const LIST_CAP = 40;

export function useRuleBoard() {
  const s = useFeed('screen');
  const out = useMemo(() => (s.data ? runRules(s.data.rows) : null), [s.data]);
  return { out, error: s.error, loading: s.loading, asOf: s.data?.rows[0]?.last_date ?? null };
}

export function RuleBoard() {
  const { out, error, asOf } = useRuleBoard();
  const [theme, setTheme] = useState<Theme | 'All'>('All');
  const [open, setOpen] = useState<RuleResult | null>(null);
  const play = useFirstPlay('alpha-played-rules');
  if (error && !out) return <div className="state"><b>The screen did not load, so no rule can be run.</b><p>Nothing is estimated in its place. Reload to try again.</p></div>;
  if (!out) return <div className="rb-grid" aria-busy="true">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="rb-tile"><Skel h={110} /></div>)}</div>;
  const shown = out.results.filter((r) => theme === 'All' || r.rule.theme === theme);
  const wide = out.results.filter((r) => r.wide).length;
  return (
    <section aria-labelledby="rb-h" className="rb" data-play={play ? '' : undefined}>
      <div className="rb-head">
        <div>
          <h2 id="rb-h" className="sec-title">Signals by rule</h2>
          <p className="sec-sub">Ten fixed rules, run on {num(out.liquid)} liquid stocks at the {dateLabel(asOf)} close. Each tile is a count; tap it for the names and the figure behind each.</p>
        </div>
        <div className="rb-themes" role="group" aria-label="Filter by kind of rule">
          {(['All', ...THEMES] as const).map((t) => <button key={t} type="button" className="chip" aria-pressed={theme === t} onClick={() => setTheme(t)}>{t}</button>)}
        </div>
      </div>
      <ul className="rb-grid">
        {shown.map((r, i) => (
          <li key={r.rule.id} style={{ '--n': i } as React.CSSProperties}>
            <button type="button" className={`rb-tile${r.wide ? ' wide' : ''}`} id={`rule-${r.rule.id}`} onClick={() => setOpen(r)} aria-haspopup="dialog">
              <span className="rb-theme">{r.rule.theme}<span className="sr">. Open the list.</span></span>
              <span className="rb-title">{r.rule.title}</span>
              <span className="rb-count"><b className="num">{num(r.hits.length)}</b><small>of {num(r.eligible)}</small></span>
              <span className="rb-bar" aria-hidden><i style={{ width: `${Math.max(r.hits.length ? 3 : 0, (r.share ?? 0) * 100)}%` }} /></span>
              <span className="rb-names">{r.hits.length ? r.hits.slice(0, 3).map((h) => h.sym).join(' · ') : 'None at this close'}</span>
              {r.wide && <span className="rb-wide">Wide: {Math.round((r.share ?? 0) * 100)}% of stocks. It describes the market more than any one stock.</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="dim rb-foot">{wide > 0 ? `${wide} of ${out.results.length} rules fire on ${Math.round(WIDE_SHARE * 100)}% of stocks or more today, so they read as the market, not as picks. ` : ''}A rule firing is a fact about one close, not a recommendation, and it carries no target or probability. Illiquid stocks are left out; a stock missing a figure is not counted for that rule.</p>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? open.rule.title : 'Rule'}>
        {open && <RuleList r={open} asOf={asOf} />}
      </Drawer>
    </section>
  );
}

function RuleList({ r, asOf }: { r: RuleResult; asOf: string | null }) {
  const [watch, add] = useStoredList('alpha-watchlist');
  const [all, setAll] = useState(false);
  const rows = all ? r.hits : r.hits.slice(0, LIST_CAP);
  return (
    <>
      <p className="rb-check">{r.rule.check}</p>
      <p className="dim rb-meta">{num(r.hits.length)} of {num(r.eligible)} liquid stocks at the {dateLabel(asOf)} close{r.unmeasured > 0 ? `; ${num(r.unmeasured)} could not be measured on this rule` : ''}. Ordered by {r.rule.measure.label.toLowerCase()}, {r.rule.order === 'desc' ? 'highest' : 'lowest'} first.</p>
      {r.hits.length === 0 ? <div className="state"><b>No stock meets this rule at this close.</b><p>That is a result, not a gap.</p></div> : (
        <ul className="rb-list">
          {rows.map((h) => (
            <li key={h.sym}>
              <Link className="rb-sym" href={companyHref(h.sym)}><b>{h.sym}</b><span className="dim">{h.name}</span></Link>
              <span className="rb-val num" title={r.rule.measure.label}>{printValue(r.rule, h.value)}</span>
              <span className="rb-day"><Chg v={h.day} dp={1} /></span>
              <button type="button" className="act quiet rb-follow" onClick={() => add(h.sym)} disabled={watch.includes(h.sym)} aria-label={watch.includes(h.sym) ? `${h.sym} is followed` : `Follow ${h.sym}`}>{watch.includes(h.sym) ? 'Following' : 'Follow'}</button>
            </li>
          ))}
        </ul>
      )}
      {r.hits.length > LIST_CAP && !all && <button type="button" className="act" onClick={() => setAll(true)}>Show all {num(r.hits.length)}</button>}
      <p className="dim rb-meta">The day column is the latest session&apos;s move. Following saves the name on this device only.</p>
    </>
  );
}

/** Four tiles for Today: the same counts, linking to the full board. */
export function RulesToday() {
  const { out, error } = useRuleBoard();
  const ids = ['near-high', 'surge-up', 'oversold', 'pullback'];
  if (error && !out) return <p className="dim" style={{ margin: 0 }}>The rule board could not be loaded.</p>;
  if (!out) return <Skel h={96} />;
  return (
    <ul className="rt-grid">
      {ids.map((id) => out.results.find((x) => x.rule.id === id)!).map((r) => (
        <li key={r.rule.id}>
          <Link className="rt-tile" href={`/engines/#rule-${r.rule.id}`}>
            <span className="rt-t">{r.rule.title}</span>
            <span className="rb-count"><b className="num">{num(r.hits.length)}</b><small>of {num(r.eligible)}</small></span>
            {r.wide && <span className="rt-w">wide</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
