'use client';

import { useMemo, useState } from 'react';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';

const when = (iso?: string | null) => {
  if (!iso) return 'time not stated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'time not stated';
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${d.toISOString().slice(11, 16)} UTC`;
};

export default function News() {
  const n = useFeed('news');
  const [source, setSource] = useState('');
  const [topic, setTopic] = useState('');
  const topics: [string, RegExp][] = [['Markets', /nifty|sensex|market|stocks?|shares?|index|equity/i], ['Companies', /results?|profit|earnings|quarter|ipo|acquisition|stake|order/i], ['Economy', /rbi|inflation|gdp|rate|budget|economy|fiscal|tax|trade/i], ['Commodities & FX', /oil|crude|gold|silver|rupee|dollar|currency|commodity/i]];
  const sources = useMemo(() => Array.from(new Set((n.data ?? []).map((s) => s.source))).sort(), [n.data]);
  const list = useMemo(() => (n.data ?? []).filter((s) => (!source || s.source === source) && (!topic || topics.find((t) => t[0] === topic)?.[1].test(`${s.title} ${s.summary}`))).sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '')), [n.data, source, topic]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageHead eyebrow="News" title="The wire," em="filtered." lede="Stories from the sources you would check anyway, in one list, newest first. Each opens at the publisher. Topics are matched by keywords in the headline and summary, so they are a convenience, not a classification." />
      <section className="wrap" style={{ maxWidth: 860 }}>
        <Async loading={n.loading} error={n.error}>
          <div className="filters" role="group" aria-label="Topic"><button className="chip" aria-pressed={topic === ''} onClick={() => setTopic('')}>All topics</button>{topics.map(([t]) => <button key={t} className="chip" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? '' : t)}>{t}</button>)}</div>
          <div className="filters" role="group" aria-label="Source"><button className="chip" aria-pressed={source === ''} onClick={() => setSource('')}>All sources</button>{sources.map((s) => <button key={s} className="chip" aria-pressed={source === s} onClick={() => setSource(source === s ? '' : s)}>{s}</button>)}</div>
          <p className="dim" style={{ fontSize: 12.5, margin: '0 0 6px' }}>{list.length} {list.length === 1 ? 'story' : 'stories'}. Times are UTC, from each publisher&apos;s feed; add 5 hours 30 minutes for IST.</p>
          <div className="list">
            {list.map((s) => (
              <Rv key={s.link}>
                <a href={s.link} target="_blank" rel="noopener noreferrer" className="li" style={{ padding: '22px 0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>{s.source} · <time dateTime={s.published ?? undefined}>{when(s.published)}</time></div>
                    <div className="disp" style={{ fontSize: 26, lineHeight: 1.15 }}>{s.title}</div>
                    {s.summary && s.summary !== s.title && <p className="muted" style={{ margin: '8px 0 0', maxWidth: '64ch', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.summary.replace(/\s+\S*$/, s.summary.length >= 380 ? '…' : '$&')}</p>}
                  </div>
                  <span aria-hidden className="dim">↗</span>
                </a>
              </Rv>
            ))}
            {list.length === 0 && <p className="notice">No story matches these filters.</p>}
          </div>
        </Async>
      </section>
    </>
  );
}
