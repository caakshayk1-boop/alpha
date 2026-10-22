'use client';
/** The waitlist form, used on /pro/ and in the slim strip on Today. It asks the server whether the list is open first; it never
 *  shows a success the server did not send. A hidden field catches form-filling bots (the server drops those quietly). */
import { useEffect, useId, useState } from 'react';

type State = { kind: 'idle' | 'busy' | 'ok' | 'err' | 'closed'; text?: string };
export function WaitlistForm({ source, compact = false }: { source: 'pro' | 'home' | 'footer'; compact?: boolean }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [st, setSt] = useState<State>({ kind: 'idle' });
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/waitlist', { cache: 'no-store' }).then((r) => r.json()).then((d) => setOpen(!!d.open), () => setOpen(false)); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (st.kind === 'busy') return;
    setSt({ kind: 'busy' });
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, source, referrer: document.referrer || null, website: hp }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setSt({ kind: 'ok', text: d.message }); setEmail(''); }
      else setSt({ kind: r.status === 503 ? 'closed' : 'err', text: d.error ?? 'Something went wrong. Nothing was stored.' });
    } catch { setSt({ kind: 'err', text: 'Could not reach the server. Nothing was stored.' }); }
  };
  if (open === false && st.kind !== 'ok') return <p className="state" role="status" style={{ margin: 0 }}><b>The waitlist opens shortly.</b> <span className="dim">Sign-ups are not being taken yet, so nothing can be stored. This page will take your email as soon as it opens.</span></p>;
  return (
    <form className={`wl${compact ? ' wl-compact' : ''}`} onSubmit={submit} noValidate>
      <label htmlFor={`${id}-e`} className="sr">Email address</label>
      <input id={`${id}-e`} className="field" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={open === null} aria-describedby={`${id}-s`} />
      <input className="wl-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
      <button type="submit" className="act primary" disabled={open === null || st.kind === 'busy' || email.trim().length < 5}>{st.kind === 'busy' ? 'Joining…' : 'Join the waitlist'}</button>
      <p id={`${id}-s`} role="status" className={`wl-msg ${st.kind === 'err' || st.kind === 'closed' ? 'warn' : 'dim'}`}>{st.text ?? ''}</p>
    </form>
  );
}
