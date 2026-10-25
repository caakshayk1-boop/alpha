import { useState } from 'react';
import { setState } from '../app.tsx';
import { Icon } from '../ui.tsx';

export function Welcome() {
  const [step, setStep] = useState(0);
  const finish = (h?: string) => setState((x) => ({ ...x, onboarded: true, prefs: { ...x.prefs, horizon: h ?? x.prefs.horizon } }));
  return <div className="welcome">
    <div className="k">Tripwire</div>
    {step === 0 ? <>
      <h1>See what <em className="ed">fired</em>.<br />Decide what matters.</h1>
      <p className="dim" style={{ fontSize: 17, margin: 0 }}>Public rules, run on the last close. The case and the countercase side by side. Your own decisions, with the date you promised to review them.</p>
      <div className="pts">
        <div><Icon n="signals" /><span>Ten plain rules over Nifty 500 names, with the figure that tripped each one.</span></div>
        <div><Icon n="note" /><span>A journal that keeps every version of your thinking, and reminds you to revisit it.</span></div>
        <div><Icon n="lock" /><span>No account needed. Your notes stay on this device.</span></div>
      </div>
      <button className="btn pri" style={{ height: 54 }} onClick={() => setStep(1)}>Continue</button>
      <button className="btn" onClick={() => finish()}>Explore as a guest</button>
    </> : <>
      <h1>How long do you <em className="ed">hold</em>?</h1>
      <p className="dim" style={{ margin: 0 }}>Optional. It only changes which wording Tripwire leads with. You can change or skip it any time in Profile.</p>
      <div className="pts">{['Days to weeks', 'Months', 'Years'].map((h) => <button key={h} className="btn" style={{ justifyContent: 'flex-start', height: 54 }} onClick={() => finish(h)}>{h}</button>)}</div>
      <button className="btn" onClick={() => finish()}>Skip</button>
    </>}
    <p className="mute small" style={{ margin: 0 }}>Paper analysis only. Not investment advice. No order is ever placed.</p>
  </div>;
}
