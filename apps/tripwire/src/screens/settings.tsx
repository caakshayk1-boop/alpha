import { support } from '../haptic.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { replaceHash, setState, useAppState } from '../app.tsx';
import { Icon, useUi } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';
import { DEFAULTS, checkBackup, exportJson, journalCsv, mergeStates, type State } from '../store.ts';
import { download, downloadBackup } from '../backupfile.ts';
import { backupStatus, readBackup } from '../backupstatus.ts';
import { readUnreadable, storageWorks } from '../persist.ts';
import { disableLock, enableLock, lockId, lockSupported } from '../lock.ts';
import { hapticsNote } from '../services.ts';

export { download };
const SECTORS = ['Technology', 'Financial Services', 'Healthcare', 'Industrials', 'Consumer Cyclical', 'Consumer Defensive', 'Basic Materials', 'Energy', 'Utilities', 'Real Estate', 'Communication Services'];
const KEY = 'tripwire:v1';
const ls = (): Storage | null => { try { return localStorage; } catch { return null; } };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** What a backup file holds, in words, for the message after an import. */
const contents = (s: State) => [plural(s.entries.length, 'journal entry').replace('entrys', 'entries'), plural(s.plans.length, 'plan'), plural(s.paper.length, 'paper trade'), plural(s.follows.length, 'followed name')].join(', ');

/** Settings (route #/settings; the older #/profile address still works and is rewritten to it): only what a person acts on. Services, bindings, probe timings, schedules and cache lifetimes are on the Operations page (#/ops). */
export function Settings() {
  const s = useAppState(); const { toast } = useUi(); const file = useRef<HTMLInputElement>(null); const [sure, setSure] = useState(false);
  const [lockOn, setLockOn] = useState(!!lockId()); const [canLock, setCanLock] = useState<boolean | null>(null); useEffect(() => { void lockSupported().then(setCanLock); }, []);
  const [saving, setSaving] = useState<boolean | null>(null); useEffect(() => { setSaving(storageWorks(ls())); }, [s]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const kept = useMemo(() => readUnreadable(ls(), KEY), [s]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (/^#\/profile(\?|$)/.test(location.hash)) replaceHash(location.hash.replace('#/profile', '#/settings').slice(1)); }, []);   // the old address keeps working, and the bar shows the new one
  const [rec, setRec] = useState(() => readBackup(ls())); const [now] = useState(() => Date.now()); const bs = backupStatus(rec, now); const backupRef = useRef<HTMLDivElement>(null);
  const backUp = () => { const ok = downloadBackup(s); setRec(readBackup(ls())); toast(ok ? 'Backup file created' : 'Backup file created (this browser would not record it)'); };
  const p = s.prefs; const set = (o: Partial<typeof p>) => setState((x) => ({ ...x, prefs: { ...x.prefs, ...o } }));
  const numf = (k: 'equity' | 'cash' | 'riskPct' | 'maxPositionPct', l: string, step = 1) => <><label className="l" htmlFor={`p-${k}`}>{l}</label><input id={`p-${k}`} className="field num" inputMode="decimal" type="number" step={step} min="0" value={p[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as never)} /></>;
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { setResult({ ok: false, text: 'That file is too large to be a Tripwire backup (over 2 MB). Nothing was changed.' }); toast('That file is too large for a backup'); return; }
    let text = ''; try { text = await f.text(); } catch { setResult({ ok: false, text: 'The file could not be read. Nothing was changed.' }); return; }
    const c = checkBackup(text);
    if (!c.ok) { setResult({ ok: false, text: `${c.reason} Nothing was changed.` }); toast('Not imported. Nothing was changed.'); return; }
    setState((x) => mergeStates(x, c.state)); setResult({ ok: true, text: `Imported and merged: ${contents(c.state)}. Nothing was overwritten.` }); toast('Imported and merged. Nothing was overwritten.');
  };
  return <div>
    <PageBar title="Settings" />
    <section className="card glass" aria-labelledby="set-dev" data-settings="device">
      <div className="row"><span className="avatar" aria-hidden="true"><Icon n="lock" /></span><div className="grow"><h2 id="set-dev" className="sec" style={{ margin: 0 }}>Stored on this device only</h2>
        <div className="small dim" style={{ marginTop: 4 }}>There is no sign-in: Tripwire has no accounts and no sync. What you write is saved in this browser only. Clearing site data erases it, and another device starts empty, so a backup file is how you keep a copy or move. Currently held: {contents(s)}. Notifications are not built.</div></div></div>
      {saving === false && <div className="note warn" role="alert" style={{ marginTop: 12 }}><b>This browser is not saving.</b> A private window, or full or blocked storage. What you write will be lost when this tab closes. <button className="btn sm" onClick={backUp}>Download a backup now</button></div>}
      <div className="set-backup" data-backup-status={bs.recorded ? 'recorded' : 'none'} role="status">
        <b>{bs.headline}</b><span className="small dim">{bs.note}</span>
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 10 }}><button className="btn pri" onClick={backUp}>Back up now</button>
          <button className="btn" onClick={() => { backupRef.current?.scrollIntoView({ block: 'start' }); backupRef.current?.focus({ preventScroll: true }); }}>Restore from a backup</button></div>
      </div>
    </section>

    <Head>Display and feel</Head>
    <div className="card">
      <label className="row between" style={{ minHeight: 44 }}><span>Motion<span className="dim small" style={{ display: 'block' }}>Also follows your device’s reduce-motion setting.</span></span><input type="checkbox" role="switch" checked={p.motion === 'auto'} onChange={(e) => set({ motion: e.target.checked ? 'auto' : 'off' })} /></label>
      <label className="row between" style={{ minHeight: 44 }}><span>Haptics<span className="dim small" style={{ display: 'block' }}>{hapticsNote(support())}</span></span><input type="checkbox" role="switch" checked={p.haptics && support() !== 'none'} disabled={support() === 'none'} onChange={(e) => set({ haptics: e.target.checked })} /></label>
      <div style={{ minHeight: 44, padding: '8px 0' }}><span>Text size</span><span className="dim small" style={{ display: 'block' }}>Follows your device’s text-size setting where the browser supports it (Safari on iPhone does; most others follow the browser’s own font-size setting). There is no separate control here.</span></div>
      <label className="row between" style={{ minHeight: 44 }}><span>Hide my amounts<span className="dim small" style={{ display: 'block' }}>Blurs profit and loss and the money in your paper books. Also on the eye button on Today.</span></span><input type="checkbox" role="switch" checked={!!p.hideAmounts} onChange={(e) => set({ hideAmounts: e.target.checked })} /></label>
    </div>

    <Head>Screen lock</Head>
    <div className="card">
      <label className="row between" style={{ minHeight: 44, opacity: canLock !== false || lockOn ? 1 : 0.55 }}><span>Lock with Face ID or fingerprint<span className="dim small" style={{ display: 'block' }}>{canLock === null && !lockOn ? 'Checking what this device supports…' : canLock || lockOn ? 'Asks for your phone\'s unlock when you open the app and after a minute in the background.' : 'Not supported in this browser: it has no device unlock Tripwire can use, so the switch is off.'}</span>{lockOn && canLock === false ? <span className="warnc small" style={{ display: 'block' }}>The lock is on, but this browser can no longer check it. Turn it off here to get back in.</span> : null}</span>
        <input type="checkbox" role="switch" checked={lockOn} disabled={canLock !== true && !lockOn} aria-label="Lock with Face ID or fingerprint" onChange={async (e) => { if (e.target.checked) { const ok = await enableLock(); setLockOn(ok); toast(ok ? 'Lock is on' : 'The lock could not be set up'); } else { disableLock(); setLockOn(false); toast('Lock is off'); } }} /></label>
      <p className="small dim" style={{ margin: '8px 0 0' }}>This is a screen lock: it stops someone casually opening the app on your phone. It does not encrypt what is stored in the browser, and anyone who can inspect the browser could still read it. Whether it works depends on your device and browser. If you cannot unlock, the only way in is to erase this device's data.</p>
    </div>

    <Head>Paper plan defaults</Head>
    <div className="card">{numf('equity', 'Hypothetical equity, ₹', 10000)}{numf('cash', 'Available cash, ₹', 10000)}{numf('riskPct', 'Risk per plan, % of equity', 0.1)}{numf('maxPositionPct', 'Largest position, % of equity', 1)}
      <p className="small dim" style={{ marginBottom: 0 }}>Hypothetical figures. They are not read from any broker or account.</p></div>

    <Head>Discover shortcuts</Head>
    <div className="card">
      <div className="l">Sectors you care about (they become one-tap filters in Discover)</div>
      <div className="chips wrap" role="group" aria-label="Sectors">{SECTORS.map((x) => <button key={x} className="chip" aria-pressed={p.interests.includes(x)} onClick={() => set({ interests: p.interests.includes(x) ? p.interests.filter((y) => y !== x) : [...p.interests, x] })}>{x}</button>)}</div>
    </div>

    <Head>Backup and restore</Head>
    <div className="card" id="set-backup" ref={backupRef} tabIndex={-1} data-settings="backup">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={backUp}>Export all (JSON)</button>
        <button className="btn" onClick={() => download('tripwire-journal.csv', journalCsv(s), 'text/csv')}>Journal (CSV)</button>
        <button className="btn" onClick={() => file.current?.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onImport(f); }} />
      </div>
      <p className="small dim">The backup holds your journal with every version, plans, paper trades, followed names, saved screens and preferences. An import merges: your notes and the backup’s are both kept, and the longer edit history wins. A file that is not a Tripwire backup is refused whole, with the reason.</p>
      {result && <div className={`note ${result.ok ? 'info' : 'warn'}`} role={result.ok ? 'status' : 'alert'} id="import-result">{result.text}</div>}
      {kept && <div className="note" style={{ marginTop: 10 }}><b>A copy of unreadable saved data was kept.</b> Earlier this browser held data Tripwire could not read, and nothing was erased. <button className="btn sm" onClick={() => download('tripwire-unreadable-copy.txt', kept, 'text/plain')}>Download that copy</button></div>}
    </div>

    <Head>Erase data</Head>
    <div className="card">
      {!sure ? <button className="btn warn" onClick={() => setSure(true)}><Icon n="trash" />Delete all my data</button>
        : <div className="note"><b>This erases every note, plan and follow on this device{kept ? ', and the kept copy of unreadable data' : ''}.</b> Export first if you want a copy.<div className="row" style={{ marginTop: 10 }}><button className="btn warn grow" onClick={() => { try { ls()?.removeItem(`${KEY}:unreadable`); ls()?.removeItem(`${KEY}:unreadable:earlier`); } catch { /* nothing to remove */ } setState(() => ({ ...DEFAULTS, onboarded: true })); setSure(false); setResult(null); toast('All data deleted from this device'); }}>Erase now</button><button className="btn grow" onClick={() => setSure(false)}>Keep</button></div></div>}
    </div>

    <Head>Help and method</Head>
    <div className="card" style={{ padding: '2px 14px' }}><div className="list"><a className="li" href="#/help"><span className="grow">Help<span className="small dim" style={{ display: 'block' }}>How to use Tripwire</span></span></a><a className="li" href="#/methodology"><span className="grow">Methodology and evidence<span className="small dim" style={{ display: 'block' }}>How picks, trends and charts are worked out, and what the tests found</span></span></a><a className="li" href="#/data"><span className="grow">Data and coverage<span className="small dim" style={{ display: 'block' }}>What is in the screen and how old each figure is</span></span></a><a className="li" href="#/ops"><span className="grow">Operations and status<span className="small dim" style={{ display: 'block' }}>Service health, what was checked and when</span></span></a></div></div>

    <Head>About</Head>
    <div className="card small dim"><p style={{ marginTop: 0 }}>Tripwire shows which public rules fired at the last close and the evidence on each side. It is educational research, not investment advice, and no order is ever placed. Prices are from public sources and may contain errors. Paper results are not real results.</p>
      <p style={{ marginBottom: 0 }}>Privacy: no account, no tracking, no analytics. Your notes never leave this device.</p></div>
  </div>;
}
