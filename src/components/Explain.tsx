'use client';

import { useEffect, useState } from 'react';
import { GLOSSARY, definitionFor, metricId } from '@/lib/glossary';

/** Whether the server-side explainer is switched on. null while unknown. Failure means "not available", never an error shown to the reader. */
let status: Promise<boolean> | null = null;
function useExplainerOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    status ??= fetch('/api/explain', { cache: 'no-cache' }).then((r) => r.json() as Promise<{ configured?: boolean }>).then((j) => j.configured === true, () => false);
    status.then((v) => { if (live) setOn(v); });
    return () => { live = false; };
  }, []);
  return on;
}

interface Fact { id: string; label: string; value: string; unit: string }
interface Claim { text: string; facts: string[]; status: 'cited' | 'unverified' }
interface Answer { ok: boolean; claims?: Claim[]; withheld?: string[]; unknowns?: string[]; facts?: Fact[]; as_of?: string | null; model?: string; error?: string; glossary?: string }

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

type Subject = { subject: 'company'; sym: string } | { subject: 'market' } | { subject: 'signal'; id: string };
const PRESETS_FOR: Record<Subject['subject'], string[]> = {
  company: PRESETS,
  market: ['What is the market doing today?', 'Why is the market gate on or off?', 'Which sectors are strongest and weakest?', 'How broad is the move?'],
  signal: ['Explain this plan in plain words', 'Why did this stock qualify?', 'What happens at T1?', 'What would end this trade?'],
};

/** Ask one question about a company, the day's market, or one signal. A definition question is answered from the glossary
 *  with no model call. Anything else goes to the Worker, which answers only in checked claims: every figure is rendered from
 *  its own facts and a claim it cannot check is withheld, not shown with a warning. Hidden while switched off. */
export function AskAI({ title, compact = false, ...who }: Subject & { title: string; compact?: boolean }) {
  const on = useExplainerOn();
  const key = who.subject === 'company' ? who.sym : who.subject === 'signal' ? who.id : 'market';
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Answer | null>(null);
  useEffect(() => { setRes(null); setQ(''); }, [key]);
  if (!on) return null;      // switched off (or unknown): nothing is shown rather than a dead control
  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    const def = definitionFor(text);
    if (def) { setRes({ ok: true, glossary: def }); return; }
    setBusy(true); setRes(null);
    try {
      const r = await fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...who, question: text }) });
      setRes((await r.json()) as Answer);
    } catch { setRes({ ok: false, error: 'Could not reach the explainer. Try again.' }); }
    setBusy(false);
  };
  const fid = `ask-${key.replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <section className={`ask${compact ? ' ask-compact' : ' panel spot'}`} aria-label={title}>
      <div className="eyebrow"><span className="ai-dot" aria-hidden /> {title} · AI, from Alpha&apos;s own figures</div>
      <div className="filters" style={{ marginTop: 8 }}>{PRESETS_FOR[who.subject].map((p) => <button key={p} className="chip" disabled={busy} onClick={() => { setQ(p); void ask(p); }}>{p}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="sr" htmlFor={fid}>Your question</label>
        <input id={fid} className="field" style={{ flex: '1 1 240px', height: 40 }} value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="Ask in your own words" />
        <button className="btn" type="submit" disabled={busy || q.trim().length < 3}>{busy ? 'Reading the figures…' : 'Ask'}</button>
      </form>
      <div role="status" aria-live="polite">
        {busy && <div className="ask-think" aria-hidden><i /><i /><i /></div>}
        {res && !res.ok && <p className="notice" style={{ marginTop: 10 }}>{res.error ?? 'No answer.'}</p>}
        {res && !res.ok && res.unknowns && res.unknowns.length > 0 && <ul className="muted" style={{ margin: '6px 0 0' }}>{res.unknowns.map((u) => <li key={u}>{u}</li>)}</ul>}
        {res?.ok && res.glossary && GLOSSARY[res.glossary] && (
          <div className="ask-answer">
            <p style={{ margin: 0, lineHeight: 1.6 }}><b>{GLOSSARY[res.glossary].name}.</b> {GLOSSARY[res.glossary].what} {GLOSSARY[res.glossary].how}</p>
            <p className="muted" style={{ margin: '6px 0 0' }}>{GLOSSARY[res.glossary].read} {GLOSSARY[res.glossary].caveat}</p>
            <p className="dim" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Alpha&apos;s glossary, a fixed definition; no AI was used. <a href={`/about/#${metricId(res.glossary)}`} style={{ textDecoration: 'underline' }}>Method</a></p>
          </div>
        )}
        {res?.ok && res.claims && (
          <div className="ask-answer">
            <ul className="ask-claims">
              {res.claims.map((c, i) => (
                <li key={i} className={c.status}>
                  {c.text}{' '}
                  {c.facts.map((id) => { const f = (res.facts ?? []).find((x) => x.id === id); return f ? <span key={id} className="cite" title={`${f.label} = ${f.value}${f.unit ? ` ${f.unit}` : ''}`}>{f.label}</span> : null; })}
                  {c.status === 'unverified' && <span className="cite cite-u">explanation, not tied to a figure</span>}
                </li>
              ))}
            </ul>
            {res.unknowns && res.unknowns.length > 0 && <div className="ask-unknown"><b>Not in Alpha&apos;s data:</b> {res.unknowns.join(' · ')}</div>}
            {res.withheld && res.withheld.length > 0 && <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>{res.withheld.length} statement{res.withheld.length > 1 ? 's were' : ' was'} withheld because {res.withheld.length > 1 ? 'they' : 'it'} could not be checked ({res.withheld.join('; ')}).</p>}
            <details style={{ marginTop: 8 }}>
              <summary className="eyebrow" style={{ cursor: 'pointer' }}>The figures it was given{res.as_of ? ` (data as of ${res.as_of})` : ''}</summary>
              <ul className="muted num ask-facts">{(res.facts ?? []).map((f) => <li key={f.id}>{f.id}: {f.label} = {f.value}{f.unit ? ` ${f.unit}` : ''}</li>)}</ul>
            </details>
            <p className="dim" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Model-written wording; every figure is taken from Alpha&apos;s data{res.as_of ? ` as of ${res.as_of}` : ''}, not from the model. Not investment advice, a research aid.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** The company page's question box (kept as a name: CompanyView imports it). */
export function AskCompany({ sym }: { sym: string }) {
  return <AskAI subject="company" sym={sym} title={`Ask about ${sym}`} />;
}
