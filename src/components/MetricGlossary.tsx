'use client';

import { useEffect, useState } from 'react';
import { metricId, searchGlossary } from '@/lib/glossary';

/** Every measure Alpha shows, in plain language, searchable, each with a stable anchor (#metric-roce). Fixed text: no AI involved. */
export default function MetricGlossary() {
  const [q, setQ] = useState('');
  const hits = searchGlossary(q);
  // a link such as /about/#metric-roce should land on its entry once the list has rendered
  // Tables above this section load after first paint and move it, so the jump is repeated until the layout has settled.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (!h.startsWith('metric-')) return undefined;
    const go = () => { const el = document.getElementById(h); if (el && Math.abs(el.getBoundingClientRect().top) > 120) el.scrollIntoView({ block: 'start', behavior: 'instant' }); };
    const timers = [0, 600, 1500, 3000].map((ms) => window.setTimeout(go, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  return (
    <div>
      <label className="sr" htmlFor="gloss-q">Search the measures</label>
      <input id="gloss-q" className="field" style={{ width: '100%', maxWidth: 420, height: 44 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: ROCE, debt, momentum, cash…" spellCheck={false} />
      <p className="dim" role="status" aria-live="polite" style={{ fontSize: 14, margin: '8px 0 14px' }}>{hits.length} {hits.length === 1 ? 'measure' : 'measures'}{q.trim() ? ` match “${q.trim()}”` : ''}.</p>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        {hits.map(([k, e]) => (
          <section key={k} id={metricId(k)} className="panel tight" style={{ scrollMarginTop: 90 }}>
            <div className="eyebrow">{k}</div>
            <h3 className="disp" style={{ fontSize: 24, margin: '6px 0 6px' }}>{e.name}</h3>
            <p style={{ margin: '0 0 8px' }}>{e.what}</p>
            <dl className="muted" style={{ margin: 0, display: 'grid', gap: 6, fontSize: 15 }}>
              <div><b style={{ color: 'var(--text)' }}>How it is worked out:</b> {e.how}</div>
              <div><b style={{ color: 'var(--text)' }}>How to read it:</b> {e.read}</div>
              <div><b style={{ color: 'var(--text)' }}>Watch out:</b> {e.caveat}</div>
            </dl>
          </section>
        ))}
      </div>
      {hits.length === 0 && <p className="notice">No measure matches. Try a shorter word, such as &ldquo;debt&rdquo; or &ldquo;growth&rdquo;.</p>}
    </div>
  );
}
