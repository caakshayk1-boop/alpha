'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Rv } from '@/components/ui';
import { cardDelta, parseImport, serializeCard, serializeLibrary, summarise, type CurrentCompany, type ResearchCard } from '@/lib/card';
import { useCards } from '@/lib/library';

const download = (name: string, text: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

/** The local research library: cards saved in this browser, export and import without an account. */
export default function CardPanel({ watchlist, onImportWatchlist, current }: { watchlist: string[]; onImportWatchlist: (syms: string[]) => void; current?: Record<string, CurrentCompany | undefined> }) {
  const { cards, ok, addMany, remove, setNote } = useCards();
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
      <p className="muted" style={{ margin: '8px 0 12px', fontSize: 13.5 }}>A card holds one question, the companies and evidence behind it, what was missing and the data dates, as a file you can keep. Nothing is uploaded and there is no account: if you clear this site&apos;s data the cards go with it, so export what matters.</p>
      {!ok && <p className="notice" role="alert">This browser is blocking or has corrupted local storage, so cards cannot be saved here. You can still import a file to read it, and export it again.</p>}
      <div className="filters">
        <button className="chip" disabled={!cards.length && !watchlist.length} onClick={() => download('alpha-research-library.json', serializeLibrary(watchlist, cards))}>Export everything</button>
        <button className="chip" onClick={() => file.current?.click()}>Import a file…</button>
        <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import a research card or library" onChange={async (e) => { const f = e.target.files?.[0]; if (f) inspect(await f.text()); e.target.value = ''; }} />
      </div>
      <details style={{ margin: '4px 0 12px' }}>
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>Or paste exported JSON</summary>
        <textarea className="field" style={{ width: '100%', minHeight: 90, padding: 10, fontFamily: 'var(--f-mono)', fontSize: 12.5, marginTop: 8 }} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Exported JSON" spellCheck={false} />
        <button className="chip" onClick={() => inspect(paste)} disabled={!paste.trim()} style={{ marginTop: 6 }}>Check it</button>
      </details>
      {error && <p className="notice" role="alert">{error}</p>}
      {done && <p className="muted" role="status" style={{ margin: '8px 0' }}>{done}</p>}
      {preview && (
        <div className="panel tight" style={{ background: 'var(--panel-2)', marginBottom: 12 }}>
          <div className="eyebrow">Preview: nothing is saved until you confirm</div>
          <ul className="muted" style={{ paddingLeft: 18, margin: '8px 0', lineHeight: 1.6, fontSize: 13.5 }}>{preview.cards.map((c) => <li key={c.id}>{summarise(c)}</li>)}{preview.watchlist.length > 0 && <li>Watchlist: {preview.watchlist.join(', ')}</li>}</ul>
          {preview.warnings.length > 0 && <ul className="dim" style={{ paddingLeft: 18, margin: '0 0 8px', fontSize: 12.5 }}>{preview.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>}
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={confirm}>Import {preview.cards.length} card{preview.cards.length === 1 ? '' : 's'}</button><button className="btn ghost" onClick={() => setPreview(null)}>Cancel</button></div>
        </div>
      )}
      {cards.length === 0 ? <p className="dim" style={{ margin: 0 }}>No cards yet. Use &ldquo;Save research card&rdquo; on a company page or after a plain-English screen.</p> : (
        <div className="list">
          {cards.map((c) => (
            <div key={c.id} className="li" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t">{c.question ?? 'Untitled research'}</div>
                <div className="s">{c.companies.slice(0, 8).map((x, i) => <span key={x.sym}>{i ? ', ' : ''}<Link href={`/company/?s=${encodeURIComponent(x.sym)}`} style={{ color: 'var(--accent-2)' }}>{x.sym}</Link></span>)}{c.companies.length > 8 ? ` +${c.companies.length - 8}` : ''} · {c.createdAt.slice(0, 10)}{c.dataStatus.length ? ` · data ${c.dataStatus.filter((s) => s.asOf).map((s) => `${s.id} ${s.asOf}`).join(', ')}` : ''}</div>
                {c.evidence && c.evidence.length > 0 && <ul className="dim" style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12.5 }}>{c.evidence.slice(0, 3).map((e) => <li key={e.text}>{e.side === 'for' ? '▲' : '▼'} {e.text}</li>)}</ul>}
                {current && (() => { const ch = cardDelta(c, current); return (
                  <div style={{ marginTop: 8 }}>
                    <div className="eyebrow">Changed since saved ({new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</div>
                    {ch.length ? <ul className="muted" style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12.5, lineHeight: 1.6 }}>{ch.map((x) => <li key={`${x.sym}-${x.what}`}><b>{x.sym}</b> · {x.what}: {x.before} → {x.after}</li>)}</ul> : <p className="dim" style={{ fontSize: 12.5, margin: '4px 0 0' }}>No change in the saved figures on a newer data date.</p>}
                  </div>); })()}
                <label className="sr" htmlFor={`note-${c.id}`}>Note</label>
                <input id={`note-${c.id}`} className="field" style={{ width: '100%', marginTop: 8, height: 36, fontSize: 13 }} placeholder="Add a private note" defaultValue={c.note ?? ''} onBlur={(e) => setNote(c.id, e.target.value)} />
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
