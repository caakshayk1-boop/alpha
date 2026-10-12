'use client';

import { useMemo, useState } from 'react';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed, useFeedWhen } from '@/lib/data';
import { groupStories, matchCompanies } from '@/lib/news';
import { useStoredList } from '@/lib/store';
import { plainText } from '@/lib/format';

const when = (iso?: string | null) => {
  if (!iso) return 'time not stated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'time not stated';
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })} IST`;
};

export default function News() {
  const n = useFeed('news');
  const [watch] = useStoredList('alpha-watchlist');
  const [mine, setMine] = useState(false);
  const scr = useFeedWhen('screen', mine && watch.length > 0);     // the big feed is fetched only when this filter is used
  const cos = useMemo(() => (scr.data?.rows ?? []).filter((r) => watch.includes(r.sym)).map((r) => ({ sym: r.sym, name: r.name })), [scr.data, watch]);
  const [source, setSource] = useState('');
  const [topic, setTopic] = useState('');
  const topics: [string, RegExp][] = [['Markets', /nifty|sensex|market|stocks?|shares?|index|equity/i], ['Companies', /results?|profit|earnings|quarter|ipo|acquisition|stake|order/i], ['Economy', /rbi|inflation|gdp|rate|budget|economy|fiscal|tax|trade/i], ['Commodities & FX', /oil|crude|gold|silver|rupee|dollar|currency|commodity/i]];
  const sources = useMemo(() => Array.from(new Set((n.data ?? []).map((s) => s.source))).sort(), [n.data]);
  const list = useMemo(() => (n.data ?? []).filter((s) => (!source || s.source === source) && (!topic || topics.find((t) => t[0] === topic)?.[1].test(`${s.title} ${s.summary}`))).sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '')), [n.data, source, topic]); // eslint-disable-line react-hooks/exhaustive-deps
  const matched = useMemo(() => new Map(list.map((s) => [s.link, matchCompanies(`${plainText(s.title)} ${plainText(s.summary)}`, cos)])), [list, cos]);
  const shown = useMemo(() => (mine ? list.filter((s) => (matched.get(s.link) ?? []).length > 0) : list), [mine, list, matched]);
  const groups = useMemo(() => groupStories(shown), [shown]);
  return (
    <>
      <PageHead eyebrow="News" title="The wire," em="filtered." lede="Stories from the sources you would check anyway, in one list, newest first. Each opens at the publisher. Topics are matched by keywords in the headline and summary, so they are a convenience, not a classification." />
      <section className="wrap" style={{ maxWidth: 860 }}>
        <Async loading={n.loading} error={n.error}>
          <div className="filters" role="group" aria-label="Topic"><button className="chip" aria-pressed={topic === ''} onClick={() => setTopic('')}>All topics</button>{topics.map(([t]) => <button key={t} className="chip" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? '' : t)}>{t}</button>)}</div>
          <div className="filters" role="group" aria-label="Source"><button className="chip" aria-pressed={source === ''} onClick={() => setSource('')}>All sources</button>{sources.map((s) => <button key={s} className="chip" aria-pressed={source === s} onClick={() => setSource(source === s ? '' : s)}>{s}</button>)}</div>
          <div className="filters" role="group" aria-label="Relevance"><button className="chip" aria-pressed={mine} onClick={() => setMine((v) => !v)} disabled={watch.length === 0} title={watch.length === 0 ? 'Add companies to your watchlist first' : 'Only stories that name a company on your watchlist'}>Only my watchlist{watch.length ? ` (${watch.length})` : ''}</button>{watch.length === 0 && <span className="dim" style={{ fontSize: 14 }}>Your watchlist is empty. <a href="/watchlist/" style={{ color: 'var(--accent-2)' }}>Add companies</a> to filter by them.</span>}{mine && scr.loading && <span className="dim" style={{ fontSize: 14 }}>Loading company names…</span>}</div>
          <p className="dim" style={{ fontSize: 13.5, margin: '0 0 6px' }}>{groups.length} {groups.length === 1 ? 'story' : 'stories'}{shown.length !== groups.length ? ` (${shown.length} reports; repeated coverage is grouped)` : ''}. Times are shown in Indian Standard Time (IST), converted from each publisher&apos;s feed.</p>
          <div className="list">
            {groups.map(({ lead: s, more }) => (
              <Rv key={s.link}>
                <a href={s.link} target="_blank" rel="noopener noreferrer" className="li" style={{ padding: '22px 0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>{s.source} · <time dateTime={s.published ?? undefined}>{when(s.published)}</time></div>
                    {(() => {
                      const title = plainText(s.title), sum = plainText(s.summary);
                      // the feed cuts long summaries at 380 characters; only then is the last word dropped for an ellipsis
                      const text = s.summary.length >= 380 ? sum.replace(/\s+\S*$/, '…') : sum;
                      return <><div className="disp" style={{ fontSize: 26, lineHeight: 1.15 }}>{title}</div>{sum && sum !== title && <p className="muted" style={{ margin: '8px 0 0', maxWidth: '64ch', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</p>}</>;
                    })()}
                  </div>
                  <span aria-hidden className="dim">↗</span>
                </a>
                {(more.length > 0 || (matched.get(s.link) ?? []).length > 0) && (
                  <div className="dim" style={{ fontSize: 14, margin: '-12px 0 18px', display: 'grid', gap: 6 }}>
                    {(matched.get(s.link) ?? []).length > 0 && <div>Mentions: {(matched.get(s.link) ?? []).map((m) => <span key={m.sym} className="tag" title={`Matched because ${m.basis}`} style={{ marginRight: 6 }}>{m.sym} · {m.basis}</span>)}</div>}
                    {more.length > 0 && <details><summary style={{ cursor: 'pointer' }}>Also reported by {more.length} other {more.length === 1 ? 'source' : 'sources'}</summary><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{more.map((m) => <li key={m.link}><a href={m.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-2)' }}>{m.source}: {plainText(m.title)} ↗</a></li>)}</ul></details>}
                  </div>
                )}
              </Rv>
            ))}
            {groups.length === 0 && <p className="notice">{mine ? 'No story names a company on your watchlist right now.' : 'No story matches these filters.'}</p>}
          </div>
        </Async>
      </section>
    </>
  );
}
