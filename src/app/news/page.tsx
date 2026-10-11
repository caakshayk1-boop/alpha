'use client';

import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';

export default function News() {
  const n = useFeed('news');
  return (
    <>
      <PageHead eyebrow="News" title="The wire," em="filtered." lede="Stories from the sources you would check anyway, in one list. Each opens at the publisher." />
      <section className="wrap" style={{ maxWidth: 860 }}>
        <Async loading={n.loading} error={n.error}>
          <div className="list">
            {n.data?.map((s) => (
              <Rv key={s.link}>
                <a href={s.link} target="_blank" rel="noopener noreferrer" className="li" style={{ padding: '22px 0' }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>{s.source}</div>
                    <div className="disp" style={{ fontSize: 26, lineHeight: 1.15 }}>{s.title}</div>
                    {s.summary && s.summary !== s.title && <p className="muted" style={{ margin: '8px 0 0', maxWidth: '64ch' }}>{s.summary}</p>}
                  </div>
                  <span aria-hidden className="dim">↗</span>
                </a>
              </Rv>
            ))}
          </div>
        </Async>
      </section>
    </>
  );
}
