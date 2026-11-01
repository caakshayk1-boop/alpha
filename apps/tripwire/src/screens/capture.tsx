import { useState } from 'react';
import { CAPTURE_LINE, DEFAULT_CAPTURE, IDENTITY_LINKS, captureReady, subscribe, validEmail, type CaptureConfig } from '../capture.ts';
import { Button } from '../components/index.ts';

/** The one email-capture module. With the flag off (the default) it is a hidden, empty placeholder: no field, no text, no network.
 *  No popup, no modal, nothing that appears by itself; the address is sent only when the person presses Subscribe. `source` says which page it sat on. */
export function CaptureModule({ source, cfg = DEFAULT_CAPTURE }: { source: string; cfg?: CaptureConfig }) {
  const [email, setEmail] = useState(''); const [state, setState] = useState<'idle' | 'busy' | 'done' | 'bad' | 'failed'>('idle');
  if (!captureReady(cfg)) return <section hidden aria-hidden="true" data-capture="off" />;
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!validEmail(email)) { setState('bad'); return; } setState('busy'); const r = await subscribe(email, source, cfg); setState(r.ok ? 'done' : 'failed'); };
  return <section className="ds-card capture" aria-labelledby={`cap-${source}`} data-capture="on">
    <h2 id={`cap-${source}`} className="capture-h">{CAPTURE_LINE}</h2>
    {state === 'done' ? <p role="status" className="capture-p">Thank you. Check your inbox to confirm.</p> : <form onSubmit={submit} noValidate>
      <label className="sr" htmlFor={`cap-e-${source}`}>Email address</label>
      <div className="capture-row"><input id={`cap-e-${source}`} className="field" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); if (state !== 'idle') setState('idle'); }} aria-invalid={state === 'bad' || undefined} aria-describedby={`cap-m-${source}`} />
        <Button variant="primary" type="submit" busy={state === 'busy'}>Subscribe</Button></div>
      <p id={`cap-m-${source}`} className="small mute capture-p" role="status">{state === 'bad' ? 'That does not look like an email address.' : state === 'failed' ? 'It did not go through. Nothing was saved; try again.' : 'Free. Research notes only, never advice. Unsubscribe in one tap.'}</p>
    </form>}
  </section>;
}

/** The identity footer: where the person behind Tripwire writes. A plain link; no tracking. */
export function IdentityFooter() {
  return <p className="small mute ident">Tripwire is paper-only research from {IDENTITY_LINKS.map((l, i) => <span key={l.href}>{i ? ' · ' : ''}<a href={l.href} rel="noopener" target="_blank">{l.label}</a></span>)}.</p>;
}
