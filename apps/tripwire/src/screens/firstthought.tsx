import { useState } from 'react';
import { setState, useAppState } from '../app.tsx';
import { useUi } from '../ui.tsx';
import { addEntry, current, toggleFollow } from '../store.ts';

/** First use, step 3 of 3: an optional thought about the company just read. It reuses the journal's entry model (thesis text, invalidation optional, no review date forced).
 *  Saving never follows the company; following is its own button. At the first save only, one line says the notes stay on this device and where the backup is. */
export function FirstThought({ sym, name, risk }: { sym: string; name: string; risk: { line: string; note: string | null } }) {
  const s = useAppState(); const { toast, tick } = useUi();
  const [text, setText] = useState(''); const [wrong, setWrong] = useState(''); const [hide, setHide] = useState(false); const [showNote, setShowNote] = useState(false);
  const mine = s.entries.filter((e) => e.sym === sym && !e.archived);
  const saved = mine[0] ? current(mine[0]) : null; const following = s.follows.includes(sym);
  const save = () => {
    const t = text.trim(); if (!t) return;
    const firstEver = !s.storageNote && s.entries.length === 0;
    setState((x) => ({ ...addEntry(x, sym, { thesis: t, support: '', counter: '', decision: '', invalidation: wrong.trim(), trigger: '', reviewOn: null }).s, ...(firstEver ? { storageNote: true } : {}) }));
    setShowNote(firstEver); tick(); toast('Thought saved on this device');
  };
  return <section className="first" id="first-thought" data-first="thought" aria-labelledby="ft-h">
    <h2 id="ft-h" className="sec">The main risk</h2>
    <p className="ft-risk" data-first-risk>{risk.line}</p>
    {risk.note && <p className="small dim" style={{ margin: '4px 0 0' }}>{risk.note}</p>}
    {saved ? <div className="ft-saved" data-first="saved">
      <p style={{ margin: '14px 0 4px' }}><b>Your thought on {sym}</b></p>
      <p className="ft-quote" style={{ margin: 0 }}>{saved.thesis}</p>
      {saved.invalidation && <p className="small dim" style={{ margin: '4px 0 0' }}>Wrong if: {saved.invalidation}</p>}
      {showNote && <p className="ft-note small" role="status" data-first="storage-note">This note stays on this device. There is no account, so clearing this browser's data would erase it. <a href="#/profile">Back it up in Profile</a>.</p>}
      <div className="row ft-act">
        {following ? <span className="small dim">You follow {sym}.</span> : <button className="btn" onClick={() => { setState((x) => toggleFollow(x, sym)); toast(`Following ${sym}. Kept on this device.`); }}>Follow {sym}</button>}
        <a className="btn" href="#/desk?v=journal">Find it in My Desk</a>
      </div>
      {!following && <p className="small mute" style={{ margin: '8px 0 0' }}>Saving a thought does not follow {sym}. Follow it only if you want its changes on Today.</p>}
    </div>
      : hide ? <p className="small dim" style={{ margin: '14px 0 0' }}>No thought saved. You can write one any time with Thesis below. <button className="linkbtn" onClick={() => setHide(false)}>Write one now</button></p>
      : <form className="ft-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="l" htmlFor="ft-thought">A thought on {name} (optional)</label>
        <textarea id="ft-thought" className="field" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="Why it interests you, or what you want to check" />
        <label className="l" htmlFor="ft-wrong">What would make you wrong (optional)</label>
        <input id="ft-wrong" className="field" maxLength={300} value={wrong} onChange={(e) => setWrong(e.target.value)} placeholder="A price or an event" />
        <div className="row ft-act"><button className="btn pri" type="submit" disabled={!text.trim()}>Save thought</button><button className="btn" type="button" onClick={() => setHide(true)}>Not now</button></div>
        <p className="small mute" style={{ margin: '8px 0 0' }}>Saving does not follow {sym}. Paper analysis only.</p>
      </form>}
  </section>;
}
