import { useEffect, useState } from 'react';
import { Mark } from '../ui.tsx';
import { unlock } from '../lock.ts';
import { setState } from '../app.tsx';
import { DEFAULTS } from '../store.ts';

/** Shown instead of the app while the lock is on. The phone's own unlock opens it. If it cannot be passed, the only way on is to erase this
 *  device's data: there is no back door that leaves the data readable, and no account that could reset it. */
export function LockScreen({ onOpen }: { onOpen: () => void }) {
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false); const [sure, setSure] = useState(false);
  const go = async () => { setBusy(true); setFailed(false); const ok = await unlock(); setBusy(false); if (ok) onOpen(); else setFailed(true); };
  useEffect(() => { void go(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="lock" role="dialog" aria-modal="true" aria-label="Tripwire is locked">
    <div className="box">
      <Mark size={84} className="mark" />
      <h1 style={{ font: '650 1.5rem/1.1 var(--sans)', letterSpacing: '-.6px', margin: 0 }}>Tripwire is locked</h1>
      <p className="dim" style={{ margin: 0 }}>Unlock with Face ID, your fingerprint or your device passcode.</p>
      <button className="btn pri" style={{ width: '100%', height: 52 }} disabled={busy} onClick={go}>{busy ? 'Waiting for your phone…' : 'Unlock'}</button>
      {failed && <p className="small down" role="alert" style={{ margin: 0 }}>That did not unlock it. Try again.</p>}
      {!sure ? <button className="btn sm" onClick={() => setSure(true)}>Can't unlock?</button>
        : <div className="note" style={{ textAlign: 'left' }}><b>This erases everything Tripwire holds on this device</b>: notes, plans, follows, paper trades and the lock. It cannot be undone.
          <div className="row" style={{ marginTop: 10 }}><button className="btn warn grow" onClick={() => { try { localStorage.removeItem('tripwire:lock'); } catch { /* none */ } setState(() => ({ ...DEFAULTS, onboarded: true })); onOpen(); }}>Erase and open</button><button className="btn grow" onClick={() => setSure(false)}>Cancel</button></div></div>}
    </div></div>;
}
