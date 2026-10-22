'use client';
/** Journal, the My Desk tab: why you took, skipped or watched a name, and where its price is now. An entry is useful from the
 *  first one; only the group average waits for MIN_ENTRIES measured decisions, because an average of two is not a rate.
 *  Every result is a PRICE FOLLOW-UP (current price against the decision price), not executed P&L: a stop or target touched
 *  in between is not tracked, and each result says so beside it (T08). */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chg, Segmented, Skel } from '@/components/ui';
import { Drawer } from '@/components/company/Parts';
import { QuickAdd, plural, stampLabel, type Go } from '@/components/desk/common';
import type { ResearchCard } from '@/lib/card';
import { dateLabel, num } from '@/lib/format';
import { ACTIONS, MIN_ENTRIES, makeEntry, outcome, summarise, type JournalAction, type JournalEntry } from '@/lib/journal';
import type { LiveSnap } from '@/lib/live';
import { priceLabel, priceView } from '@/lib/price';
import { companyHref } from '@/lib/slug';
import type { Row } from '@/lib/types';

const LABEL: Record<JournalAction, string> = { took: 'Took it', skipped: 'Skipped', watching: 'Watching' };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const localToday = () => new Date().toLocaleDateString('en-CA');
const FOLLOW_UP = 'Price follow-up, not executed P&L';

export function JournalTab({ list, setList, ready, storeError, rows, loading, error, snap, focus, cards, go }: {
  list: JournalEntry[]; setList: (f: (cur: JournalEntry[]) => JournalEntry[]) => boolean; ready: boolean; storeError: string | null;
  rows: Row[] | null; loading: boolean; error: string | null; snap: LiveSnap | null; focus: string | null; cards: ResearchCard[]; go: Go;
}) {
  const quote = useMemo(() => {
    const m = new Map<string, { price: number | null; label: string }>();
    for (const r of rows ?? []) { const pv = priceView(r.sym, r, snap); m.set(r.sym, { price: pv.price, label: priceLabel(pv).text }); }
    return m;
  }, [rows, snap]);
  const summary = useMemo(() => summarise(list, (s) => quote.get(s)?.price ?? null), [list, quote]);
  const shown = useMemo(() => [...list].filter((e) => !focus || e.sym === focus).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [list, focus]);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid-lead desk-journal">
      <section className="card" aria-labelledby="jr-h">
        <div className="card-h"><h2 id="jr-h">Decisions on record <span className="dim num" style={{ fontWeight: 500 }}>· {num(shown.length)}</span></h2></div>
        {storeError && <p className="desk-err" role="alert">{storeError}</p>}
        {!ready ? <Skel h={120} /> : shown.length === 0 ? (
          <div className="state">
            <b>{focus ? `No journal entry for ${focus} yet.` : 'No decisions recorded yet.'}</b>
            <p>Write down why you took, skipped or watched a company, in a sentence. One entry is already useful: later you see where the price went against the price you decided at.</p>
            <div className="acts"><button type="button" className="act" onClick={() => formRef.current?.querySelector<HTMLElement>('input, textarea')?.focus()}>Write the first entry</button></div>
          </div>
        ) : (
          <ul className="rows desk-jrows">
            {shown.map((e) => <li key={e.id}><EntryRow e={e} q={quote.get(e.sym) ?? null} loading={loading} cards={cards.filter((c) => c.companies.some((x) => x.sym === e.sym)).length} onEdit={() => setEditing(e)} onDelete={() => setList((cur) => cur.filter((x) => x.id !== e.id))} go={go} /></li>)}
          </ul>
        )}
        {error && !rows && <p className="desk-err" role="status">The screen did not load, so no current price is shown. Your entries are unchanged.</p>}
        <p className="card-foot"><b>{FOLLOW_UP}.</b> &ldquo;Now&rdquo; is the current price under the site&apos;s one price rule, compared with the price you wrote down. It cannot see whether the stop or the target was touched in between, and no trade was executed.</p>
      </section>

      <div className="desk-aside">
        <section className="card tight" aria-labelledby="jn-h">
          <div className="card-h"><h3 id="jn-h">New entry</h3></div>
          <NewEntry formRef={formRef} focus={focus} onSave={(entry) => setList((cur) => [...cur, entry])} />
        </section>
        <section className="card tight" aria-labelledby="js-h">
          <div className="card-h"><h3 id="js-h">Took, skipped, watching</h3></div>
          <ul className="rows">
            {summary.map((g) => (
              <li key={g.action} className="row">
                <span style={{ minWidth: 0 }}><span className="row-t">{LABEL[g.action]}</span><span className="row-s">{plural(g.entries, 'entry', 'entries')}, {g.measured} with a price now</span></span>
                <span className="row-r">{g.enough && g.avgMovePct !== null ? <><Chg v={g.avgMovePct} dp={1} /><small>average price follow-up</small></> : <small className="desk-need">Needs {MIN_ENTRIES} measured decisions for an average ({g.measured} so far)</small>}</span>
              </li>
            ))}
          </ul>
          <p className="card-foot">An average is a price follow-up across your entries, not a return you earned. It appears only at {MIN_ENTRIES} measured decisions in a group, so two lucky calls do not read as a rate.</p>
        </section>
      </div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit the ${editing.sym} entry` : 'Edit entry'}>
        {editing && <EntryEditor key={editing.id} e={editing} onSave={(next) => { const ok = setList((cur) => cur.map((x) => (x.id === next.id ? next : x))); if (ok) setEditing(null); return ok; }} />}
      </Drawer>
    </div>
  );
}

function EntryRow({ e, q, loading, cards, onEdit, onDelete, go }: { e: JournalEntry; q: { price: number | null; label: string } | null; loading: boolean; cards: number; onEdit: () => void; onDelete: () => void; go: Go }) {
  const [confirm, setConfirm] = useState(false);
  const o = outcome(e, q?.price ?? null);
  return (
    <article className="jrow" aria-label={`${e.sym}, ${LABEL[e.action]}, ${dateLabel(e.date)}`}>
      <div className="jrow-h">
        <Link className="row-t link" href={companyHref(e.sym)}>{e.sym}</Link>
        <span className={`pill nodot${e.action === 'took' ? ' acc' : ''}`}>{LABEL[e.action]}</span>
        <span className="dim">{dateLabel(e.date)}{e.updatedAt ? ` · edited ${stampLabel(e.updatedAt)}` : ''}</span>
      </div>
      <p className="jrow-why">{e.why}</p>
      <div className="jrow-fig">
        <span><small>Then</small>{e.price !== null ? `₹${num(e.price, 2)}` : 'not written down'}</span>
        <span><small>Now</small>{q?.price != null ? <>₹{num(q.price, 2)} <span className="dim">{q.label}</span></> : loading ? 'loading…' : 'no price on file'}</span>
        <span><small>Move</small>{o.movePct !== null ? <Chg v={o.movePct} dp={1} /> : <span className="dim">{o.state === 'no-reference' ? 'needs the price then' : 'n/a'}</span>}</span>
        <span><small>R</small>{o.r !== null ? `${o.r >= 0 ? '+' : '−'}${num(Math.abs(o.r), 1)}R` : <span className="dim">{e.stop === null ? 'needs a stop' : 'n/a'}</span>}</span>
      </div>
      <p className="jrow-note">
        <span className="pill nodot">{FOLLOW_UP}</span>
        {o.state === 'below-stop' && <span className="pill bad" title="Only the price now is checked: it may have gone below earlier and come back, or the reverse.">now at or below your stop</span>}
        {o.state === 'above-target' && <span className="pill ok" title="Only the price now is checked.">now at or above your target</span>}
        {(e.stop !== null || e.target !== null) && <span className="dim">Stop {e.stop !== null ? `₹${num(e.stop, 2)}` : 'none'} · target {e.target !== null ? `₹${num(e.target, 2)}` : 'none'}; touches in between are not tracked.</span>}
      </p>
      <div className="jrow-acts">
        <button type="button" className="act quiet" onClick={onEdit}>Edit</button>
        <button type="button" className="act quiet" onClick={() => go('cards', e.sym)}>{plural(cards, 'card')}</button>
        {confirm ? (
          <span className="dcard-confirm" role="group" aria-label="Confirm delete">
            <span className="dim">Delete this entry?</span>
            <button type="button" className="act danger" onClick={onDelete}>Delete entry</button>
            <button type="button" className="act quiet" onClick={() => setConfirm(false)}>Keep it</button>
          </span>
        ) : <button type="button" className="act quiet" onClick={() => setConfirm(true)} aria-label={`Delete the ${e.sym} entry from ${dateLabel(e.date)}`}>Delete…</button>}
      </div>
    </article>
  );
}

function Money({ id, label, value, set }: { id: string; label: string; value: string; set: (v: string) => void }) {
  return <label htmlFor={id}><span>{label}</span><span className="desk-money"><i aria-hidden>₹</i><input id={id} className="field" inputMode="decimal" value={value} onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))} /></span></label>;
}

/** A new entry. A link from a signal or a company page pre-fills the company, price, stop and target (?s=&p=&sl=&t=). */
function NewEntry({ formRef, focus, onSave }: { formRef: React.RefObject<HTMLFormElement>; focus: string | null; onSave: (e: JournalEntry) => boolean }) {
  const [f, setF] = useState({ sym: '', action: 'took' as JournalAction, date: '', why: '', price: '', stop: '', target: '' });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => {
    const next = { ...f, date: localToday() };
    try {
      const q = new URLSearchParams(window.location.search);
      const s = q.get('s'); if (s && /^[A-Za-z0-9&-]{1,20}$/.test(s)) next.sym = s.toUpperCase();
      const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? String(v) : ''; };
      next.price = n('p'); next.stop = n('sl'); next.target = n('t');
    } catch { /* no query string */ }
    if (!next.sym && focus) next.sym = focus;
    setF(next);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    const made = makeEntry(f, newId());
    if ('error' in made) { setMsg({ ok: false, t: made.error }); return; }
    if (!onSave(made.entry)) { setMsg({ ok: false, t: 'Could not save in this browser (storage is blocked or full).' }); return; }
    setMsg({ ok: true, t: `Saved the ${made.entry.sym} entry in this browser.` });
    setF({ ...f, sym: '', why: '', price: '', stop: '', target: '' });
  };
  return (
    <form ref={formRef} className="note-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {f.sym ? <div className="desk-chosen"><b>{f.sym}</b><button type="button" className="act quiet" onClick={() => setF({ ...f, sym: '' })} aria-label="Change company">Change</button></div> : <QuickAdd onAdd={(s) => setF((cur) => ({ ...cur, sym: s }))} label="Pick a company…" />}
      <Segmented label="What you did" role="group" value={f.action} onChange={(a) => setF({ ...f, action: a })} options={ACTIONS.map((a) => [a, LABEL[a]] as const)} />
      <label htmlFor="jn-why"><span>Why, in your own words</span><textarea id="jn-why" className="field" rows={3} maxLength={2000} value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} placeholder="What did you see, what would make you wrong?" /></label>
      <div className="desk-fields">
        <label htmlFor="jn-date"><span>Date</span><input id="jn-date" className="field" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <Money id="jn-p" label="Price then" value={f.price} set={(v) => setF({ ...f, price: v })} />
        <Money id="jn-sl" label="Stop (optional)" value={f.stop} set={(v) => setF({ ...f, stop: v })} />
        <Money id="jn-t" label="Target (optional)" value={f.target} set={(v) => setF({ ...f, target: v })} />
      </div>
      <div className="desk-formacts"><button type="submit" className="act primary">Save entry</button></div>
      {msg && <p className={msg.ok ? 'dim desk-small' : 'desk-err'} role={msg.ok ? 'status' : 'alert'}>{msg.t}</p>}
    </form>
  );
}

function EntryEditor({ e, onSave }: { e: JournalEntry; onSave: (e: JournalEntry) => boolean }) {
  const s = (n: number | null) => (n === null ? '' : String(n));
  const [f, setF] = useState({ action: e.action, date: e.date, why: e.why, price: s(e.price), stop: s(e.stop), target: s(e.target) });
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const made = makeEntry({ ...f, sym: e.sym }, e.id);
    if ('error' in made) { setErr(made.error); return; }
    if (!onSave({ ...made.entry, updatedAt: new Date().toISOString() })) setErr('Could not save: this browser is blocking storage. Nothing was changed.');
  };
  return (
    <form className="note-form" onSubmit={(ev) => { ev.preventDefault(); save(); }}>
      <Segmented label="What you did" role="group" value={f.action} onChange={(a) => setF({ ...f, action: a })} options={ACTIONS.map((a) => [a, LABEL[a]] as const)} />
      <label htmlFor="je-why"><span>Why</span><textarea id="je-why" className="field" rows={4} maxLength={2000} value={f.why} onChange={(ev) => setF({ ...f, why: ev.target.value })} /></label>
      <div className="desk-fields">
        <label htmlFor="je-date"><span>Date</span><input id="je-date" className="field" type="date" value={f.date} onChange={(ev) => setF({ ...f, date: ev.target.value })} /></label>
        <Money id="je-p" label="Price then" value={f.price} set={(v) => setF({ ...f, price: v })} />
        <Money id="je-sl" label="Stop" value={f.stop} set={(v) => setF({ ...f, stop: v })} />
        <Money id="je-t" label="Target" value={f.target} set={(v) => setF({ ...f, target: v })} />
      </div>
      <div className="desk-formacts"><button type="submit" className="act primary">Save changes</button></div>
      {err && <p className="desk-err" role="alert">{err}</p>}
      <p className="dim desk-small">The edit date is recorded, so a later backup import keeps the newer copy of this entry.</p>
    </form>
  );
}
