import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKey } from 'react';
import { go, isQuiet, replaceHash, setState, useAppState, useLoc, wantsRestore } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Icon, Sheet, useUi, Empty } from '../ui.tsx';
import { FollowButton, Head, Failed, Loading, PageBar, TrendTag } from './common.tsx';
import { NO_FILTER, describeFilters, filterRows, TREND_WORD, type Filters, type Row } from '../screen.ts';
import { saveScreen } from '../store.ts';
import { livePrice, useQuotes, useWatchQuotes } from '../quotes.ts';
import { dayWord, initials, inr, pct, tone } from '../fmt.ts';
import { askInWords, ASK_EXAMPLES } from '../ask.ts';
import { avatarStyle } from '../widgets.tsx';
import { plural } from '../plural.ts';
import { COLUMN_SETS, METRICS, coverage, describeCond, fmtMetric, metricOf, sameCond, toCsv, type Cond, type MetricKey, type SortId } from '../screener.ts';
import { CondSheet } from './condsheet.tsx';
import { DEFAULT_STATE, MAX_PICK, PAGE, canonConds, cellOf, clearFilters, discoverPath, displayRow, filtersOf, hasAnyFilter, isDefaultSort, lastDiscoverQuery, loadPlace, nextSort, parseDiscover, predicateMetrics, rememberDiscover, revealed, runScreen, sameDiscover, savePlace, serialiseDiscover, setFigure, sortName, sortWords, withFilters, type DiscoverState, type View } from '../discoverstate.ts';
export { CondSheet } from './condsheet.tsx';

/** One tap, one idea: each lens is a fixed combination of the screen's own filters, with the number of names that pass it today. */
const LENSES: { id: string; title: string; line: string; f: Partial<Filters>; c: string }[] = [
  { id: 'leaders', title: 'Leaders', line: 'Uptrend and ahead of the Nifty', f: { trend: 'up', momentum: 'strong' }, c: 'var(--up)' },
  { id: 'quality', title: 'Quality, fair price', line: 'ROCE 20%+ and PE 15 or less', f: { quality: 'high', value: 'cheap' }, c: 'var(--a3)' },
  { id: 'highs', title: 'Near highs', line: 'Within 5% of the 52-week high', f: { momentum: 'near-high' }, c: 'var(--a4)' },
  { id: 'cheap', title: 'Cheap', line: 'PE 15 or less', f: { value: 'cheap' }, c: 'var(--a2)' },
  { id: 'weak', title: 'Under pressure', line: 'In a downtrend', f: { trend: 'down' }, c: 'var(--down)' },
];
/** The figures offered in the Filters sheet, by what they answer. Every one goes through the condition model (the same sheet the table's funnels open). */
const FIGURES: { title: string; ids: MetricKey[] }[] = [
  { title: 'Price and trading', ids: ['price', 'turnover_cr', 'vol_spike', 'r1d', 'r1m', 'r3m'] },
  { title: 'Momentum', ids: ['rsi', 'rsi_w', 'rsi_m', 'from_high', 'rs3m', 'dist50', 'dist200'] },
  { title: 'Valuation', ids: ['pe', 'pb', 'pe_pctile'] },
  { title: 'Growth and quality', ids: ['rev_cagr', 'eps_cagr', 'roce_med', 'roe', 'net_margin', 'piotroski'] },
  { title: 'Balance sheet and cash', ids: ['de', 'icover', 'cfo_pat', 'fcf_margin'] },
];
const QUICK_SORTS: SortId[] = ['name', 'sym', 'r1d', 'rs3m', 'roce_med', 'pe', 'from_high', 'turnover_cr'];
const FIN = 'Financial Services';
const KIND_C: Record<string, string> = { sector: 'var(--a6)', tier: 'var(--a6)', value: 'var(--a2)', quality: 'var(--a3)', trend: 'var(--up)', momentum: 'var(--a4)', c: 'var(--lime)' };
const symSel = (s: string) => `[data-sym="${s.replace(/["\\]/g, '')}"]`;

export function Discover() {
  const scr = useScreen(); const app = useAppState(); const { toast, tick } = useUi(); const loc = useLoc();
  const [init] = useState(() => parseDiscover(loc.q));
  const [st, setSt] = useState<DiscoverState>(init.state); const [ignored, setIgnored] = useState<string[]>(init.ignored);
  const stRef = useRef(st); stRef.current = st;
  const [restore] = useState(() => wantsRestore(loc.raw)); const place = useRef(restore ? loadPlace(serialiseDiscover(init.state)) : null);
  const [selected, setSelected] = useState(place.current?.at ?? ''); const selRef = useRef(selected); selRef.current = selected;
  const patch = useCallback((p: Partial<DiscoverState>, keepPage = false) => setSt((x) => ({ ...x, ...(keepPage ? {} : { show: PAGE }), ...p })), []);
  const [sheet, setSheet] = useState<'' | 'filters' | 'columns'>(''); const [figure, setFigureM] = useState<{ m: MetricKey; back: boolean } | null>(null);
  const rows = scr.data?.rows ?? [];
  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector).filter(Boolean) as string[])].sort(), [rows]);
  // a sector in a link that the screen does not have is dropped and said so, not shown as an empty page
  useEffect(() => { if (sectors.length && stRef.current.sector && !sectors.includes(stRef.current.sector)) { setIgnored((i) => [...i, `sector=${stRef.current.sector}`]); setSt((x) => ({ ...x, sector: '' })); } }, [sectors]);

  /* ---- the URL: rewritten in place as the state changes (no history entry), read back when someone else changes it ---- */
  const qs = serialiseDiscover(st); const lastQs = useRef(qs);
  const flush = useCallback(() => { const q = serialiseDiscover(stRef.current); lastQs.current = q; replaceHash(discoverPath(stRef.current)); rememberDiscover(q); }, []);
  useEffect(() => { const t = window.setTimeout(flush, 150); return () => window.clearTimeout(t); }, [qs, flush]);
  useEffect(() => { if (loc.path[0] !== 'discover' || isQuiet(loc.raw)) return; const p = parseDiscover(loc.q); if (!sameDiscover(p.state, stRef.current)) { setSt(p.state); setIgnored(p.ignored); } }, [loc.raw, loc.path, loc.q]);

  /* ---- the one pipeline both views read ---- */
  const dst = useDeferredValue(st); const run = useMemo(() => runScreen(rows, dst), [rows, dst]);
  const shown = useMemo(() => revealed(run, dst), [run, dst]); const pm = useMemo(() => predicateMetrics(dst), [dst]);
  const cols = (COLUMN_SETS.find((c) => c.id === st.cols) ?? COLUMN_SETS[0]).cols;
  useWatchQuotes(shown.map((r) => r.sym)); const quotes = useQuotes(shown.map((r) => r.sym));
  const disp = (r: Row) => displayRow(r, livePrice(r, quotes[r.sym] ?? null));
  const anyLive = shown.some((r) => disp(r).live);
  const active = describeFilters(filtersOf(st)); const total = rows.length; const stale = dst !== st;
  const asOf = scr.data?.as_of ?? null;

  /* ---- coming back: the scroll position and the company last opened ---- */
  const wrapRef = useRef<HTMLDivElement>(null); const restored = useRef(false);
  useLayoutEffect(() => {
    if (!scr.data || restored.current) return; restored.current = true; const p = place.current; if (!p) return;
    window.scrollTo(0, p.y); const w = wrapRef.current; if (w) { w.scrollLeft = p.tx ?? 0; w.scrollTop = p.ty ?? 0; }
    if (p.at) { const a = document.querySelector<HTMLElement>(`${symSel(p.at)} a`); if (a) { a.focus({ preventScroll: true }); if (p.y === 0) a.scrollIntoView({ block: 'center' }); } }
  }, [scr.data]);
  const remember = useCallback(() => { const w = wrapRef.current; savePlace(serialiseDiscover(stRef.current), { y: Math.round(window.scrollY), at: selRef.current, tx: w ? Math.round(w.scrollLeft) : undefined, ty: w ? Math.round(w.scrollTop) : undefined }); }, []);
  useEffect(() => { let t = 0; const f = () => { window.clearTimeout(t); t = window.setTimeout(remember, 120); }; window.addEventListener('scroll', f, { passive: true }); return () => { window.removeEventListener('scroll', f); window.clearTimeout(t); }; }, [remember]);
  // opening a company is a real history entry (a plain link); before it goes, the URL is made current and the place and the company are written down
  const onOpen = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest<HTMLElement>('a[href^="#/c/"]'); if (!el) return; const row = el.closest<HTMLElement>('[data-sym]'); if (row?.dataset.sym) { selRef.current = row.dataset.sym; setSelected(row.dataset.sym); } flush(); remember(); };

  /* ---- table scroll affordance ---- */
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => { const w = wrapRef.current; if (!w) return; const l = w.scrollLeft > 4, r = w.scrollLeft + w.clientWidth < w.scrollWidth - 4; setEdge((e) => (e.l === l && e.r === r ? e : { l, r })); }, []);
  useEffect(() => { measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [measure, st.view, st.cols, shown.length]);

  const toggleSet = <K extends 'trend' | 'quality' | 'momentum' | 'value' | 'sector' | 'tier'>(k: K, v: DiscoverState[K]) => patch({ [k]: st[k] === v ? '' : v } as Partial<DiscoverState>);
  const lensOn = (l: (typeof LENSES)[number]) => (Object.entries(l.f) as [keyof Filters, string][]).every(([k, v]) => (filtersOf(st)[k] ?? '') === v);
  const [advOpen, setAdvOpen] = useState(false);
  // the idea cards count their names only once Advanced is open: five filter passes over the screen are not paid on every visit
  const counts = useMemo(() => Object.fromEntries(LENSES.map((l) => [l.id, rows.length && advOpen ? filterRows(rows, { ...NO_FILTER, ...l.f }).rows.length : null])) as Record<string, number | null>, [rows, advOpen]);
  const applyLens = (l: (typeof LENSES)[number]) => { if (lensOn(l)) patch(Object.fromEntries(Object.keys(l.f).map((k) => [k, ''])) as Partial<DiscoverState>); else patch({ trend: '', momentum: '', value: '', quality: '', ...l.f } as Partial<DiscoverState>); tick(); };
  const togglePick = (sym: string) => { setSt((x) => ({ ...x, pick: x.pick.includes(sym) ? x.pick.filter((s) => s !== sym) : x.pick.length < MAX_PICK ? [...x.pick, sym] : x.pick })); tick(); };
  const blocked = useCallback((m: MetricKey) => (metricOf(m)?.elig && st.sector === FIN ? 'Not defined for the financial sector, and a sector filter is on it: every name here has no figure, so nothing can match.' : null), [st.sector]);
  const countWith = (cs: Cond[]) => runScreen(rows, setFigure(st, cs[0]?.m ?? 'rsi', cs)).ordered.length;
  const exportCsv = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCsv(run.ordered, cols)], { type: 'text/csv' })); a.download = `tripwire-screen-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast(`${plural(run.ordered.length, 'row')} exported`); };
  const [ask, setAsk] = useState(''); const [unread, setUnread] = useState<string[]>([]);
  const runAsk = () => { const a = askInWords(ask); setUnread(a.unread); if (a.conds.length) { patch({ cond: canonConds([...st.cond.filter((x) => !a.conds.some((c) => c.m === x.m && c.op === x.op)), ...a.conds]) }); setAsk(''); } };

  const chips: { k: string; label: string; off: () => void }[] = [
    ...(st.sector ? [{ k: 'sector', label: st.sector, off: () => patch({ sector: '' }) }] : []), ...(st.tier ? [{ k: 'tier', label: `${st.tier} cap`, off: () => patch({ tier: '' }) }] : []),
    ...(st.trend ? [{ k: 'trend', label: TREND_WORD[st.trend], off: () => patch({ trend: '' }) }] : []),
    ...(st.value ? [{ k: 'value', label: st.value === 'cheap' ? 'PE 15 or less' : 'PE 40 or more', off: () => patch({ value: '' }) }] : []), ...(st.quality ? [{ k: 'quality', label: 'ROCE 20%+', off: () => patch({ quality: '' }) }] : []),
    ...(st.momentum ? [{ k: 'momentum', label: st.momentum === 'strong' ? 'Ahead of Nifty' : st.momentum === 'weak' ? 'Behind Nifty' : 'Near 52w high', off: () => patch({ momentum: '' }) }] : []),
  ];
  const clearAll = () => { setSt(clearFilters); setUnread([]); tick(); };
  const sortLine = `Sorted by ${sortWords(st.sort)}${isDefaultSort(st.sort) ? ' (the default)' : ''}`;
  const noFig = run.unmeasured + run.notApplicable;

  return <div className="disc" onClickCapture={onOpen}>
    <PageBar title="Discover" sub={scr.data ? <>{plural(scr.data.count, 'company', 'companies')} in the published screen · <a href="#/data" style={{ textDecoration: 'underline' }}>coverage</a></> : undefined} />
    {ignored.length > 0 && <p className="small mute" role="status" style={{ margin: '0 0 6px' }}>Left out of the link, not understood: {ignored.slice(0, 4).join(', ')}.</p>}

    <div className="dtool" role="group" aria-label="Search, filters, sort, columns and view">
      <div className="search dsearch"><Icon n="search" /><input className="field" type="search" placeholder="Company or symbol" value={st.q} onChange={(e) => patch({ q: e.target.value })} aria-label="Search companies" autoComplete="off" /></div>
      <button className="chip dbtn" onClick={() => setSheet('filters')} aria-haspopup="dialog"><Icon n="filter" className="" />Filters{active.length ? ` · ${active.length}` : ''}</button>
      <div className="dsort">
        <label className="sr" htmlFor="d-sort">Sort by</label>
        <select id="d-sort" className="field" value={st.sort.key} onChange={(e) => patch({ sort: nextSort({ key: 'x' as SortId, dir: 'asc' }, e.target.value as SortId) })} aria-label="Sort by">
          <optgroup label="Common">{QUICK_SORTS.map((k) => <option key={k} value={k}>{sortName(k)}</option>)}</optgroup>
          <optgroup label="More figures">{METRICS.filter((m) => !QUICK_SORTS.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>
        </select>
        <button className="chip dir" onClick={() => patch({ sort: { key: st.sort.key, dir: st.sort.dir === 'asc' ? 'desc' : 'asc' } })}><span aria-hidden="true">{st.sort.key === 'name' || st.sort.key === 'sym' ? (st.sort.dir === 'asc' ? 'A–Z' : 'Z–A') : st.sort.dir === 'asc' ? '↑ Low' : '↓ High'}</span><span className="sr">{`Sort direction: ${sortWords(st.sort)}. Tap to reverse.`}</span></button>
      </div>
      <button className="chip dbtn" onClick={() => setSheet('columns')} aria-haspopup="dialog">Columns</button>
      <Radios label="View" value={st.view} onChange={(v) => patch({ view: v as View }, true)} items={[{ id: 'list', label: 'List' }, { id: 'table', label: 'Table' }]} />
    </div>

    <div className="chips chosen dchips" role="group" aria-label="Active filters">
      {chips.map((c) => <button key={c.k} className="chip cc on-x" style={{ '--cc': KIND_C[c.k] } as React.CSSProperties} onClick={c.off} aria-label={`Remove filter: ${c.label}`}>{c.label}<span aria-hidden="true">×</span></button>)}
      {st.cond.map((c) => <button key={`${c.m}${c.op}${c.v}${c.unk ? 1 : 0}`} className="chip cc on-x" onClick={() => patch({ cond: st.cond.filter((x) => !sameCond(x, c)) })} aria-label={`Remove condition: ${describeCond(c)}`}>{describeCond(c)} <span aria-hidden="true">×</span></button>)}
      <button className="chip" onClick={() => setFigureM({ m: 'rsi', back: false })}>+ Condition</button>
      {hasAnyFilter(st) && <button className="chip" onClick={clearAll}>Clear all</button>}
    </div>

    <details className="adv" onToggle={(e) => setAdvOpen(e.currentTarget.open)}>
      <summary>Advanced</summary>
      <div className="advbody">
        <div className="strip lenses" role="group" aria-label="Ideas">{LENSES.map((l) => { const on = lensOn(l); const n = counts[l.id];
          return <button key={l.id} className={`lens ${on ? 'on' : ''}`} style={{ '--lc': l.c } as React.CSSProperties} aria-pressed={on} onClick={() => applyLens(l)} title={l.line}>
            <span className="lt">{l.title}</span><span className="ln num">{n == null ? '…' : n}<small> names</small></span><span className="ll">{l.line}</span></button>; })}</div>
        <div className="chips" role="group" aria-label="Quick filters" style={{ marginTop: 8 }}>
          {app.prefs.interests.map((x) => <button key={x} className="chip cc" style={{ '--cc': 'var(--a6)' } as React.CSSProperties} aria-pressed={st.sector === x} onClick={() => toggleSet('sector', x)}>{x}</button>)}
          {([['trend', 'up', 'Uptrend', 'var(--up)'], ['trend', 'down', 'Downtrend', 'var(--down)'], ['trend', 'mixed', 'Sideways', 'var(--dim)'], ['quality', 'high', 'High ROCE', 'var(--a3)'], ['momentum', 'strong', 'Ahead of Nifty', 'var(--a4)']] as const).map(([k, v, l, c]) =>
            <button key={l} className="chip cc" style={{ '--cc': c } as React.CSSProperties} aria-pressed={st[k] === v} onClick={() => toggleSet(k, v as never)}>{l}</button>)}
        </div>
        <form className="askbox" role="search" aria-label="Ask in words" onSubmit={(e) => { e.preventDefault(); runAsk(); }}>
          <input className="field" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask in words: debt free and roce above 15" aria-label="Describe the screen in words" enterKeyHint="search" />
          <button className="btn sm" type="submit">Apply</button>
        </form>
        {unread.length > 0 && <p className="small mute" role="status" style={{ margin: '6px 0 0' }}>Not understood, so left out: {unread.map((u) => `“${u}”`).join(', ')}. Name a figure, a direction and a number, for example <em>{ASK_EXAMPLES[1]}</em>.</p>}
        <div className="chips wrap" style={{ marginTop: 8 }}>
          <button className="chip" onClick={() => { try { sessionStorage.setItem('tripwire:lab:seed', JSON.stringify(st.cond)); } catch { /* the Lab then opens on its own starting rule */ } go('/lab'); }}>Test in the Lab</button>
          <button className="chip" onClick={exportCsv} disabled={!run.ordered.length}>Export CSV</button>
        </div>
        {app.screens.length > 0 && <div className="chips wrap" aria-label="Saved screens" style={{ marginTop: 6 }}>{app.screens.map((x) => <button key={x.name} className="chip" onClick={() => { setSt((s) => withFilters(s, x.f)); toast(`Screen “${x.name}” applied`); }}><Icon n="star" />{x.name}</button>)}</div>}
        {active.length > 0 || st.cond.length > 0 ? <SaveScreen f={filtersOf(st)} labels={active} /> : <p className="small mute" style={{ margin: '8px 0 0' }}>Set a filter and it can be saved here as a screen.</p>}
      </div>
    </details>

    <div className="dcount">
      <p className="small num" role="status" aria-live="polite" data-testid="count">{scr.data ? <><b>{run.ordered.length.toLocaleString('en-IN')}</b> of {total.toLocaleString('en-IN')} {total === 1 ? 'company' : 'companies'}{stale ? ' …' : ''} · {sortLine}</> : ''}</p>
      {scr.data && (noFig > 0 || run.unknownIncluded > 0) && <p className="small mute">{run.unmeasured - run.notApplicable > 0 ? `${plural(run.unmeasured - run.notApplicable, 'name')} left out for having no figure for a filter. ` : ''}{run.notApplicable > 0 ? `${plural(run.notApplicable, 'financial-sector name')} left out of a ratio that is not defined for them. ` : ''}{run.unknownIncluded > 0 ? `${plural(run.unknownIncluded, 'name')} included although they have no figure, as asked.` : ''}</p>}
      {scr.data && <div className="small mute basis">{anyLive ? <><i className="ldot" aria-hidden="true" /> marks a figure worked out at today's live price. </> : ''}Filtering and sorting use the close of {asOf ? dayWord(asOf) : 'the last session'}; a live price never changes who is listed or in what order. <details className="inl"><summary>Details</summary>Price, day change, distance from the high and low, PE, PB and the distance from the averages can be redone at a live price, and are shown that way with a dot. Where a figure you filtered or sorted on differs live, the close is printed beside it. RSI, averages, ranks, scores and every statement ratio are at the close only.</details></div>}
    </div>

    {scr.loading && <Loading what="the screen" />}
    {scr.err && <Failed what="the screen" err={scr.err} retry={scr.retry} />}
    {scr.data && !run.ordered.length && <Empty title="No company matches" action={<button className="btn" onClick={clearAll}>Clear all filters</button>}>{noFig > 0 ? `${plural(noFig, 'name')} had no usable figure for a filter. ` : ''}A name with no figure is left out unless a condition says to include it, and is never counted as zero.</Empty>}
    {scr.data && run.ordered.length > 0 && st.view === 'list' && <div className="card" style={{ padding: '2px 14px' }}><div className="list">
      {shown.map((r) => <ListRow key={r.sym} r={r} d={disp(r)} pm={pm} sort={st.sort.key} picked={st.pick.includes(r.sym)} full={st.pick.length >= MAX_PICK} onPick={() => togglePick(r.sym)} selected={selected === r.sym} />)}
    </div></div>}
    {scr.data && run.ordered.length > 0 && st.view === 'table' && <>
      {edge.r && <p className="small mute scrollhint">Scroll sideways for more columns →</p>}
      <div className={`stbl-wrap ${edge.l ? 'can-l' : ''} ${edge.r ? 'can-r' : ''}`} ref={wrapRef} onScroll={() => { measure(); }} tabIndex={0} role="region" aria-label={`Screen results, ${plural(run.ordered.length, 'company', 'companies')}. Scrolls both ways.`}>
        <table className="stbl"><caption className="sr">Screen results, {plural(run.ordered.length, 'company', 'companies')}, {sortLine.toLowerCase()}. Use a column heading to sort, and the funnel beside it to filter.</caption>
          <thead><tr>
            <th scope="col" className="sticky" aria-sort={st.sort.key === 'name' ? (st.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="sortb" onClick={() => patch({ sort: nextSort(st.sort, 'name') })}>COMPANY{st.sort.key === 'name' ? (st.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
            <th scope="col" className="acts"><span className="sr">Compare and follow</span></th>
            {cols.map((c) => { const m = metricOf(c)!; const on = st.sort.key === c; const has = st.cond.some((x) => x.m === c); return <th scope="col" key={c} aria-sort={on ? (st.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button className="sortb" title={m.label} onClick={() => patch({ sort: nextSort(st.sort, c) })}>{m.short}{on ? (st.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button>
              <button className={`thf ${has ? 'on' : ''}`} aria-label={`Filter ${m.label}`} aria-pressed={has} title={`Filter by ${m.label}`} onClick={() => setFigureM({ m: c, back: false })}><span className="fi"><Icon n="filter" /></span></button></th>; })}
          </tr></thead>
          <tbody>{shown.map((r) => { const d = disp(r); const on = st.pick.includes(r.sym); return <tr key={r.sym} data-sym={r.sym} className={selected === r.sym ? 'sel' : ''}>
            <th scope="row" className="sticky"><a href={`#/c/${encodeURIComponent(r.sym)}`} className="symlink">{r.sym}</a><small className="trunc">{r.name}</small></th>
            <td className="acts"><button className="icon-btn" aria-pressed={on} disabled={!on && st.pick.length >= MAX_PICK} aria-label={`${on ? 'Remove from' : 'Add to'} comparison: ${r.sym}`} onClick={() => togglePick(r.sym)}><Icon n="compare" /></button><FollowButton sym={r.sym} name={r.name} /></td>
            {cols.map((c) => <td key={c} className={`num ${metricOf(c)!.signed && cellOf(r, d, c).v !== null ? (cellOf(r, d, c).v! > 0 ? 'up' : cellOf(r, d, c).v! < 0 ? 'down' : '') : ''}`}><FigCell r={r} d={d} id={c} pm={pm} /></td>)}</tr>; })}</tbody></table>
      </div></>}
    {scr.data && run.ordered.length > 0 && <div className="more"><p className="small mute num" role="status">Showing {Math.min(st.show, run.ordered.length).toLocaleString('en-IN')} of {run.ordered.length.toLocaleString('en-IN')}</p>
      {run.ordered.length > st.show && <button className="btn" style={{ width: '100%' }} onClick={() => patch({ show: st.show + PAGE }, true)}>Show {Math.min(PAGE, run.ordered.length - st.show)} more</button>}</div>}
    {st.pick.length >= 1 && <div className="fab-row" style={{ gridTemplateColumns: '1fr 1fr' }}><button className="btn" onClick={() => patch({ pick: [] }, true)}>Clear {st.pick.length}</button><button className="btn pri" style={{ flexDirection: 'row', fontSize: '0.875rem' }} disabled={st.pick.length < 2} onClick={() => { flush(); remember(); go(`/compare?s=${st.pick.join(',')}`); }}><Icon n="compare" />{st.pick.length < 2 ? 'Pick one more' : `Compare ${st.pick.length}`}</button></div>}

    {figure && <CondSheet rows={rows} initial={figure.m} existing={st.cond} allowUnknown blocked={blocked} count={countWith} onClose={() => { setFigureM(null); if (figure.back) setSheet('filters'); }}
      onAdd={(cs) => { setSt((x) => setFigure(x, cs[0].m, cs)); setFigureM(null); if (figure.back) setSheet('filters'); tick(); }} />}
    {sheet === 'filters' && !figure && <Sheet title="Filters" onClose={() => setSheet('')}>
      <label className="l" htmlFor="f-sec">Sector</label>
      <select id="f-sec" className="field" value={st.sector} onChange={(e) => patch({ sector: e.target.value })}><option value="">All sectors</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
      <label className="l" htmlFor="f-size">Size</label>
      <select id="f-size" className="field" value={st.tier} onChange={(e) => patch({ tier: e.target.value })}><option value="">All sizes</option>{['large', 'mid', 'small', 'micro'].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)} cap</option>)}</select>
      <label className="l" htmlFor="f-t">Trend</label>
      <select id="f-t" className="field" value={st.trend} onChange={(e) => patch({ trend: e.target.value as DiscoverState['trend'] })}><option value="">Any</option><option value="up">Uptrend (all four: above 20/50-day, 50-day 1% over 200-day, 3-month up)</option><option value="down">Downtrend (all four, mirrored)</option><option value="mixed">Sideways (meets neither rule)</option></select>
      <label className="l" htmlFor="f-val">Valuation</label>
      <select id="f-val" className="field" value={st.value} onChange={(e) => patch({ value: e.target.value as DiscoverState['value'] })}><option value="">Any</option><option value="cheap">PE 15 or less</option><option value="rich">PE 40 or more</option></select>
      <label className="l" htmlFor="f-q">Quality</label>
      <select id="f-q" className="field" value={st.quality} onChange={(e) => patch({ quality: e.target.value as DiscoverState['quality'] })}><option value="">Any</option><option value="high">Median ROCE 20%+ (financial sector left out)</option></select>
      <label className="l" htmlFor="f-m">Momentum</label>
      <select id="f-m" className="field" value={st.momentum} onChange={(e) => patch({ momentum: e.target.value as DiscoverState['momentum'] })}><option value="">Any</option><option value="strong">Ahead of the Nifty, 3 months</option><option value="weak">Behind the Nifty, 3 months</option><option value="near-high">Within 5% of the 52-week high</option></select>
      {FIGURES.map((g) => <div key={g.title}><Head>{g.title}</Head><div className="figlist">{g.ids.map((id) => { const m = metricOf(id)!; const cs = st.cond.filter((c) => c.m === id); const cv = coverage(rows, id); const why = blocked(id);
        const note = why ? 'not defined for the financial sector' : cv.have === 0 ? (id === 'rsi_w' || id === 'rsi_m' ? 'nightly RSI sheet not loaded' : 'no figures yet') : cv.have < cv.total ? `${cv.have.toLocaleString('en-IN')} of ${cv.total.toLocaleString('en-IN')} have it${id === 'rsi_w' || id === 'rsi_m' ? ' (nightly RSI sheet)' : ''}` : '';
        return <button key={id} className={`figbtn ${cs.length ? 'on' : ''}`} aria-disabled={!!why || cv.have === 0} onClick={() => { if (why || cv.have === 0) { toast(why ?? 'No company has this figure yet.'); return; } setSheet(''); setFigureM({ m: id, back: true }); }}>
          <span className="fn">{m.label}</span><span className="fs small mute">{cs.length ? cs.map(describeCond).join(' · ') : note || 'any'}{cs.length && note ? ` · ${note}` : ''}</span></button>; })}</div></div>)}
      <p className="small dim">Every figure: last close. PE is trailing and absent for loss-makers. ROCE is the median of up to four fiscal years. A name with no figure is left out unless a condition says to include it.</p>
      <div className="row" style={{ marginTop: 12 }}><button className="btn grow" onClick={clearAll}>Clear all</button><button className="btn pri grow" onClick={() => setSheet('')}>Show {run.ordered.length.toLocaleString('en-IN')}</button></div>
    </Sheet>}
    {sheet === 'columns' && <Sheet title="Columns" onClose={() => setSheet('')}>
      <p className="small mute" style={{ margin: '0 0 8px' }}>Which figures the table shows, and the CSV exports. The list view has its own fixed figures.</p>
      <div role="radiogroup" aria-label="Column preset" className="colset">{COLUMN_SETS.map((c) => <label key={c.id} className={`opt ${st.cols === c.id ? 'on' : ''}`}><input type="radio" name="cols" checked={st.cols === c.id} onChange={() => patch({ cols: c.id }, true)} /><span><b>{c.label}</b><small className="mute">{c.cols.map((k) => metricOf(k)?.short).join(' · ')}</small></span></label>)}</div>
      <button className="btn pri" style={{ width: '100%', marginTop: 12 }} onClick={() => setSheet('')}>Done</button>
    </Sheet>}
  </div>;
}

/** One figure in one cell, the same for the list and the table: the live price's version with a dot, "n/a" where the figure is not defined, a dash where there is none; and for a figure the
 *  filter or sort was decided on, the close beside it whenever the live one prints differently. */
function FigCell({ r, d, id, pm }: { r: Row; d: { row: Row; live: boolean }; id: MetricKey; pm: Set<MetricKey> }) {
  const m = metricOf(id)!; const c = cellOf(r, d, id);
  if (c.state === 'na') return <span title="Not defined for this company (a financial-sector ratio)" aria-label="not applicable">n/a</span>;
  if (c.state === 'missing') return <span title="No figure published" aria-label="no figure">—</span>;
  return <>{fmtMetric(m, c.v)}{c.live && <i className="ldot" aria-label="live" title="Worked out at today's live price" />}{c.live && c.differs && pm.has(id) && <small className="atclose" title="The filter and the sort used the close">close {fmtMetric(m, c.close)}</small>}</>;
}
function ListRow({ r, d, pm, sort, picked, full, onPick, selected }: { r: Row; d: { row: Row; live: boolean }; pm: Set<MetricKey>; sort: SortId; picked: boolean; full: boolean; onPick: () => void; selected: boolean }) {
  const q = cellOf(r, d, 'price'); const dc = cellOf(r, d, 'r1d'); const sm = sort === 'name' || sort === 'sym' ? null : metricOf(sort);
  const closeVal = sm ? cellOf(r, { row: r, live: false }, sort as MetricKey) : null;
  return <div className={`li ${selected ? 'sel' : ''}`} data-sym={r.sym}>
    <a className="row grow" href={`#/c/${encodeURIComponent(r.sym)}`} style={{ minWidth: 0 }} aria-current={selected ? 'true' : undefined}>
      <span className="avatar" style={avatarStyle(r.sym)} aria-hidden="true">{initials(r.sym)}</span>
      <span className="grow" style={{ minWidth: 0 }}><span className="sym trunc" style={{ display: 'block' }}>{r.sym}</span><span className="row" style={{ gap: 6, minWidth: 0 }}><TrendTag r={r} compact />
        {sm && closeVal && closeVal.state === 'value' && <span className="metatag" style={{ '--mc': 'var(--a4)' } as React.CSSProperties} title="The figure the list is sorted by, at the close">{sm.short} {fmtMetric(sm, closeVal.v)}</span>}<span className="dim small trunc">{r.name}</span></span></span>
      <span className="wide num">{(['pe', 'roce_med', 'rs3m', 'from_high'] as MetricKey[]).map((id) => <span key={id}><small>{id === 'pe' ? 'PE' : id === 'roce_med' ? 'ROCE' : id === 'rs3m' ? 'vs Nifty 3m' : 'From high'}</small><FigCell r={r} d={d} id={id} pm={pm} /></span>)}</span>
      <span className="px num" style={{ flex: 'none' }}><b>{q.v === null ? '—' : inr(q.v)}{q.live && <i className="ldot" aria-label="live" title="Live price" />}</b><span className={tone(dc.v)}>{pct(dc.v)}{dc.live && <i className="ldot" aria-hidden="true" />}</span></span>
    </a>
    <button className="icon-btn" aria-pressed={picked} disabled={full && !picked} aria-label={`${picked ? 'Remove from' : 'Add to'} comparison: ${r.sym}`} onClick={onPick}><Icon n="compare" /></button>
    <FollowButton sym={r.sym} name={r.name} />
  </div>;
}
/** A mutually exclusive choice: one tab stop, arrow keys move and choose, exposed as a radio group. */
function Radios({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: { id: string; label: string }[] }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: RKey, i: number) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return; e.preventDefault(); const n = (i + d + items.length) % items.length; onChange(items[n].id); refs.current[n]?.focus(); };
  return <div className="dseg" role="radiogroup" aria-label={label}>{items.map((x, i) => <button key={x.id} ref={(el) => { refs.current[i] = el; }} role="radio" aria-checked={value === x.id} tabIndex={value === x.id ? 0 : -1} onClick={() => onChange(x.id)} onKeyDown={(e) => key(e, i)}>{x.label}</button>)}</div>;
}
function SaveScreen({ f, labels }: { f: Filters; labels: string[] }) {
  const [n, setN] = useState(''); const { toast } = useUi();
  return <div style={{ marginTop: 10 }}><p className="small dim" style={{ margin: '0 0 6px' }}>Save this screen: {labels.join(' · ')}</p>
    <div className="row"><input className="field" placeholder="Name it" value={n} maxLength={40} onChange={(e) => setN(e.target.value)} aria-label="Screen name" /><button className="btn pri" disabled={!n.trim()} onClick={() => { setState((x) => saveScreen(x, n, f)); toast(`Saved “${n.trim()}”`); setN(''); }}>Save</button></div></div>;
}
