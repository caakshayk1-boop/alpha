'use client';

import { useEffect, useState } from 'react';
import { GLOSSARY, metricId } from '@/lib/glossary';

/** Whether the server-side explainer is switched on. null while unknown. Failure means "not available", never an error shown to the reader. */
let status: Promise<boolean> | null = null;
function useExplainerOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    status ??= fetch('/api/explain').then((r) => r.json() as Promise<{ configured?: boolean }>).then((j) => j.configured === true, () => false);
    status.then((v) => { if (live) setOn(v); });
    return () => { live = false; };
  }, []);
  return on;
}

interface Fact { id: string; label: string; value: string; unit: string }
interface Answer { ok: boolean; answer?: string; facts?: Fact[]; unverifiedNumbers?: string[]; as_of?: string | null; error?: string }

/** Definition of one measure, in plain language, with this company's own value. Fixed text: it needs no AI and always works. */
export function MetricPanel({ metric, value, sym, onClose }: { metric: string; value: string; sym: string; onClose: () => void }) {
  const e = GLOSSARY[metric];
  if (!e) return null;
  return (
    <section className="panel" role="region" aria-label={`About ${e.name}`} style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div className="eyebrow">What this means · {e.name}</div>
        <button className="chip" onClick={onClose} aria-label="Close explanation">Close ✕</button>
      </div>
      <p className="disp" style={{ fontSize: 26, lineHeight: 1.2, margin: '10px 0 6px' }}>{sym}: {value}</p>
      <p style={{ margin: '0 0 8px' }}>{e.what}</p>
      <dl className="muted" style={{ margin: 0, display: 'grid', gap: 6, fontSize: 15 }}>
        <div><b style={{ color: 'var(--text)' }}>How it is worked out:</b> {e.how}</div>
        <div><b style={{ color: 'var(--text)' }}>How to read it:</b> {e.read}</div>
        <div><b style={{ color: 'var(--text)' }}>Watch out:</b> {e.caveat}</div>
      </dl>
      <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 0' }}>A standard definition, not advice and not a forecast. Every measure is defined on the <a href={`/about/#${metricId(metric)}`} style={{ color: 'var(--accent-2)' }}>Methods</a> page.</p>
    </section>
  );
}

const PRESETS = ['What stands out about this company?', 'Is the profit backed by cash?', 'How heavy is the debt?', 'What do the four scores say?'];

/** Ask one question about one company. The server answers from that company's own figures only, cites them, and the figures it used are shown. */
export function AskCompany({ sym }: { sym: string }) {
  const on = useExplainerOn();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Answer | null>(null);
  useEffect(() => { setRes(null); setQ(''); }, [sym]);
  if (!on) return null;      // switched off (or unknown): nothing is shown rather than a dead control
  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(true); setRes(null);
    try {
      const r = await fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sym, question: text }) });
      setRes((await r.json()) as Answer);
    } catch { setRes({ ok: false, error: 'Could not reach the explainer. Try again.' }); }
    setBusy(false);
  };
  return (
    <section className="panel spot" aria-label="Ask about this company">
      <div className="eyebrow">Ask about {sym} · AI-written from the figures on this page</div>
      <p className="muted" style={{ margin: '8px 0 12px', fontSize: 15 }}>The answer is written by a language model from this company&apos;s own figures only. Your question and the symbol are sent; nothing else from your browser is. It does not give buy or sell advice.</p>
      <div className="filters">{PRESETS.map((p) => <button key={p} className="chip" disabled={busy} onClick={() => { setQ(p); void ask(p); }}>{p}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="sr" htmlFor="ask-q">Your question about {sym}</label>
        <input id="ask-q" className="field" style={{ flex: '1 1 260px', height: 44 }} value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Why is its ROCE so high?" />
        <button className="btn" type="submit" disabled={busy || q.trim().length < 3}>{busy ? 'Reading the figures…' : 'Ask'}</button>
      </form>
      <div role="status" aria-live="polite">
        {res && !res.ok && <p className="notice" style={{ marginTop: 12 }}>{res.error ?? 'No answer.'}</p>}
        {res?.ok && res.answer && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: 0, lineHeight: 1.65 }}>{res.answer}</p>
            {res.unverifiedNumbers && res.unverifiedNumbers.length > 0 && <p className="notice" style={{ marginTop: 10 }}><b>Check these figures:</b> {res.unverifiedNumbers.join(', ')} could not be matched to the figures below, so treat them as unverified.</p>}
            <details style={{ marginTop: 10 }}>
              <summary className="eyebrow" style={{ cursor: 'pointer' }}>The figures it was given{res.as_of ? ` (data as of ${res.as_of})` : ''}</summary>
              <ul className="muted num" style={{ columns: 2, paddingLeft: 18, fontSize: 14 }}>{(res.facts ?? []).map((f) => <li key={f.id}>{f.id}: {f.label} = {f.value}{f.unit ? ` ${f.unit}` : ''}</li>)}</ul>
            </details>
            <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 0' }}>AI-written, not reviewed by a person. Information only, not investment advice. The bracketed ids point to the figures above; whether each id is attached to the right figure is not checked by a machine.</p>
          </div>
        )}
      </div>
    </section>
  );
}
