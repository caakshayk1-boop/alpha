import { useRef, useState } from 'react';
import { setState, useAppState } from '../app.tsx';
import { Icon, useUi } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';
import { DEFAULTS, exportJson, journalCsv, mergeStates, parseState } from '../store.ts';
import { THEMES, themeOf } from '../theme.ts';
import { disableLock, enableLock, lockId, lockSupported } from '../lock.ts';
import { Mark } from '../ui.tsx';
import { useEffect } from 'react';

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const SECTORS = ['Technology', 'Financial Services', 'Healthcare', 'Industrials', 'Consumer Cyclical', 'Consumer Defensive', 'Basic Materials', 'Energy', 'Utilities', 'Real Estate', 'Communication Services'];
export function Profile() {
  const s = useAppState(); const { toast } = useUi(); const file = useRef<HTMLInputElement>(null); const [sure, setSure] = useState(false);
  const [lockOn, setLockOn] = useState(!!lockId()); const [canLock, setCanLock] = useState(false); useEffect(() => { void lockSupported().then(setCanLock); }, []);
  const p = s.prefs; const set = (o: Partial<typeof p>) => setState((x) => ({ ...x, prefs: { ...x.prefs, ...o } }));
  const numf = (k: 'equity' | 'cash' | 'riskPct' | 'maxPositionPct', l: string, step = 1) => <><label className="l" htmlFor={`p-${k}`}>{l}</label><input id={`p-${k}`} className="field num" inputMode="decimal" type="number" step={step} min="0" value={p[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as never)} /></>;
  return <div>
    <PageBar title="Profile" />
    <div className="card glass"><div className="row"><span className="avatar" aria-hidden="true"><Icon n="lock" /></span><div className="grow"><b>Local mode</b><div className="small dim">Everything you write is kept on this device only.</div></div></div>
      <div className="note" style={{ marginTop: 12 }}><b>Sign-in is not available yet.</b> No identity provider is configured for Tripwire, so there is no account, no sync between devices and no password to reset. Export a backup from here; clearing site data erases your notes.</div></div>

    <Head>You</Head>
    <div className="card">
      <label className="l" htmlFor="p-h">Investment horizon</label>
      <select id="p-h" className="field" value={p.horizon} onChange={(e) => set({ horizon: e.target.value })}><option value="">Not set</option><option>Days to weeks</option><option>Months</option><option>Years</option></select>
      <label className="l" htmlFor="p-e">Experience</label>
      <select id="p-e" className="field" value={p.experience} onChange={(e) => set({ experience: e.target.value })}><option value="">Not set</option><option>New to markets</option><option>A few years</option><option>Experienced</option></select>
      <div className="l">Sectors you care about (shapes “Worth a look”)</div>
      <div className="chips wrap" role="group" aria-label="Sectors">{SECTORS.map((x) => <button key={x} className="chip" aria-pressed={p.interests.includes(x)} onClick={() => set({ interests: p.interests.includes(x) ? p.interests.filter((y) => y !== x) : [...p.interests, x] })}>{x}</button>)}</div>
    </div>

    <Head>Paper planner defaults</Head>
    <div className="card">{numf('equity', 'Hypothetical equity, ₹', 10000)}{numf('cash', 'Available cash, ₹', 10000)}{numf('riskPct', 'Risk per plan, % of equity', 0.1)}{numf('maxPositionPct', 'Largest position, % of equity', 1)}
      <p className="small dim" style={{ marginBottom: 0 }}>Hypothetical figures. They are not read from any broker or account.</p></div>

    <Head>Look</Head>
    <div className="card">
      <div className="row" style={{ gap: 12 }}><Mark size={48} /><div className="grow"><b>{themeOf(p.theme).label}</b><div className="small dim">Pick a colour. The app, the browser bar and the icon follow it.</div></div></div>
      <div className="swatches" role="group" aria-label="Colour theme" style={{ marginTop: 12 }}>{THEMES.map((t) => <button key={t.id} className="swatch" style={{ background: t.swatch }} aria-pressed={themeOf(p.theme).id === t.id} aria-label={t.label} onClick={() => set({ theme: t.id })} />)}</div>
      <p className="small dim" style={{ margin: '10px 0 0' }}>A phone takes an app's icon when you add it to the home screen, and a web page cannot change an icon that is already there. To use a different icon, pick the colour, then remove Tripwire from the home screen and add it again.</p>
    </div>

    <Head>Privacy</Head>
    <div className="card">
      <label className="row between" style={{ minHeight: 44 }}><span>Hide my amounts<span className="dim small" style={{ display: 'block' }}>Blurs profit and loss and the money in your paper books. Also on the eye button on Today.</span></span><input type="checkbox" role="switch" checked={!!p.hideAmounts} onChange={(e) => set({ hideAmounts: e.target.checked })} /></label>
      <label className="row between" style={{ minHeight: 44, opacity: canLock || lockOn ? 1 : 0.55 }}><span>Lock with Face ID or fingerprint<span className="dim small" style={{ display: 'block' }}>{canLock || lockOn ? 'Asks for your phone\'s unlock when you open the app and after a minute in the background.' : 'This browser has no device unlock to use.'}</span></span>
        <input type="checkbox" role="switch" checked={lockOn} disabled={!canLock && !lockOn} onChange={async (e) => { if (e.target.checked) { const ok = await enableLock(); setLockOn(ok); toast(ok ? 'Lock is on' : 'The lock could not be set up'); } else { disableLock(); setLockOn(false); toast('Lock is off'); } }} /></label>
      <p className="small dim" style={{ margin: '8px 0 0' }}>This is a screen lock: it stops someone casually opening the app on your phone. It does not encrypt what is stored in the browser, and anyone who can inspect the browser could still read it. If you cannot unlock, the only way in is to erase this device's data.</p>
    </div>

    <Head>Feel</Head>
    <div className="card">
      <label className="row between" style={{ minHeight: 44 }}><span>Motion<span className="dim small" style={{ display: 'block' }}>Also follows your device’s reduce-motion setting.</span></span><input type="checkbox" role="switch" checked={p.motion === 'auto'} onChange={(e) => set({ motion: e.target.checked ? 'auto' : 'off' })} style={{ width: 24, height: 24, accentColor: '#c8f23c' }} /></label>
      <label className="row between" style={{ minHeight: 44 }}><span>Haptics<span className="dim small" style={{ display: 'block' }}>{'vibrate' in navigator ? 'A light tap on buttons and on success or error messages.' : 'Not supported on this device.'}</span></span><input type="checkbox" role="switch" checked={p.haptics} disabled={!('vibrate' in navigator)} onChange={(e) => set({ haptics: e.target.checked })} style={{ width: 24, height: 24, accentColor: '#c8f23c' }} /></label>
    </div>

    <Head>Notifications</Head>
    <div className="card"><div className="row"><Icon n="bell" /><div className="grow"><b>Not available yet</b><div className="small dim">Delivery needs a configured service, and none is. Review dates and changes appear on Today when you open the app. No alert is promised or sent.</div></div></div></div>

    <Head>Your data</Head>
    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => download('tripwire-backup.json', exportJson(s), 'application/json')}>Export all (JSON)</button>
        <button className="btn" onClick={() => download('tripwire-journal.csv', journalCsv(s), 'text/csv')}>Journal (CSV)</button>
        <button className="btn" onClick={() => file.current?.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 2_000_000) { toast('That file is too large for a backup'); return; } const got = parseState(await f.text()); if (!got) { toast('Not a Tripwire backup. Nothing was changed.'); return; } setState((x) => mergeStates(x, got)); toast('Imported and merged. Nothing was overwritten.'); }} />
      </div>
      <p className="small dim">An import merges: your notes and the backup’s are both kept, and the longer edit history wins.</p>
      {!sure ? <button className="btn warn" onClick={() => setSure(true)}><Icon n="trash" />Delete all my data</button>
        : <div className="note"><b>This erases every note, plan and follow on this device.</b> Export first if you want a copy.<div className="row" style={{ marginTop: 10 }}><button className="btn warn grow" onClick={() => { setState(() => ({ ...DEFAULTS, onboarded: true })); setSure(false); toast('All data deleted from this device'); }}>Erase now</button><button className="btn grow" onClick={() => setSure(false)}>Keep</button></div></div>}
    </div>

    <Head>Plan</Head>
    <div className="card"><b>Free</b><p className="small dim" style={{ margin: '6px 0 0' }}>Everything in Tripwire today is free. Paid features are not for sale yet: no billing provider is configured and no price is set.</p></div>
    <Head>About</Head>
    <div className="card small dim"><p style={{ marginTop: 0 }}>Tripwire shows which public rules fired at the last close and the evidence on each side. It is educational research, not investment advice, and no order is ever placed. Prices are end-of-day from public sources and may contain errors. Paper results are not real results.</p>
      <p style={{ marginBottom: 0 }}>Privacy: no account, no tracking, no analytics. Your notes never leave this device.</p></div>
  </div>;
}
