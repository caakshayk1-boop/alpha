'use client';
/** Research cards, the My Desk tab: every card saved in this browser with its question, companies, saved and edited dates,
 *  data dates, review trigger and whether it is due (lib/card.ts reviewDue: the reader's own triggers and observed changes
 *  only). Each card can be edited (question, note, "what would change my mind"), exported on its own, or deleted after a
 *  confirmation. Importing lives in the one backup (BackupBar), so a card file and a full backup take the same path. */
import Link from 'next/link';
import { useState } from 'react';
import { AskAI } from '@/components/Explain';
import { Drawer } from '@/components/company/Parts';
import { plural, stampLabel, type Go } from '@/components/desk/common';
import { cardDelta, reviewDue, serializeCard, type CardDecision, type CurrentCompany, type ResearchCard } from '@/lib/card';
import { downloadText } from '@/lib/deskStore';
import { dateLabel } from '@/lib/format';
import type { JournalEntry } from '@/lib/journal';
import { companyHref } from '@/lib/slug';

type Patch = Partial<Pick<ResearchCard, 'question' | 'note' | 'decision'>>;

export default function CardPanel({ cards, ok, current, today, focus, journal, watch, onUpdate, onRemove, go }: {
  cards: ResearchCard[]; ok: boolean; current: Record<string, CurrentCompany | undefined>; today: string; focus: string | null; journal: JournalEntry[]; watch: string[];
  onUpdate: (id: string, patch: Patch) => boolean; onRemove: (id: string) => void; go: Go;
}) {
  const [editing, setEditing] = useState<ResearchCard | null>(null);
  const shown = focus ? cards.filter((c) => c.companies.some((x) => x.sym === focus)) : cards;
  const withDue = shown.map((c) => ({ c, due: reviewDue(c, today, current) })).sort((a, b) => (b.due.length ? 1 : 0) - (a.due.length ? 1 : 0));
  const first = focus ?? watch[0] ?? null;

  return (
    <div className="desk-cards">
      {!ok && <p className="desk-err" role="alert">This browser is blocking or has corrupted local storage, so cards cannot be saved here. Importing a backup still lets you read it.</p>}
      {shown.length === 0 ? (
        <div className="state">
          <b>{focus ? `No research card mentions ${focus}.` : 'No research cards yet.'}</b>
          <p>A card keeps one question, the evidence for and against, and the data dates it was based on, so you can see later what changed. Save one from a company page under &ldquo;Your research question&rdquo;.</p>
          <div className="acts">
            {first ? <Link className="act" href={`${companyHref(first)}#notes`}>Write a question about {first}</Link> : <button type="button" className="act" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button>}
            <Link className="act quiet" href="/screen/">Ask the screen in plain English</Link>
          </div>
        </div>
      ) : (
        <ul className="desk-cardlist">
          {withDue.map(({ c, due }) => <li key={c.id}><CardItem c={c} due={due} current={current} entries={journal.filter((e) => c.companies.some((x) => x.sym === e.sym)).length} onEdit={() => setEditing(c)} onRemove={() => onRemove(c.id)} go={go} /></li>)}
        </ul>
      )}
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Edit research card">
        {editing && <CardEditor key={editing.id} card={editing} onSave={(p) => { const done = onUpdate(editing.id, p); if (done) setEditing(null); return done; }} />}
      </Drawer>
    </div>
  );
}

function trigger(c: ResearchCard, current: Record<string, CurrentCompany | undefined>): string {
  const d = c.decision;
  const parts: string[] = [];
  if (d?.reviewOn) parts.push(`on ${dateLabel(d.reviewOn.slice(0, 10))}`);
  if (d?.reviewWhen === 'results') {
    const next = c.companies.map((x) => ({ sym: x.sym, at: current[x.sym]?.nextResults ?? c.nextResults?.[x.sym] ?? null })).find((x) => x.at);
    parts.push(next?.at ? `after the next results (${next.sym} on file ${dateLabel(next.at)}, unconfirmed)` : 'after the next results (no date on file)');
  }
  return parts.length ? parts.join(' and ') : 'none set';
}

function CardItem({ c, due, current, entries, onEdit, onRemove, go }: { c: ResearchCard; due: string[]; current: Record<string, CurrentCompany | undefined>; entries: number; onEdit: () => void; onRemove: () => void; go: Go }) {
  const [confirm, setConfirm] = useState(false);
  const ch = cardDelta(c, current);
  const d = c.decision;
  const hasTrigger = !!(d?.reviewOn || d?.reviewWhen);
  const dates = c.dataStatus.filter((s) => s.asOf);
  const sym = c.companies[0]?.sym ?? null;
  return (
    <article className={`card dcard${due.length ? ' is-due' : ''}`} aria-labelledby={`card-${c.id}`}>
      <div className="dcard-h">
        <h3 id={`card-${c.id}`}>{c.question ?? 'Untitled research'}</h3>
        {due.length ? <span className="pill warn">Review due</span> : hasTrigger ? <span className="pill ok">Not due yet</span> : <span className="pill nodot">No review trigger</span>}
      </div>
      <p className="dcard-co">
        {c.companies.slice(0, 8).map((x, i) => <span key={x.sym}>{i ? ', ' : ''}<Link className="link" href={companyHref(x.sym)}>{x.sym}</Link></span>)}
        {c.companies.length > 8 ? ` +${c.companies.length - 8}` : ''}
        {!c.companies.length && <span className="dim">No company on this card</span>}
      </p>
      <dl className="dcard-kv">
        <div><dt>Saved</dt><dd>{stampLabel(c.createdAt) ?? 'date unknown'}{c.updatedAt ? <span className="dim"> · edited {stampLabel(c.updatedAt)}</span> : null}</dd></div>
        <div><dt>Data dates</dt><dd>{dates.length ? dates.map((s) => `${s.id} ${dateLabel(s.asOf)}`).join(' · ') : 'not recorded on this card'}</dd></div>
        <div><dt>Review</dt><dd>{trigger(c, current)}</dd></div>
      </dl>
      {due.length > 0 && <p className="dcard-due"><b>Due because</b> {due.join('; ')}.</p>}
      {(d?.thesis || d?.against || d?.unknowns || c.note) && (
        <dl className="dcard-words">
          {d?.thesis && <div><dt>Thesis</dt><dd>{d.thesis}</dd></div>}
          {d?.against && <div><dt>Would change my mind</dt><dd>{d.against}</dd></div>}
          {d?.unknowns && <div><dt>Unknowns</dt><dd>{d.unknowns}</dd></div>}
          {c.note && <div><dt>Note</dt><dd>{c.note}</dd></div>}
        </dl>
      )}
      <details className="dcard-more">
        <summary>Changed since saved{ch.length ? ` · ${ch.length}` : ''}{c.evidence?.length ? ` · evidence ${c.evidence.length}` : ''}</summary>
        {ch.length ? <ul className="desk-plain">{ch.map((x) => <li key={`${x.sym}-${x.what}`}><b>{x.sym}</b> · {x.what}: {x.before} → {x.after}</li>)}</ul> : <p className="dim">No saved figure changed on a newer data date.</p>}
        {c.evidence && c.evidence.length > 0 && <ul className="desk-plain">{c.evidence.slice(0, 6).map((e) => <li key={e.text}><span className={e.side === 'for' ? 'up' : 'down'}>{e.side === 'for' ? 'For' : 'Against'}</span> · {e.text} <span className="dim">({e.source})</span></li>)}</ul>}
      </details>
      <div className="dcard-acts">
        <button type="button" className="act" onClick={onEdit}>Edit</button>
        {sym && <button type="button" className="act quiet" onClick={() => go('journal', sym)}>{plural(entries, 'journal entry', 'journal entries')}</button>}
        <button type="button" className="act quiet" onClick={() => downloadText(`alpha-card-${sym ?? 'research'}-${c.createdAt.slice(0, 10)}.json`, serializeCard(c))}>Export card</button>
        {confirm ? (
          <span className="dcard-confirm" role="group" aria-label="Confirm delete">
            <span className="dim">Delete for good? Only an exported copy can bring it back.</span>
            <button type="button" className="act danger" onClick={onRemove}>Delete card</button>
            <button type="button" className="act quiet" onClick={() => setConfirm(false)}>Keep it</button>
          </span>
        ) : <button type="button" className="act quiet" onClick={() => setConfirm(true)}>Delete…</button>}
      </div>
    </article>
  );
}

/** The reader's own words on a card, in one form: the question, a note, and "what would change my mind" with its review
 *  trigger. A thesis with no disconfirming point asks for one (skippable): the countercase is first-class here too. */
function CardEditor({ card, onSave }: { card: ResearchCard; onSave: (p: Patch) => boolean }) {
  const d = card.decision;
  const [f, setF] = useState({ question: card.question ?? '', note: card.note ?? '', thesis: d?.thesis ?? '', against: d?.against ?? '', unknowns: d?.unknowns ?? '', reviewOn: d?.reviewOn?.slice(0, 10) ?? '', results: d?.reviewWhen === 'results' });
  const [msg, setMsg] = useState<string | null>(null);
  const save = () => {
    const dec: CardDecision = { thesis: f.thesis.trim().slice(0, 1000) || null, against: f.against.trim().slice(0, 1000) || null, unknowns: f.unknowns.trim().slice(0, 1000) || null, reviewOn: f.reviewOn || null, reviewWhen: f.results ? 'results' : null };
    const empty = !dec.thesis && !dec.against && !dec.unknowns && !dec.reviewOn && !dec.reviewWhen;
    const ok = onSave({ question: f.question.trim().slice(0, 300) || null, note: f.note.trim().slice(0, 4000) || null, decision: empty ? null : dec });
    if (!ok) setMsg('Could not save: this browser is blocking storage. Nothing was changed.');
  };
  const id = (k: string) => `ed-${k}-${card.id}`;
  const one = card.companies.length === 1 ? card.companies[0].sym : null;
  return (
    <form className="note-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label htmlFor={id('q')}><span>Question</span><input id={id('q')} className="field" value={f.question} maxLength={300} onChange={(e) => setF({ ...f, question: e.target.value })} /></label>
      <label htmlFor={id('t')}><span>Thesis</span><textarea id={id('t')} className="field" rows={2} value={f.thesis} onChange={(e) => setF({ ...f, thesis: e.target.value })} placeholder="What I think, in one or two sentences" /></label>
      <label htmlFor={id('a')}><span>What would change my mind</span><textarea id={id('a')} className="field" rows={2} value={f.against} onChange={(e) => setF({ ...f, against: e.target.value })} placeholder="What would show this is wrong" /></label>
      {f.thesis.trim() && !f.against.trim() && <p className="dim desk-small">Add one point that would prove this wrong. Optional, but a thesis with no counterpoint is easy to keep for the wrong reasons.</p>}
      <label htmlFor={id('u')}><span>Unknowns</span><textarea id={id('u')} className="field" rows={2} value={f.unknowns} onChange={(e) => setF({ ...f, unknowns: e.target.value })} placeholder="What the data here does not tell me" /></label>
      <fieldset>
        <legend>Look again</legend>
        <label htmlFor={id('d')} className="desk-inline"><span>On a date</span><input id={id('d')} type="date" className="field" value={f.reviewOn} onChange={(e) => setF({ ...f, reviewOn: e.target.value })} /></label>
        <label className="radio"><input type="checkbox" checked={f.results} onChange={(e) => setF({ ...f, results: e.target.checked })} /> When the next results are out</label>
      </fieldset>
      <label htmlFor={id('n')}><span>Private note</span><textarea id={id('n')} className="field" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      {one && f.thesis.trim().length >= 10 && <div><AskAI subject="thesis" sym={one} thesis={f.thesis.trim()} title="Challenge my thesis" compact /><p className="dim desk-small">Returns questions that would test it, and the data Alpha lacks; never a verdict. Asking sends the thesis text and the symbol, nothing else.</p></div>}
      <div className="desk-formacts"><button type="submit" className="act primary">Save changes</button>{msg && <span className="desk-err" role="alert">{msg}</span>}</div>
      <p className="dim desk-small">Saved in this browser only. The edit date is recorded so a later backup import keeps the newer copy.</p>
    </form>
  );
}
