'use client';
/** Discover (brief Part I §4, Screen): one ask field, one row of presets, the filters as editable chips, and one table whose
 *  count, chips and rows always come from the same render (C02). Advanced fields live in a drawer; selecting companies brings
 *  up a compare bar. Every comparison says the operator it runs (C03), every word its definition (C04), every column its
 *  basis (C05), and the size filter where its class comes from (C06). */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CompanyPeek } from '@/components/Peek';
import { Drawer, Overflow } from '@/components/company/Parts';
import { DataStamp } from '@/components/DataStamp';
import { ScreenSuggest } from '@/components/Explain';
import { ColumnsEditor, CompareBar, FLAG_LABEL, FilterChips, FilterEditor, MAX_PICK, ResultCards, ResultsTable, type Lens, type Unit } from '@/components/screen/ScreenParts';
import { PageHead } from '@/components/ui';
import { buildCard } from '@/lib/card';
import { csvProvenance, csvRow } from '@/lib/csv';
import { useFeed, useSignals } from '@/lib/data';
import { FIELD, FIELDS, FLAG_DEFS, chipText, condActive, condDef, condLabel, condTest, condsText, define, interpret, tierNote, type Cond } from '@/lib/discover';
import { dateLabel, num } from '@/lib/format';
import { useCards } from '@/lib/library';
import { fromQuery, toQuery } from '@/lib/screenUrl';
import { plural } from '@/lib/status';
import { useStoredList } from '@/lib/store';
import { TEMPLATES } from '@/lib/templates';
import type { Row } from '@/lib/types';
import { useToday } from '@/lib/useToday';

const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const DEFAULT_COLS = ['price', 'r1d', 'r1m', 'r1y', 'pe', 'roce', 'de', 'q', 'g', 'v', 'comp'];
const EXAMPLES = ['large cap IT roce above 25 low debt', 'oversold pharma profitable', 'magic formula debt below 0.5 pe under 20', 'roe > 14 and debt_to_equity < 0.5'];

type Flag = 'vetted' | 'ahimsa' | 'uptrend' | 'magic' | 'signal';
/** Presets. The first six are the one row on the page; every preset is in the filter drawer. Each one's description is built
 *  from the conditions it applies (condsText), so the words cannot drift from the rule. */
const LENSES: Lens[] = [
  { id: 'quality', label: 'Quality compounders', primary: true, conds: [{ f: 'roce', op: '>=', v: '20' }, { f: 'de', op: '<=', v: '0.5' }] },
  { id: 'value', label: 'Cheap and healthy', primary: true, conds: [{ f: 'pe', op: '<=', v: '15' }, { f: 'pe', op: '>=', v: '1' }, { f: 'roce', op: '>=', v: '15' }] },
  { id: 'growth', label: 'Fast growers', primary: true, conds: [{ f: 'rev_cagr', op: '>=', v: '15' }, { f: 'eps_cagr', op: '>=', v: '15' }] },
  { id: 'debtfree', label: 'Debt-free', primary: true, conds: [{ f: 'de', op: '<=', v: '0.1' }] },
  { id: 'income', label: 'Dividend income', primary: true, conds: [{ f: 'div_yield', op: '>=', v: '2' }] },
  { id: 'trend', label: 'In an uptrend', primary: true, conds: [], flags: ['uptrend'] },
  { id: 'cashrich', label: 'Cash earners', conds: [{ f: 'cfo_pat', op: '>=', v: '1' }, { f: 'piotroski', op: '>=', v: '7' }] },
  { id: 'cheaphist', label: 'Cheap vs its own history', conds: [{ f: 'pe_pctile', op: '<=', v: '25' }, { f: 'q', op: '>=', v: '50' }] },
  { id: 'vetted', label: 'Vetted', conds: [], flags: ['vetted'] },
  { id: 'ahimsa', label: 'Ahimsa 500', conds: [], flags: ['ahimsa'] },
  { id: 'magic', label: 'Magic Formula top 100', conds: [], flags: ['magic'] },
  { id: 'signal', label: 'Has an engine signal', conds: [], flags: ['signal'] },
];
const lensText = (l: Lens) => [condsText(l.conds), ...(l.flags ?? []).map((f) => FLAG_DEFS[f])].filter(Boolean).join('. ');

const PAGE = 60;
const FLAGS: ReadonlySet<string> = new Set<Flag>(['vetted', 'ahimsa', 'uptrend', 'magic', 'signal']);
const LENS_IDS: ReadonlySet<string> = new Set(LENSES.map((l) => l.id));
const TIERS: ReadonlySet<string> = new Set(['large', 'mid', 'small', 'micro']);
const TIER_WORD: Record<string, string> = { large: 'Large cap', mid: 'Mid cap', small: 'Small cap', micro: 'Micro cap' };
interface NlState { text: string; off: string[] }   // `off`: clauses the person switched off; nothing is ever switched off for them
interface Saved { name: string; conds: Cond[]; flags: Flag[]; sector: string; tier: string; nl?: NlState }

const flagTest = (f: string, sigSyms: Set<string>) => (r: Row): boolean => {
  if (f === 'vetted') return r.vet?.s === 'cleared';
  if (f === 'ahimsa') return !!r.ahimsa;
  if (f === 'uptrend') return has(r.price) && has(r.sma50) && has(r.sma200) && r.price > r.sma50 && r.price > r.sma200 && has(r.rs3m) && r.rs3m > 0;
  if (f === 'magic') return has(r.mf?.rank) && (r.mf?.rank as number) <= 100;
  if (f === 'signal') return sigSyms.has(r.sym);
  return true;
};

export default function Screen() {
  const s = useFeed('screen');
  const eng = useSignals();
  const { add: addCard, ok: cardsOk } = useCards();
  const [peek, setPeek] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [nl, setNl] = useState<NlState>({ text: '', off: [] });
  const [sector, setSector] = useState('');
  const [tier, setTier] = useState('');
  const [conds, setConds] = useState<Cond[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [lens, setLens] = useState('');
  const [sort, setSort] = useState('comp');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [limit, setLimit] = useState(PAGE);
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [drawer, setDrawer] = useState<null | 'filters' | 'columns'>(null);
  const [focusCond, setFocusCond] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [, , , addWatchAll, watchError] = useStoredList('alpha-watchlist');
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('alpha-screen-cols') ?? 'null'); if (Array.isArray(c) && c.length) setCols(c.filter((x: string) => FIELD.has(x)));
      const sv = JSON.parse(localStorage.getItem('alpha-screen-saved') ?? '[]'); if (Array.isArray(sv)) setSaved(sv);
    } catch { /* storage blocked or corrupt: defaults */ }
  }, []);
  // The view lives in the address: read once on arrival, then kept current with replaceState (no history entry per keystroke),
  // so refresh, Back from a company page and a shared link all restore the same filters and sort.
  const fromUrl = useRef(false);
  useEffect(() => {
    const st = fromQuery(window.location.search, { fields: FIELD, flags: FLAGS, lenses: LENS_IDS, tiers: TIERS });
    setQ(st.q); setSector(st.sector); setTier(st.tier); setConds(st.conds); setFlags(st.flags as Flag[]); setLens(st.lens); setSort(st.sort); setDir(st.dir);
    if (st.ask) setNl({ text: st.ask, off: st.off });
    fromUrl.current = true;
  }, []);
  useEffect(() => {
    if (!fromUrl.current) return;
    const next = `${window.location.pathname}${toQuery({ q, sector, tier, conds, flags, lens, sort, dir, ask: nl.text, off: nl.off })}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', next);
  }, [q, sector, tier, conds, flags, lens, sort, dir, nl]);
  const persist = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* not persisted */ } };

  // Price and Today % follow the site's one rule for "today" (lib/live.ts): while live prices describe a newer session than the
  // screen, every row carries the live price and move, so the table, the filters, the sort and the CSV read the same number.
  const asOf = s.data?.breadth.as_of ?? null;
  const builtOn = s.data?.built_on ?? null;
  const { view: tv, day } = useToday(asOf);
  const base = useMemo<Row[]>(() => {
    const list = s.data?.rows ?? [];
    if (!tv.live) return list;
    return list.map((r) => { const price = tv.price(r.sym, r.price); return { ...r, price, r1d: tv.pct(r.sym, r.r1d), last_date: price === null ? r.last_date : tv.session ?? r.last_date }; });
  }, [s.data, tv]);
  const liveCol = (c: string) => tv.live && (c === 'price' || c === 'r1d');
  const sectors = useMemo(() => Array.from(new Set((s.data?.rows ?? []).map((r) => r.sector).filter(Boolean))).sort(), [s.data]);
  const sigSyms = useMemo(() => new Set((eng.data?.signals ?? []).map((x) => x.sym)), [eng.data]);
  const tiers = useMemo(() => tierNote(s.data?.rows ?? [], builtOn), [s.data, builtOn]);

  // C02: typing is deferred as ONE value. The chips, the count and the table all read the deferred text, so they change
  // together; while a newer text is being applied the results are marked "Updating" (aria-busy), never half-updated.
  const askText = useDeferredValue(nl.text);
  const findText = useDeferredValue(q);
  const busy = askText !== nl.text || findText !== q;
  const reading = useMemo(() => interpret(askText), [askText]);

  const clearLens = () => setLens('');
  const units = useMemo<Unit[]>(() => {
    const u: Unit[] = [];
    for (const f of reading.filters) {
      const off = nl.off.includes(f.label);
      u.push({ id: `nl:${f.label}`, kind: 'nl', text: chipText(f.label), def: define(f.label, f.note), off, test: f.test, drop: () => {}, toggle: () => setNl((v) => ({ ...v, off: off ? v.off.filter((x) => x !== f.label) : [...v.off, f.label] })) });
    }
    if (findText.trim()) { const t = findText.trim().toLowerCase(); u.push({ id: 'q', kind: 'q', text: `Name or symbol: “${findText.trim()}”`, def: 'Companies whose name or symbol contains these letters.', test: (r) => r.sym.toLowerCase().includes(t) || r.name.toLowerCase().includes(t), drop: () => setQ('') }); }
    if (sector) u.push({ id: 'sector', kind: 'sector', text: sector, def: `Sector: ${sector}, as the screen feed records it.`, test: (r) => r.sector === sector, drop: () => setSector(''), edit: () => setDrawer('filters') });
    if (tier) u.push({ id: 'tier', kind: 'tier', text: TIER_WORD[tier] ?? tier, def: tiers.text, test: (r) => r.tier === tier, drop: () => setTier(''), edit: () => setDrawer('filters') });
    conds.forEach((c, i) => { if (condActive(c)) u.push({ id: `c${i}`, kind: 'cond', text: condLabel(c), def: condDef(c), test: condTest(c), drop: () => { clearLens(); setConds((x) => x.filter((_, k) => k !== i)); }, edit: () => { setFocusCond(i); setDrawer('filters'); } }); });
    for (const f of flags) u.push({ id: `f:${f}`, kind: 'flag', text: FLAG_LABEL[f] ?? f, def: FLAG_DEFS[f] ?? f, test: flagTest(f, sigSyms), drop: () => { clearLens(); setFlags((x) => x.filter((y) => y !== f)); }, edit: () => setDrawer('filters') });
    return u;
  }, [reading, nl.off, findText, sector, tier, conds, flags, sigSyms, tiers.text]);
  const live = useMemo(() => units.filter((u) => !u.off), [units]);

  const rows = useMemo(() => {
    const list = base.filter((r) => live.every((u) => u.test(r)));
    const g = FIELD.get(sort)?.get;
    return list.sort((a, b) => {
      const av = g ? g(a) : null, bv = g ? g(b) : null;
      if (!has(av) && !has(bv)) return 0;
      if (!has(av)) return 1;                           // missing values sort last whichever way
      if (!has(bv)) return -1;
      return (av - bv) * dir;
    });
  }, [base, live, sort, dir]);
  // with nothing left: what each single filter costs, so the person decides which to give up (nothing is loosened for them)
  const costs = useMemo(() => (rows.length === 0 && live.length > 1 ? live.map((u) => ({ u, n: base.filter((r) => live.every((w) => w === u || w.test(r))).length })).sort((a, b) => b.n - a.n).slice(0, 4) : []), [rows.length, live, base]);
  // companies a clause cannot be read for are excluded from it, not counted as failing it
  const missing = useMemo(() => live.filter((u) => u.kind === 'cond').map((u) => { const c = conds[Number(u.id.slice(1))]; const g = FIELD.get(c.f)?.get; const n = g ? base.filter((r) => !has(g(r))).length : 0; return n ? `${FIELD.get(c.f)?.short}: ${plural(n, 'company', 'companies')} with no value cannot pass` : null; }).filter((x): x is string => !!x), [live, conds, base]);

  const key = live.map((u) => u.id).join('|');
  useEffect(() => { setLimit(PAGE); }, [key, sort, dir]);

  const applyLens = (l: Lens) => {
    if (lens === l.id) { setLens(''); setConds([]); setFlags([]); return; }
    setLens(l.id); setConds(l.conds.map((c) => ({ ...c }))); setFlags((l.flags ?? []) as Flag[]);
  };
  const setSortKey = (k: string) => { if (k === sort) setDir((d) => (d === 1 ? -1 : 1)); else { setSort(k); setDir(k === 'pe' || k === 'de' || k === 'pb' ? 1 : -1); } };
  const updateCond = (i: number, patch: Partial<Cond>) => { setLens(''); setConds((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x))); };
  const addCond = () => { setLens(''); setFocusCond(conds.length); setConds((c) => [...c, { f: 'roce', op: '>=', v: '15' }]); setDrawer('filters'); };
  const resetAll = () => { setConds([]); setFlags([]); setLens(''); setSector(''); setTier(''); setQ(''); setNl({ text: '', off: [] }); };
  const toggleCol = (id: string) => { const next = cols.includes(id) ? cols.filter((x) => x !== id) : [...cols, id]; const ordered = FIELDS.map((f) => f.id).filter((x) => next.includes(x)); setCols(ordered); persist('alpha-screen-cols', ordered); };
  const pick = (sym: string) => { setNote(''); setPicked((p) => (p.includes(sym) ? p.filter((x) => x !== sym) : p.length < MAX_PICK ? [...p, sym] : p)); };
  const setViewP = (v: 'table' | 'cards') => setView(v);
  const save = (name: string) => { const next = [...saved.filter((x) => x.name !== name), { name, conds, flags, sector, tier, nl }]; setSaved(next); persist('alpha-screen-saved', next); };
  const load = (v: Saved) => { setConds(v.conds); setFlags(v.flags); setSector(v.sector); setTier(v.tier); setNl(v.nl ?? { text: '', off: [] }); setLens(''); setDrawer(null); };
  const csv = () => {
    // the displayed values, plus where they came from: live price and move carry their time, everything else the screen's date
    const stamp = tv.live ? `price and today: ${tv.asOf}; other columns: close ${asOf ?? 'unknown'}` : `close ${asOf ?? 'unknown'}`;
    const head = ['symbol', 'name', 'sector', ...cols.map((c) => (FIELD.get(c)?.label ?? c) + (liveCol(c) ? ` (${tv.tag} IST)` : '')), 'as_of'];
    const lines = [...csvProvenance('alpha.askakshay.com screen (company filings via Yahoo Finance; prices from NSE via Yahoo)', stamp), csvRow(head), ...rows.map((r) => csvRow([r.sym, r.name, r.sector, ...cols.map((c) => { const v = FIELD.get(c)?.get(r); return has(v) ? v : null; }), stamp]))];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'alpha-screen.csv'; a.click();
  };
  const [cardMsg, setCardMsg] = useState('');
  const saveCard = () => {
    const applied = live.map((u) => u.text);
    const ok = addCard(buildCard({ question: nl.text.trim() || `Screen: ${applied.join(', ')}`, query: { text: nl.text.trim() || null, applied, ignored: [...reading.unknown, ...nl.off.map((o) => `switched off: ${o}`)], matches: rows.length }, companies: rows.slice(0, 25).map((r) => ({ sym: r.sym, name: r.name, price: has(r.price) ? r.price : null, priceAsOf: r.last_date ?? null })) }));
    setCardMsg(ok ? 'Saved to My Desk, in this browser.' : 'Could not save: browser storage is blocked or full.');
  };
  useEffect(() => { setCardMsg(''); }, [key]);

  const activeLens = LENSES.find((l) => l.id === lens);
  const total = s.data?.rows.length ?? 0;
  const empty = (
    <div className="state dsc-state">
      <b>No company matches {live.length === 1 ? 'this filter' : `all ${live.length} filters`}.</b>
      <p>Nothing has been loosened for you.{costs.length ? ' Remove one filter and see what is left:' : ' Check the number, or reset and start from a preset.'}</p>
      <div className="acts">
        {costs.map(({ u, n }) => <button key={u.id} type="button" className="act" onClick={u.kind === 'nl' ? u.toggle : u.drop}>Drop “{u.text}” → {plural(n, 'match', 'matches')}</button>)}
        <button type="button" className="act quiet" onClick={resetAll}>Reset all filters</button>
      </div>
    </div>
  );
  const watch = () => { const n = picked.length; if (addWatchAll(picked)) { setNote(`${n} added to your watchlist, saved in this browser.`); setPicked([]); } };

  return (
    <>
      <PageHead method="screen" eyebrow={`Discover · ${s.data ? num(s.data.count) : 'Indian'} companies`} title="Find companies" em="that match your criteria." />
      <section className="wrap wide dsc">
        <div className="dsc-stamp"><DataStamp ids={['screen']} /></div>
        <form className="dsc-ask" role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="nlq" className="sr">Ask in plain English or the query language</label>
          <svg className="dsc-ask-i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="nlq" className="dsc-ask-f" value={nl.text} onChange={(e) => setNl({ text: e.target.value, off: [] })} placeholder="Describe what you want, e.g. large cap IT roce above 25 low debt" spellCheck={false} autoComplete="off" />
          {nl.text && <button type="button" className="act quiet dsc-ask-x" onClick={() => setNl({ text: '', off: [] })} aria-label="Clear the question">Clear</button>}
          <button type="button" className="act dsc-ask-more" onClick={() => setDrawer('filters')} aria-haspopup="dialog">Filters{live.filter((u) => u.kind !== 'nl').length ? <span className="dsc-n num">{live.filter((u) => u.kind !== 'nl').length}</span> : null}</button>
        </form>

        <div className="dsc-presets" role="group" aria-label="Presets">
          {LENSES.filter((l) => l.primary).map((l) => <button key={l.id} type="button" className="dsc-preset" aria-pressed={lens === l.id} title={lensText(l)} onClick={() => applyLens(l)}>{l.label}</button>)}
          <button type="button" className="dsc-preset more" onClick={() => setDrawer('filters')}>More presets</button>
        </div>

        <FilterChips units={units} onReset={resetAll} onAdd={addCond} />
        {(reading.error || reading.unknown.length > 0 || (reading.isQuery && !reading.error) || missing.length > 0 || activeLens) && (
          <div className="dsc-notes">
            {activeLens && <p><b>{activeLens.label}:</b> {lensText(activeLens)}.</p>}
            {reading.error && <div className="notice warn" role="alert"><b>The query could not be read.</b> {reading.error.message}<pre className="q-caret" aria-hidden>{askText}{'\n'}{' '.repeat(Math.max(0, reading.error.at))}^</pre></div>}
            {reading.isQuery && !reading.error && <p className="dim">Read as a query: and, or, not and brackets combine clauses; &gt; and &lt; are strict, &gt;= and &lt;= include the number.</p>}
            {reading.unknown.length > 0 && <p><span className="pill warn nodot">Ignored</span> {reading.unknown.map((w) => <span key={w} className="tag warn">{w}</span>)} <span className="dim">These words were not turned into a filter, so they did not change the results.</span></p>}
            {!reading.isQuery && reading.unknown.length > 0 && <ScreenSuggest text={askText} words={reading.unknown} onAccept={(x) => setNl({ text: x, off: [] })} />}
            {missing.length > 0 && <p className="dim">{missing.join(' · ')}.</p>}
          </div>
        )}

        <div className="dsc-res">
          <div className="dsc-res-l" aria-live="polite">
            <p className="dsc-count"><b className="num">{num(rows.length)}</b> match{rows.length === 1 ? '' : 'es'}{s.data ? ` of ${num(total)}` : ''}{busy && <span className="pill acc dsc-upd">Updating…</span>}</p>
            <details className="universe-note">
              <summary>Which companies?</summary>
              <p>The universe is the {s.data ? num(total) : ''} NSE-listed companies in the screen as built on {builtOn ? dateLabel(builtOn) : 'its last build'}: today&apos;s listed names only, so companies that were delisted, merged or suspended are not in it and results describe survivors. A company with no value for a measure cannot pass a filter on it and is not counted as failing. {tiers.text}</p>
            </details>
          </div>
          <div className="dsc-res-r">
            <input className="field dsc-find" type="search" placeholder="Name or symbol" aria-label="Find a company by name or symbol" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="dsc-view" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'table'} onClick={() => setViewP('table')}>Table</button>
              <button type="button" aria-pressed={view === 'cards'} onClick={() => setViewP('cards')}>Cards</button>
            </div>
            <button type="button" className="act quiet hide-mob" onClick={() => setDrawer('columns')}>Columns</button>
            {live.length > 0 && rows.length > 0 && <button type="button" className="act quiet" disabled={!cardsOk} onClick={saveCard} title="Saved in this browser only">Save as research card</button>}
            <Overflow label="More screen actions">
              <button type="button" onClick={csv}>Download CSV</button>
              <button type="button" onClick={() => setDrawer('columns')}>Choose columns</button>
              <button type="button" onClick={() => setDrawer('filters')}>Save this screen</button>
            </Overflow>
          </div>
        </div>
        {cardMsg && <p className="dsc-note" role="status">{cardMsg}</p>}

        {s.loading ? (
          <div className="state dsc-state" role="status" aria-busy="true"><b>Loading the screen…</b><p>Nearly 1,000 companies with their figures; this can take a few seconds on a slow connection.</p></div>
        ) : s.error ? (
          <div className="state dsc-state" role="alert"><b>The screen could not be loaded.</b><p>{s.error}. It is read live, so trying again usually fixes it. Nothing is shown in its place.</p><div className="acts"><button type="button" className="act primary" onClick={() => window.location.reload()}>Try again</button></div></div>
        ) : (
          <div className={`dsc-out${busy ? ' busy' : ''}`} aria-busy={busy}>
            <p className="dsc-basis">Prices and price ratios at the {asOf ? dateLabel(asOf) : 'latest'} close{tv.live ? `; price and today live ${tv.at} IST${day?.stale ? ` (${day.stale} with no trade today show a dash)` : ''}` : ''}. ROCE, ROE, debt/equity, CAGRs and cash conversion from each company&apos;s latest fiscal year on file. Scores from the screen build of {builtOn ? dateLabel(builtOn) : 'its last build'}. A dash means not in the feed, never zero.</p>
            {view === 'table'
              ? <ResultsTable rows={rows.slice(0, limit)} cols={cols} sort={sort} dir={dir} onSort={setSortKey} picked={picked} onPick={pick} onPeek={setPeek} sigSyms={sigSyms} close={asOf} built={builtOn} live={tv.live ? tv.at : null} empty={empty} />
              : <ResultCards rows={rows.slice(0, limit)} cols={cols} picked={picked} onPick={pick} onPeek={setPeek} sigSyms={sigSyms} empty={empty} />}
            {limit < rows.length && <div className="dsc-more"><button type="button" className="act" onClick={() => setLimit((n) => n + PAGE * 2)}>Show {num(Math.min(PAGE * 2, rows.length - limit))} more <span className="dim">({num(rows.length - limit)} left)</span></button></div>}
          </div>
        )}
        <CompareBar picked={picked} onDrop={pick} onClear={() => setPicked([])} onWatch={watch} note={watchError ?? (note || null)} />
      </section>

      <Drawer open={drawer === 'filters'} onClose={() => { setDrawer(null); setFocusCond(null); }} title="Filters">
        <FilterEditor conds={conds} setCond={updateCond} addCond={addCond} dropCond={(i) => { setLens(''); setConds((x) => x.filter((_, k) => k !== i)); }}
          sector={sector} sectors={sectors} setSector={setSector} tier={tier} setTier={setTier} tierText={tiers.text}
          flags={flags} toggleFlag={(f) => { setLens(''); setFlags((x) => (x.includes(f as Flag) ? x.filter((y) => y !== f) : [...x, f as Flag])); }}
          lenses={LENSES} lens={lens} applyLens={applyLens} lensText={lensText}
          examples={EXAMPLES} templates={TEMPLATES} setAsk={(x) => { setNl({ text: x, off: [] }); setDrawer(null); }}
          saved={saved} onSave={save} onLoad={(i) => load(saved[i])} onDelete={(i) => { const n = saved.filter((_, k) => k !== i); setSaved(n); persist('alpha-screen-saved', n); }} focusCond={focusCond} />
        <div className="dsc-ed-foot"><button type="button" className="act primary" onClick={() => setDrawer(null)}>Show {plural(rows.length, 'match', 'matches')}</button><button type="button" className="act quiet" onClick={resetAll}>Reset all</button></div>
      </Drawer>
      <Drawer open={drawer === 'columns'} onClose={() => setDrawer(null)} title="Columns">
        <ColumnsEditor cols={cols} toggle={toggleCol} reset={() => { setCols(DEFAULT_COLS); persist('alpha-screen-cols', DEFAULT_COLS); }} />
      </Drawer>
      <CompanyPeek sym={peek} onClose={() => setPeek(null)} />
    </>
  );
}
