'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Rv } from '@/components/ui';
import { cardDelta, parseImport, reviewDue, serializeCard, serializeLibrary, summarise, type CardDecision, type CurrentCompany, type ResearchCard } from '@/lib/card';
import { useCards } from '@/lib/library';
import { companyHref } from '@/lib/slug';

const download = (name: string, text: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  try { localStorage.setItem('alpha-last-export', new Date().toISOString()); } catch { /* not recorded */ }      // shown on My Desk
};

/** The local research library: cards saved in this browser, export and import without an account. */
export default function CardPanel({ watchlist, onImportWatchlist, current }: { watchlist: string[]; onImportWatchlist: (syms: string[]) => void; current?: Record<string, CurrentCompany | undefined> }) {
  const { cards, ok, addMany, remove, setNote, setDecision } = useCards();
  const [paste, setPaste] = useState('');
  const [preview, setPreview] = useState<{ cards: ResearchCard[]; watchlist: string[]; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const inspect = (text: string) => {
    setDone(null);
    const r = parseImport(text);
    if (!r.ok) { setPreview(null); setError(r.error); return; }
    setError(null);
    setPreview({ ...r.value, warnings: r.warnings });
  };
  const confirm = () => {
    if (!preview) return;
    const saved = addMany(preview.cards);
    if (preview.watchlist.length) onImportWatchlist(preview.watchlist);
    setDone(saved ? `Imported ${preview.cards.length} card${preview.cards.length === 1 ? '' : 's'}${preview.watchlist.length ? ` and ${preview.watchlist.length} watchlist name${preview.watchlist.length === 1 ? '' : 's'}` : ''}.` : 'Could not write to this browser\'s storage: nothing was imported. Free some space or allow site data, then try again.');
    setPreview(null);
    setPaste('');
  };

  return (
    <Rv className="panel">
      <div className="eyebrow">Research cards · kept in this browser only</div>
      <p className="muted" style={{ margin: '8px 0 12px', fontSize: 14.5 }}>A card holds one question, the companies and evidence behind it, what was missing and the data dates, as a file you can keep. Nothing is uploaded and there is no account: if you clear this site&apos;s data the cards go with it, so export what matters.</p>
      {!ok && <p className="notice" role="alert">This browser is blocking or has corrupted local storage, so cards cannot be saved here. You can still import a file to read it, and export it again.</p>}
      <div className="filters">
        <button className="chip" disabled={!cards.length && !watchlist.length} onClick={() => download('alpha-research-library.json', serializeLibrary(watchlist, cards))}>Export everything</button>
        <button className="chip" onClick={() => file.current?.click()}>Import a file…</button>
        <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import a research card or library" onChange={async (e) => { const f = e.target.files?.[0]; if (f) inspect(await f.text()); e.target.value = ''; }} />
      </div>
      <details style={{ margin: '4px 0 12px' }}>
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>Or paste exported JSON</summary>
        <textarea className="field" style={{ width: '100%', minHeight: 90, padding: 10, fontFamily: 'var(--f-mono)', fontSize: 13.5, marginTop: 8 }} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Exported JSON" spellCheck={false} />
        <button className="chip" onClick={() => inspect(paste)} disabled={!paste.trim()} style={{ marginTop: 6 }}>Check it</button>
      </details>
      {error && <p className="notice" role="alert">{error}</p>}
      {done && <p className="muted" role="status" style={{ margin: '8px 0' }}>{done}</p>}
      {preview && (
        <div className="panel tight" style={{ background: 'var(--panel-2)', marginBottom: 12 }}>
          <div className="eyebrow">Preview: nothing is saved until you confirm</div>
          <ul className="muted" style={{ paddingLeft: 18, margin: '8px 0', lineHeight: 1.6, fontSize: 14.5 }}>{preview.cards.map((c) => <li key={c.id}>{summarise(c)}</li>)}{preview.watchlist.length > 0 && <li>Watchlist: {preview.watchlist.join(', ')}</li>}</ul>
          {preview.warnings.length > 0 && <ul className="dim" style={{ paddingLeft: 18, margin: '0 0 8px', fontSize: 13.5 }}>{preview.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>}
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={confirm}>Import {preview.cards.length} card{preview.cards.length === 1 ? '' : 's'}</button><button className="btn ghost" onClick={() => setPreview(null)}>Cancel</button></div>
        </div>
      )}
      {cards.length === 0 ? <p className="dim" style={{ margin: 0 }}>No cards yet. Use &ldquo;Save research card&rdquo; on a company page or after a plain-English screen.</p> : (
        <div className="list">
          {cards.map((c) => (
            <div key={c.id} className="li" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t">{c.question ?? 'Untitled research'}</div>
                <div className="s">{c.companies.slice(0, 8).map((x, i) => <span key={x.sym}>{i ? ', ' : ''}<Link href={companyHref(x.sym)} style={{ color: 'var(--accent-2)' }}>{x.sym}</Link></span>)}{c.companies.length > 8 ? ` +${c.companies.length - 8}` : ''} · {c.createdAt.slice(0, 10)}{c.dataStatus.length ? ` · data ${c.dataStatus.filter((s) => s.asOf).map((s) => `${s.id} ${s.asOf}`).join(', ')}` : ''}</div>
                {c.evidence && c.evidence.length > 0 && <ul className="dim" style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 13.5 }}>{c.evidence.slice(0, 3).map((e) => <li key={e.text}>{e.side === 'for' ? '▲' : '▼'} {e.text}</li>)}</ul>}
                {current && (() => { const ch = cardDelta(c, current); return (
                  <div style={{ marginTop: 8 }}>
                    <div className="eyebrow">Changed since saved ({new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</div>
                    {ch.length ? <ul className="muted" style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 13.5, lineHeight: 1.6 }}>{ch.map((x) => <li key={`${x.sym}-${x.what}`}><b>{x.sym}</b> · {x.what}: {x.before} → {x.after}</li>)}</ul> : <p className="dim" style={{ fontSize: 13.5, margin: '4px 0 0' }}>No change in the saved figures on a newer data date.</p>}
                  </div>); })()}
                <DecisionEditor card={c} onSave={(d) => setDecision(c.id, d)} due={reviewDue(c, new Date().toISOString().slice(0, 10), current ?? {})} />
                <label className="sr" htmlFor={`note-${c.id}`}>Note</label>
                <input id={`note-${c.id}`} className="field" style={{ width: '100%', marginTop: 8, height: 36, fontSize: 14 }} placeholder="Add a private note" defaultValue={c.note ?? ''} onBlur={(e) => setNote(c.id, e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="chip" onClick={() => download(`alpha-card-${c.companies[0]?.sym ?? 'research'}-${c.createdAt.slice(0, 10)}.json`, serializeCard(c))}>Export</button>
                <button className="chip" onClick={() => remove(c.id)} aria-label="Delete this card">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Rv>
  );
}

/** "What would change my mind" (Pro §22.3): four fields in the reader's own words. Saving a thesis with no disconfirming
 *  point asks for one (skippable): the countercase is first-class here too. */
function DecisionEditor({ card, onSave, due }: { card: ResearchCard; onSave: (d: CardDecision | null) => boolean; due: string[] }) {
  const d = card.decision;
  const [f, setF] = useState({ thesis: d?.thesis ?? '', against: d?.against ?? '', unknowns: d?.unknowns ?? '', reviewOn: d?.reviewOn?.slice(0, 10) ?? '', results: d?.reviewWhen === 'results' });
  const [msg, setMsg] = useState<string | null>(null);
  const save = () => {
    const next: CardDecision = { thesis: f.thesis.trim() || null, against: f.against.trim() || null, unknowns: f.unknowns.trim() || null, reviewOn: f.reviewOn || null, reviewWhen: f.results ? 'results' : null };
    const empty = !next.thesis && !next.against && !next.unknowns && !next.reviewOn && !next.reviewWhen;
    setMsg(onSave(empty ? null : next) ? 'Saved in this browser.' : 'Could not save: this browser is blocking storage.');
  };
  const id = (k: string) => `dec-${k}-${card.id}`;
  return (
    <details className="decision" open={!!d || due.length > 0}>
      <summary className="eyebrow">What would change my mind{due.length > 0 && <span className="tag warn" style={{ marginLeft: 8 }}>Needs review</span>}</summary>
      {due.length > 0 && <p className="dim" style={{ margin: '6px 0', fontSize: 13.5 }}>Due because: {due.join('; ')}.</p>}
      <div className="dec-grid">
        <label htmlFor={id('t')}>Thesis<textarea id={id('t')} className="field" rows={2} value={f.thesis} onChange={(e) => setF({ ...f, thesis: e.target.value })} placeholder="What I think, in one or two sentences" /></label>
        <label htmlFor={id('a')}>Disconfirming evidence I would watch<textarea id={id('a')} className="field" rows={2} value={f.against} onChange={(e) => setF({ ...f, against: e.target.value })} placeholder="What would show this is wrong" /></label>
        <label htmlFor={id('u')}>Unknowns<textarea id={id('u')} className="field" rows={2} value={f.unknowns} onChange={(e) => setF({ ...f, unknowns: e.target.value })} placeholder="What the data here does not tell me" /></label>
        <div className="dec-when">
          <label htmlFor={id('d')}>Review on <input id={id('d')} type="date" className="field" value={f.reviewOn} onChange={(e) => setF({ ...f, reviewOn: e.target.value })} /></label>
          <label className="keys-toggle" style={{ margin: 0 }}><input type="checkbox" checked={f.results} onChange={(e) => setF({ ...f, results: e.target.checked })} /> and when the next results are out</label>
        </div>
      </div>
      {f.thesis.trim() && !f.against.trim() && <p className="dim" style={{ margin: '6px 0 0', fontSize: 13.5 }}>Add one point that would prove this wrong. Optional, but a thesis with no counterpoint is easy to keep for the wrong reasons.</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}><button type="button" className="chip" onClick={save}>Save</button>{msg && <span className="dim" role="status" style={{ fontSize: 13 }}>{msg}</span>}</div>
    </details>
  );
}
