'use client';
/** Discover's parts: the filter chips, the results table (and its phone layout), the scanning cards, the contextual compare
 *  bar, and the two drawers (filters, columns). The page owns the state; these only render it, so the chips, the count and
 *  the table always come from the same render (C02). */
import Link from 'next/link';
import { Fragment, useId, useState, type ReactNode } from 'react';
import { TickerLink } from '@/components/TickerLink';
import { Chg } from '@/components/ui';
import { eligibility } from '@/lib/coverage';
import { FIELD, FIELDS, FLAG_DEFS, basisText, condLabel, type Cond, type Field } from '@/lib/discover';
import { dash, num } from '@/lib/format';
import { companyHref } from '@/lib/slug';
import type { Row } from '@/lib/types';

const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const MAX_PICK = 4;

/** One active filter as a chip: its words are the operator that runs, its definition rides along (title + description). */
export interface Unit { id: string; text: string; def: string; kind: 'nl' | 'cond' | 'sector' | 'tier' | 'flag' | 'q'; off?: boolean; test: (r: Row) => boolean; drop: () => void; toggle?: () => void; edit?: () => void }

export function FilterChips({ units, onReset, onAdd }: { units: Unit[]; onReset: () => void; onAdd: () => void }) {
  const base = useId();
  return (
    <div className="dsc-chips" role="group" aria-label="Filters applied">
      {units.length === 0 && <span className="dsc-none">No filters yet: all companies are shown.</span>}
      {units.map((u, i) => {
        const did = `${base}-d${i}`;
        if (u.kind === 'nl') {
          // a clause read from the box: switch it off and on again; it stays visible while off
          return (
            <span key={u.id} className={`dsc-chip${u.off ? ' off' : ''}`}>
              <button type="button" className={`tag${u.off ? '' : ' acc'} dsc-chip-b`} aria-pressed={!u.off} title={`${u.def}${u.off ? ' Switched off by you: select to apply it again.' : ' Select to switch this clause off.'}`} aria-describedby={did} onClick={u.toggle}>
                <span>{u.text}</span><span aria-hidden className="dsc-chip-x">{u.off ? '↺' : '✕'}</span>
              </button>
              <span id={did} className="sr">{u.def}{u.off ? ' Switched off.' : ''}</span>
            </span>
          );
        }
        return (
          <span key={u.id} className="dsc-chip">
            {u.edit ? <button type="button" className="dsc-chip-b" title={`${u.def} Select to edit.`} aria-describedby={did} onClick={u.edit}>{u.text}</button> : <span className="dsc-chip-b" title={u.def}>{u.text}</span>}
            <button type="button" className="dsc-chip-rm" aria-label={`Remove ${u.text}`} aria-describedby={did} title={u.def} onClick={u.drop}><span aria-hidden>✕</span></button>
            <span id={did} className="sr">{u.def}</span>
          </span>
        );
      })}
      <button type="button" className="act quiet dsc-add" onClick={onAdd}><span aria-hidden>+</span> Add filter</button>
      {units.length > 0 && <button type="button" className="act quiet dsc-reset" onClick={onReset}>Reset all</button>}
    </div>
  );
}

const sortLabel = (f: Field) => f.short;
function SortHead({ f, sort, dir, onSort, basis, className }: { f: Field; sort: string; dir: 1 | -1; onSort: (k: string) => void; basis: string; className?: string }) {
  const on = sort === f.id;
  return (
    <th scope="col" className={className} aria-sort={on ? (dir === 1 ? 'ascending' : 'descending') : 'none'} title={`${f.label.replace(/ %$| \(₹ cr\)$/, '')}, ${basis}`}>
      <button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => onSort(f.id)}>
        {sortLabel(f)}<span className="sr">, {basis}{on ? `, sorted ${dir === 1 ? 'ascending' : 'descending'}` : ', select to sort'}</span>
        <span aria-hidden className="th-dir">{on ? (dir === 1 ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function Cell({ f, r }: { f: Field; r: Row }) {
  const v = f.get(r);
  if (!has(v)) return <span className="dim" title="Not in the feed for this company"><span aria-hidden>{dash}</span><span className="sr">not available</span></span>;
  if (f.kind === 'chg') return <Chg v={v} dp={1} suffix={f.unit === ' pts' ? ' pts' : '%'} />;
  if (f.id === 'comp') return <span className="dsc-score"><span className="dsc-bar" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span><b className="num">{f.fmt(v)}</b></span>;
  return <span className="num">{f.fmt(v)}</span>;
}

function Name({ r, signal }: { r: Row; signal: boolean }) {
  const e = eligibility(r);
  return (
    <div className="co dsc-co">
      <b><TickerLink sym={r.sym} title="Open the full page" />{signal && <span className="tag acc dsc-sig">signal</span>}</b>
      <span className="dsc-nm">{r.name}</span>
      {e && !e.ok && <span className="pill warn dsc-elig" title={e.detail}>{e.label}<span className="sr">. {e.detail}</span></span>}
    </div>
  );
}

function Pick({ r, picked, onPick }: { r: Row; picked: string[]; onPick: (s: string) => void }) {
  const on = picked.includes(r.sym);
  const full = !on && picked.length >= MAX_PICK;
  return (
    <label className="dsc-pick" onClick={(e) => e.stopPropagation()} title={full ? 'Four is the most Compare shows. Clear one to pick another.' : undefined}>
      <input type="checkbox" checked={on} disabled={full} onChange={() => onPick(r.sym)} aria-label={`Select ${r.sym} to compare`} />
    </label>
  );
}

export interface TableProps {
  rows: Row[]; cols: string[]; sort: string; dir: 1 | -1; onSort: (k: string) => void; picked: string[]; onPick: (s: string) => void;
  onPeek: (s: string) => void; sigSyms: Set<string>; close: string | null; built: string | null; live: string | null; empty: ReactNode;
}
/** The table. Desktop: the chosen columns, a sticky company column and header. Phone: company, price with the day's move and the
 *  composite score, with each row expanding on request for the rest (no twelve squeezed columns). */
export function ResultsTable({ rows, cols, sort, dir, onSort, picked, onPick, onPeek, sigSyms, close, built, live, empty }: TableProps) {
  const [open, setOpen] = useState<string | null>(null);
  const fields = cols.map((c) => FIELD.get(c)).filter((f): f is Field => !!f);
  const price = FIELD.get('price')!, comp = FIELD.get('comp')!;
  const basis = (f: Field) => basisText(f, close, built, live);
  return (
    <div className="tbl-wrap dsc-wrap" tabIndex={0} role="region" aria-label="Results table (scrolls inside this box)">
      <table className="tbl dsc-tbl">
        <thead>
          <tr>
            <th scope="col" className="dsc-coh">Company</th>
            {fields.map((f) => <SortHead key={f.id} f={f} sort={sort} dir={dir} onSort={onSort} basis={basis(f)} className="d-only" />)}
            <SortHead f={price} sort={sort} dir={dir} onSort={onSort} basis={basis(price)} className="m-only" />
            <SortHead f={comp} sort={sort} dir={dir} onSort={onSort} basis={basis(comp)} className="m-only" />
            <th scope="col" className="m-only dsc-exh"><span className="sr">More</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const x = open === r.sym;
            return (
              <Fragment key={r.sym}>
                <tr tabIndex={0} onClick={() => onPeek(r.sym)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onPeek(r.sym); }} title="Open a quick look" aria-selected={picked.includes(r.sym) || undefined}>
                  <td><div className="dsc-cell"><Pick r={r} picked={picked} onPick={onPick} /><Name r={r} signal={sigSyms.has(r.sym)} /></div></td>
                  {fields.map((f) => <td key={f.id} className="d-only"><Cell f={f} r={r} /></td>)}
                  <td className="m-only"><div className="dsc-pd"><Cell f={price} r={r} /><Cell f={FIELD.get('r1d')!} r={r} /></div></td>
                  <td className="m-only"><Cell f={comp} r={r} /></td>
                  <td className="m-only dsc-exc">
                    <button type="button" className="dsc-ex" aria-expanded={x} aria-controls={`dsc-x-${r.sym}`} aria-label={`${x ? 'Hide' : 'Show'} more figures for ${r.sym}`} onClick={(e) => { e.stopPropagation(); setOpen(x ? null : r.sym); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden style={{ transform: x ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                  </td>
                </tr>
                {x && (
                  <tr className="dsc-x m-only" id={`dsc-x-${r.sym}`}>
                    <td colSpan={4}>
                      <dl className="dsc-dl">
                        {FIELDS.filter((f) => cols.includes(f.id) && f.id !== 'price' && f.id !== 'comp' && f.id !== 'r1d').map((f) => <div key={f.id}><dt>{f.short} <span className="dim">· {basis(f)}</span></dt><dd><Cell f={f} r={r} /></dd></div>)}
                      </dl>
                      <div className="dsc-xa"><Link className="act" href={companyHref(r.sym)}>Open {r.sym}</Link><button type="button" className="act quiet" onClick={() => onPeek(r.sym)}>Quick look</button></div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && <tr className="dsc-empty"><td colSpan={fields.length + 4}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Cards: the same rows for scanning, each with its price, score and the measures in view. */
export function ResultCards({ rows, cols, picked, onPick, onPeek, sigSyms, empty }: Pick2<TableProps, 'rows' | 'cols' | 'picked' | 'onPick' | 'onPeek' | 'sigSyms' | 'empty'>) {
  if (!rows.length) return <>{empty}</>;
  const show = cols.filter((c) => c !== 'price' && c !== 'r1d' && c !== 'comp').slice(0, 4).map((c) => FIELD.get(c)).filter((f): f is Field => !!f);
  return (
    <ul className="dsc-cards" aria-label="Results as cards">
      {rows.map((r) => (
        <li key={r.sym} className={`dsc-card${picked.includes(r.sym) ? ' on' : ''}`}>
          <div className="dsc-card-top"><Pick r={r} picked={picked} onPick={onPick} /><Name r={r} signal={sigSyms.has(r.sym)} /></div>
          <div className="dsc-card-px"><Cell f={FIELD.get('price')!} r={r} /><Cell f={FIELD.get('r1d')!} r={r} /><span className="dsc-card-sc"><span className="dim">Composite</span> <Cell f={FIELD.get('comp')!} r={r} /></span></div>
          <dl className="dsc-dl">{show.map((f) => <div key={f.id}><dt>{f.short}</dt><dd><Cell f={f} r={r} /></dd></div>)}</dl>
          <button type="button" className="act quiet dsc-card-peek" onClick={() => onPeek(r.sym)}>Quick look</button>
        </li>
      ))}
    </ul>
  );
}
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };

/** Appears only when something is selected: the picks, Compare as the one primary action, and Watch. */
export function CompareBar({ picked, onDrop, onClear, onWatch, note }: { picked: string[]; onDrop: (s: string) => void; onClear: () => void; onWatch: () => void; note: string | null }) {
  if (!picked.length) return note ? <p className="dsc-note" role="status">{note}</p> : null;
  const n = picked.length;
  return (
    <div className="dsc-cbar" role="region" aria-label={`${n} selected for comparison`}>
      <div className="dsc-cbar-in">
        <span className="dsc-cbar-n"><b className="num">{n}</b> of {MAX_PICK} selected</span>
        <ul className="dsc-cbar-l">{picked.map((s) => <li key={s}><span>{s}</span><button type="button" aria-label={`Remove ${s} from the selection`} onClick={() => onDrop(s)}><span aria-hidden>✕</span></button></li>)}</ul>
        <span className="dsc-cbar-a">
          <button type="button" className="act quiet" onClick={onClear}>Clear</button>
          <button type="button" className="act" onClick={onWatch}>Watch {n}</button>
          {n >= 2 ? <Link className="act primary" href={`/compare/?s=${picked.join(',')}`}>Compare {n}</Link> : <span className="act primary dsc-dis" aria-disabled="true">Pick one more to compare</span>}
        </span>
      </div>
      {note && <p className="dsc-note" role="status">{note}</p>}
    </div>
  );
}

export interface Lens { id: string; label: string; conds: Cond[]; flags?: string[]; primary?: boolean }
/** The advanced filter editor (a drawer): measures, sector and size (with where the class comes from), screen-only flags,
 *  every preset, starting examples and saved screens. Every change applies at once, behind the drawer. */
export function FilterEditor(p: {
  conds: Cond[]; setCond: (i: number, c: Partial<Cond>) => void; addCond: () => void; dropCond: (i: number) => void;
  sector: string; sectors: string[]; setSector: (s: string) => void; tier: string; setTier: (t: string) => void; tierText: string;
  flags: string[]; toggleFlag: (f: string) => void; lenses: Lens[]; lens: string; applyLens: (l: Lens) => void; lensText: (l: Lens) => string;
  examples: string[]; templates: { name: string; q: string; why: string }[]; setAsk: (q: string) => void;
  saved: { name: string }[]; onSave: (name: string) => void; onLoad: (i: number) => void; onDelete: (i: number) => void; focusCond: number | null;
}) {
  const [name, setName] = useState('');
  return (
    <div className="dsc-ed">
      <section aria-labelledby="ed-m">
        <h3 id="ed-m">Measures</h3>
        {p.conds.length === 0 && <p className="dim">No measure filters. Add one, or start from a preset below.</p>}
        <ul className="dsc-conds">
          {p.conds.map((c, i) => (
            <li key={i}>
              <select className="field" aria-label="Measure" value={c.f} onChange={(e) => p.setCond(i, { f: e.target.value })} autoFocus={p.focusCond === i}>{FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
              <select className="field" aria-label="Comparison" value={c.op} onChange={(e) => p.setCond(i, { op: e.target.value as Cond['op'] })}><option value=">=">at least (≥)</option><option value="<=">at most (≤)</option></select>
              <input className="field" inputMode="decimal" aria-label="Value" value={c.v} onChange={(e) => p.setCond(i, { v: e.target.value.replace(/[^\d.-]/g, '') })} />
              <button type="button" className="act quiet" onClick={() => p.dropCond(i)} aria-label={`Remove ${condLabel(c)}`}>Remove</button>
              <span className="dsc-reads">Reads: <b>{c.v === '' ? 'not applied (no value)' : condLabel(c)}</b>; the boundary itself passes.</span>
            </li>
          ))}
        </ul>
        <button type="button" className="act" onClick={p.addCond}><span aria-hidden>+</span> Add a measure</button>
      </section>
      <section aria-labelledby="ed-s">
        <h3 id="ed-s">Sector and size</h3>
        <div className="dsc-two">
          <label><span>Sector</span><select className="field" value={p.sector} onChange={(e) => p.setSector(e.target.value)}><option value="">All sectors</option>{p.sectors.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span>Size class</span><select className="field" value={p.tier} onChange={(e) => p.setTier(e.target.value)}><option value="">Any size</option><option value="large">Large cap</option><option value="mid">Mid cap</option><option value="small">Small cap</option><option value="micro">Micro cap</option></select></label>
        </div>
        <p className="dsc-src">{p.tierText}</p>
      </section>
      <section aria-labelledby="ed-f">
        <h3 id="ed-f">Only companies that are…</h3>
        <ul className="dsc-flags">
          {Object.entries(FLAG_DEFS).map(([k, d]) => <li key={k}><label><input type="checkbox" checked={p.flags.includes(k)} onChange={() => p.toggleFlag(k)} /><span><b>{FLAG_LABEL[k]}</b><span className="dim">{d}</span></span></label></li>)}
        </ul>
      </section>
      <section aria-labelledby="ed-p">
        <h3 id="ed-p">All presets</h3>
        <ul className="dsc-plist">
          {p.lenses.map((l) => <li key={l.id}><button type="button" className="dsc-pitem" aria-pressed={p.lens === l.id} onClick={() => p.applyLens(l)}><b>{l.label}</b><span>{p.lensText(l)}</span></button></li>)}
        </ul>
      </section>
      <section aria-labelledby="ed-e">
        <h3 id="ed-e">Start from words</h3>
        <p className="dim">Each fills the box above; the clauses it understood appear as chips you can switch off.</p>
        <div className="dsc-exs">{p.examples.map((x) => <button key={x} type="button" className="chip chip-wrap" onClick={() => p.setAsk(x)}>{x}</button>)}</div>
        <ul className="dsc-plist">{p.templates.map((t) => <li key={t.name}><button type="button" className="dsc-pitem" onClick={() => p.setAsk(t.q)}><b>{t.name}</b><span>{t.why}</span><code>{t.q}</code></button></li>)}</ul>
      </section>
      <section aria-labelledby="ed-v">
        <h3 id="ed-v">Saved screens</h3>
        <form className="dsc-save" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { p.onSave(name.trim()); setName(''); } }}>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name this screen" aria-label="Name for this screen" />
          <button type="submit" className="act" disabled={!name.trim()}>Save this screen</button>
        </form>
        {p.saved.length === 0 ? <p className="dim">None yet. Saved in this browser only.</p> : (
          <ul className="rows">{p.saved.map((v, i) => <li key={v.name}><div className="row"><button type="button" className="row-t dsc-load" onClick={() => p.onLoad(i)}>{v.name}</button><button type="button" className="act quiet" onClick={() => p.onDelete(i)} aria-label={`Delete ${v.name}`}>Delete</button></div></li>)}</ul>
        )}
      </section>
    </div>
  );
}
export const FLAG_LABEL: Record<string, string> = { vetted: 'Vetted', ahimsa: 'In the Ahimsa 500', uptrend: 'In an uptrend', magic: 'Magic Formula top 100', signal: 'Carrying an engine signal' };

export function ColumnsEditor({ cols, toggle, reset }: { cols: string[]; toggle: (id: string) => void; reset: () => void }) {
  return (
    <div className="dsc-ed">
      <p className="dim">The table shows these on a wide screen. On a phone it shows the company, price and day, and the composite score; each row expands to the rest.</p>
      <ul className="dsc-flags dsc-colsl">
        {FIELDS.map((f) => <li key={f.id}><label><input type="checkbox" checked={cols.includes(f.id)} onChange={() => toggle(f.id)} /><span><b>{f.label.replace(/ %$| \(₹ cr\)$/, '')}</b><span className="dim">{f.basis === 'statement' ? 'latest FY on file' : f.basis === 'score' ? 'screen score' : 'price-based'}</span></span></label></li>)}
      </ul>
      <button type="button" className="act" onClick={reset}>Reset to the default columns</button>
      <p className="dim" style={{ marginTop: 12 }}>{num(cols.length)} of {num(FIELDS.length)} shown.</p>
    </div>
  );
}
