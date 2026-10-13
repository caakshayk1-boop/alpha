'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SymbolPicker from '@/components/SymbolPicker';
import { Async, Chg, Notice, PageHead, SectionHead, Segmented } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dash, dateLabel, num } from '@/lib/format';
import { ACTIONS, MIN_ENTRIES, makeEntry, mergeJournal, outcome, parseJournal, serializeJournal, summarise } from '@/lib/journal';
import type { JournalAction, JournalEntry } from '@/lib/journal';

const KEY = 'alpha-journal';
const LABEL: Record<JournalAction, string> = { took: 'Took it', skipped: 'Skipped', watching: 'Watching' };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const today = () => new Date().toLocaleDateString('en-CA');

function Field({ label, value, set, prefix }: { label: string; value: string; set: (v: string) => void; prefix?: string }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14, color: 'var(--muted)' }}>
      {label}
      <span style={{ position: 'relative', display: 'block' }}>
        {prefix && <span className="dim" style={{ position: 'absolute', left: 14, top: 10 }}>{prefix}</span>}
        <input className="field" style={{ width: '100%', paddingLeft: prefix ? 30 : 14 }} inputMode="decimal" value={value} onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))} />
      </span>
    </label>
  );
}

export default function Journal() {
  const screen = useFeed('screen');
  const [list, setList] = useState<JournalEntry[]>([]);
  const [sym, setSym] = useState('');
  const [action, setAction] = useState<JournalAction>('took');
  const [date, setDate] = useState('');
  const [why, setWhy] = useState('');
  const [price, setPrice] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState<string | null>(null);

  // Load what is stored, and take a pre-filled idea from the link (symbol, price, stop, target) if there is one.
  useEffect(() => {
    setDate(today());
    try { setList(parseJournal(localStorage.getItem(KEY))); } catch { /* storage blocked: the journal simply does not persist */ }
    try {
      const q = new URLSearchParams(window.location.search);
      const s = q.get('s'); if (s && /^[A-Za-z0-9&-]{1,20}$/.test(s)) setSym(s.toUpperCase());
      const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? String(v) : ''; };
      setPrice(n('p')); setStop(n('sl')); setTarget(n('t'));
    } catch { /* no query string */ }
  }, []);

  const save = useCallback((next: JournalEntry[]) => {
    setList(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  }, []);

  const rows = screen.data?.rows;
  const quote = useMemo(() => {
    const m = new Map<string, { price: number | null; asOf: string | null }>();
    for (const r of rows ?? []) m.set(r.sym, { price: typeof r.price === 'number' ? r.price : null, asOf: r.last_date ?? null });
    return m;
  }, [rows]);
  const priceOf = useCallback((s: string) => quote.get(s)?.price ?? null, [quote]);
  const summary = useMemo(() => summarise(list, priceOf), [list, priceOf]);
  const sorted = useMemo(() => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [list]);

  const add = () => {
    const made = makeEntry({ date, sym, action, why, price, stop, target }, newId());
    if ('error' in made) { setError(made.error); return; }
    setError(null);
    save([...list, made.entry]);
    setWhy(''); setPrice(''); setStop(''); setTarget(''); setSym('');
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([serializeJournal(list)], { type: 'application/json' }));
    a.download = 'alpha-journal.json';
    a.click();
  };
  const importPaste = () => {
    const incoming = parseJournal(paste);
    if (incoming.length === 0) { setNote('Nothing readable in that text. Paste the contents of an alpha-journal.json file.'); return; }
    const merged = mergeJournal(list, incoming);
    setNote(`Added ${merged.length - list.length} of ${incoming.length} entries; the rest were already here.`);
    save(merged); setPaste('');
  };

  return (
    <>
      <PageHead eyebrow="Journal" title="Why you decided," em="and what happened next." lede="Write one honest sentence each time you take, skip or watch a stock. Later, see where the price is against that moment. Nothing is uploaded: it lives in this browser, so export a copy to keep it." />
      <section className="wrap">
        <div className="panel">
          <div className="eyebrow">New entry</div>
          <div className="filters" style={{ marginTop: 12 }}>
            {sym ? <span className="tag acc">{sym} <button className="chip" style={{ marginLeft: 6 }} onClick={() => setSym('')} aria-label="Change company">change</button></span> : <SymbolPicker onPick={setSym} placeholder="Pick a company…" />}
            <Segmented label="What you did" role="group" value={action} onChange={setAction} options={ACTIONS.map((a) => [a, LABEL[a]] as const)} />
          </div>
          <div className="grid g4" style={{ marginTop: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 14, color: 'var(--muted)' }}>Date<input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <Field label="Price then (optional)" value={price} set={setPrice} prefix="₹" />
            <Field label="Stop (optional)" value={stop} set={setStop} prefix="₹" />
            <Field label="Target (optional)" value={target} set={setTarget} prefix="₹" />
          </div>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, color: 'var(--muted)', marginTop: 14 }}>
            Why, in your own words
            <textarea className="field" style={{ width: '100%', minHeight: 80, padding: 12, fontSize: 15 }} maxLength={2000} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What did you see, what would make you wrong, what are you ignoring?" />
          </label>
          {error && <p className="notice" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          <div style={{ marginTop: 14 }}><button className="chip" onClick={add}>Save entry</button></div>
        </div>
      </section>

      <section className="wrap section">
        <SectionHead eyebrow="Pattern" title="Took vs skipped" />
        <div className="grid g3">
          {summary.map((g) => (
            <div className="panel" key={g.action}>
              <div className="eyebrow">{LABEL[g.action]}</div>
              <div className="disp" style={{ fontSize: 34, marginTop: 8 }}>{g.enough && g.avgMovePct !== null ? <Chg v={g.avgMovePct} dp={1} /> : dash}</div>
              <div className="dim" style={{ fontSize: 13.5 }}>{g.entries} {g.entries === 1 ? 'entry' : 'entries'}, {g.measured} with a price now</div>
              {!g.enough && <div className="dim" style={{ fontSize: 13.5 }}>Too early to say: an average appears at {MIN_ENTRIES} measured entries.</div>}
            </div>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0', maxWidth: '75ch' }}>Average move since the day you decided, from the price in the screen. Skipped and watched names show what happened without you. This is a record of your habits, not evidence about any stock, and a handful of entries says little.</p>
      </section>

      <section className="wrap section">
        <SectionHead eyebrow="Entries" title={`${list.length} ${list.length === 1 ? 'decision' : 'decisions'} on record`} />
        <Async loading={screen.loading} error={screen.error} rows={3}>
          {sorted.length === 0 ? <Notice>No entries yet. Add one above, or from a company page.</Notice> : (
            <div className="tbl-wrap" style={{ maxHeight: 'none' }}><table className="tbl">
              <thead><tr><th>Date</th><th>Company</th><th>Did</th><th>Why</th><th>Then</th><th>Now</th><th>Move</th><th>R</th><th /></tr></thead>
              <tbody>{sorted.map((e) => {
                const q = quote.get(e.sym);
                const o = outcome(e, q?.price ?? null);
                return (
                  <tr key={e.id} style={{ cursor: 'default' }}>
                    <td className="num">{dateLabel(e.date)}</td>
                    <td><Link href={`/company/?s=${encodeURIComponent(e.sym)}`} className="co"><b>{e.sym}</b></Link></td>
                    <td><span className={`tag ${e.action === 'took' ? 'acc' : ''}`}>{LABEL[e.action]}</span></td>
                    <td style={{ textAlign: 'left', maxWidth: 360, whiteSpace: 'normal' }}>{e.why}</td>
                    <td className="num">{e.price !== null ? `₹${num(e.price, 2)}` : dash}</td>
                    <td className="num" title={q?.asOf ? `Screen price as of ${dateLabel(q.asOf)}` : undefined}>{q?.price != null ? `₹${num(q.price, 2)}` : dash}</td>
                    <td>{o.movePct !== null ? <Chg v={o.movePct} dp={1} /> : dash}{o.state === 'below-stop' && <span className="tag down" style={{ marginLeft: 6 }} title="Today's price is at or below your stop. It may have gone below earlier and come back, or the reverse: only today's price is checked.">at/below stop</span>}{o.state === 'above-target' && <span className="tag up" style={{ marginLeft: 6 }} title="Today's price is at or above your target.">at/above target</span>}</td>
                    <td className="num">{o.r !== null ? `${o.r >= 0 ? '+' : '−'}${Math.abs(o.r).toFixed(1)}R` : dash}</td>
                    <td><button className="chip" onClick={() => save(list.filter((x) => x.id !== e.id))} aria-label={`Delete the ${e.sym} entry from ${dateLabel(e.date)}`}>✕</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Async>
        <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0', maxWidth: '75ch' }}>Move and R compare today&apos;s screen price with the price you wrote down, for a long idea. Only today&apos;s price is checked, so a stop or target touched in between is not seen. R needs a stop.</p>
      </section>

      <section className="wrap section">
        <div className="panel">
          <div className="eyebrow">Keep a copy</div>
          <p className="muted" style={{ margin: '8px 0 12px' }}>The journal is stored in this browser only. Clearing site data erases it, so download a copy now and then. Importing the same file twice adds nothing twice.</p>
          <div className="filters"><button className="chip" disabled={list.length === 0} onClick={download}>Download JSON</button></div>
          <textarea className="field" style={{ width: '100%', minHeight: 70, padding: 10, fontFamily: 'var(--f-mono)', fontSize: 13.5, marginTop: 10 }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the contents of an alpha-journal.json file here" aria-label="Paste a journal file to import" />
          <div style={{ marginTop: 10 }}><button className="chip" disabled={!paste.trim()} onClick={importPaste}>Import pasted file</button></div>
          {note && <p className="notice" role="status" style={{ marginTop: 12 }}>{note}</p>}
        </div>
      </section>
    </>
  );
}
