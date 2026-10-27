import { support } from '../haptic.ts';
import { useRef, useState } from 'react';
import { setState, useAppState, useLoc } from '../app.tsx';
import { Icon, useUi } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';
import { DEFAULTS, exportJson, journalCsv, mergeStates, parseState } from '../store.ts';
import { disableLock, enableLock, lockId, lockSupported } from '../lock.ts';
import { useEffect } from 'react';
import { SERVICES, hapticsNote, publicStatus } from '../services.ts';
import { useJson } from '../data.ts';

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const SECTORS = ['Technology', 'Financial Services', 'Healthcare', 'Industrials', 'Consumer Cyclical', 'Consumer Defensive', 'Basic Materials', 'Energy', 'Utilities', 'Real Estate', 'Communication Services'];
/** Settings, or the separate Operations page when the address carries ?view=ops. Operations is not linked from here (see its own note on what that does and does not protect). */
export function Profile() { const loc = useLoc(); return loc.q.get('view') === 'ops' ? <Operations /> : <Settings />; }
function Settings() {
  const s = useAppState(); const { toast } = useUi(); const file = useRef<HTMLInputElement>(null); const [sure, setSure] = useState(false);
  const [lockOn, setLockOn] = useState(!!lockId()); const [canLock, setCanLock] = useState<boolean | null>(null); useEffect(() => { void lockSupported().then(setCanLock); }, []);
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
      <div className="l">Sectors you care about (they become one-tap filters in Discover)</div>
      <div className="chips wrap" role="group" aria-label="Sectors">{SECTORS.map((x) => <button key={x} className="chip" aria-pressed={p.interests.includes(x)} onClick={() => set({ interests: p.interests.includes(x) ? p.interests.filter((y) => y !== x) : [...p.interests, x] })}>{x}</button>)}</div>
    </div>

    <Head>Paper planner defaults</Head>
    <div className="card">{numf('equity', 'Hypothetical equity, ₹', 10000)}{numf('cash', 'Available cash, ₹', 10000)}{numf('riskPct', 'Risk per plan, % of equity', 0.1)}{numf('maxPositionPct', 'Largest position, % of equity', 1)}
      <p className="small dim" style={{ marginBottom: 0 }}>Hypothetical figures. They are not read from any broker or account.</p></div>

    <Head>Privacy</Head>
    <div className="card">
      <label className="row between" style={{ minHeight: 44 }}><span>Hide my amounts<span className="dim small" style={{ display: 'block' }}>Blurs profit and loss and the money in your paper books. Also on the eye button on Today.</span></span><input type="checkbox" role="switch" checked={!!p.hideAmounts} onChange={(e) => set({ hideAmounts: e.target.checked })} /></label>
      <label className="row between" style={{ minHeight: 44, opacity: canLock !== false || lockOn ? 1 : 0.55 }}><span>Lock with Face ID or fingerprint<span className="dim small" style={{ display: 'block' }}>{canLock === null && !lockOn ? 'Checking what this device supports…' : canLock || lockOn ? 'Asks for your phone\'s unlock when you open the app and after a minute in the background.' : 'Not supported in this browser: it has no device unlock Tripwire can use, so the switch is off.'}</span>{lockOn && canLock === false ? <span className="warnc small" style={{ display: 'block' }}>The lock is on, but this browser can no longer check it. Turn it off here to get back in.</span> : null}</span>
        <input type="checkbox" role="switch" checked={lockOn} disabled={canLock !== true && !lockOn} aria-label="Lock with Face ID or fingerprint" onChange={async (e) => { if (e.target.checked) { const ok = await enableLock(); setLockOn(ok); toast(ok ? 'Lock is on' : 'The lock could not be set up'); } else { disableLock(); setLockOn(false); toast('Lock is off'); } }} /></label>
      <p className="small dim" style={{ margin: '8px 0 0' }}>This is a screen lock: it stops someone casually opening the app on your phone. It does not encrypt what is stored in the browser, and anyone who can inspect the browser could still read it. If you cannot unlock, the only way in is to erase this device's data.</p>
    </div>

    <Head>Feel</Head>
    <div className="card">
      <label className="row between" style={{ minHeight: 44 }}><span>Motion<span className="dim small" style={{ display: 'block' }}>Also follows your device’s reduce-motion setting.</span></span><input type="checkbox" role="switch" checked={p.motion === 'auto'} onChange={(e) => set({ motion: e.target.checked ? 'auto' : 'off' })} /></label>
      <label className="row between" style={{ minHeight: 44 }}><span>Haptics<span className="dim small" style={{ display: 'block' }}>{hapticsNote(support())}</span></span><input type="checkbox" role="switch" checked={p.haptics && support() !== 'none'} disabled={support() === 'none'} onChange={(e) => set({ haptics: e.target.checked })} /></label>
    </div>

    <Head>Services and integrations</Head>
    <ServicesCard lock={canLock} />

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

interface HealthFeed { ok: boolean; checked_at: string; prices: { ok: boolean; ms: number | null; age_sec: number | null; error: string | null }; news: { ok: boolean; ms: number | null; error: string | null }; bindings: string[]; secrets_configured: number }
/** One list of what works and what does not, in plain words. The two live sources are probed once when this section opens; everything else is a fact about the build.
 *  Timings, binding names and error codes are not here: they are on the separate Operations page. */
function ServicesCard({ lock }: { lock: boolean | null }) {
  const h = useJson<HealthFeed>('/api/health');
  const live = (id: string) => (id === 'prices' ? h.data?.prices : id === 'news' ? h.data?.news : null);
  return <div className="card" style={{ padding: '2px 14px' }}>
    {SERVICES.map((v) => { const l = live(v.id); const st = publicStatus(v, l ?? null, v.id === 'lock' ? lock : null);
      return <details key={v.id} className="ev" style={{ margin: 0 }}><summary>{v.label}<span className={`tag ${st.tone} num`} style={{ marginLeft: 'auto' }}>{st.word}</span><span className="chev">▾</span></summary>
        <div className="body small"><p style={{ margin: '0 0 6px' }}>{v.what}</p>
          {st.deviceLine ? <p style={{ margin: '0 0 6px' }}><b>{st.deviceLine.split(':')[0]}:</b>{st.deviceLine.slice(st.deviceLine.indexOf(':') + 1)}.</p> : null}
          {l ? <p style={{ margin: '0 0 6px' }}><b>Right now:</b> {h.loading ? 'checking' : l.ok ? 'answering' : 'not answering'}.</p> : null}
          {v.needs ? <p style={{ margin: 0 }}><b>To make it real:</b> {v.needs}</p> : null}</div></details>; })}
    <p className="small mute" style={{ margin: '6px 0 10px' }}>{h.data ? `Status checked at ${new Date(h.data.checked_at).toISOString().slice(11, 16)} UTC.` : h.err ? 'The status check did not answer; the list above is what the build contains.' : 'Checking the live sources…'}</p>
  </div>;
}

/** Operations: what the Worker holds and how its probes ran. For the person who runs the service, not for ordinary reading, and not linked from Settings.
 *  This is a separate page, not protection: there is no sign-in, so anyone who knows the address (or reads /api/health, which is public) sees the same. It carries binding NAMES and counts only, never a value. */
function Operations() {
  const h = useJson<HealthFeed>('/api/health');
  return <div>
    <PageBar title="Operations" onBack />
    <div className="note info"><b>This page is not protected.</b> Tripwire has no accounts, so nothing here is behind a sign-in; it is simply not linked from Settings. Real protection needs authentication that does not exist yet. It lists binding names and counts, never a secret value.</div>
    <Head>Service probes</Head>
    <div className="card small">{h.loading ? 'Checking…' : h.err || !h.data ? `The health check did not answer (${h.err ?? 'no data'}).` : <>
      <p style={{ margin: '0 0 6px' }}><b>Prices:</b> {h.data.prices.ok ? `answering${h.data.prices.ms != null ? ` in ${h.data.prices.ms} ms` : ''}${h.data.prices.age_sec != null ? `; last exchange print ${h.data.prices.age_sec < 120 ? `${h.data.prices.age_sec} s` : h.data.prices.age_sec < 7200 ? `${Math.round(h.data.prices.age_sec / 60)} min` : `${Math.round(h.data.prices.age_sec / 3600)} h`} ago` : ''}` : `not answering (${h.data.prices.error ?? 'no reply'})`}.</p>
      <p style={{ margin: '0 0 6px' }}><b>News:</b> {h.data.news.ok ? `answering${h.data.news.ms != null ? ` in ${h.data.news.ms} ms` : ''}` : `not answering (${h.data.news.error ?? 'no reply'})`}.</p>
      <p style={{ margin: 0 }}>The Worker holds {h.data.secrets_configured} secrets and {h.data.bindings.length} binding{h.data.bindings.length === 1 ? '' : 's'} ({h.data.bindings.join(', ') || 'none'}); checked {new Date(h.data.checked_at).toISOString().slice(11, 16)} UTC.</p></>}</div>
  </div>;
}
