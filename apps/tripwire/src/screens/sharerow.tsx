import { useState } from 'react';
import { useJson } from '../data.ts';

interface Manifest { cards: { key: string; sym: string | null }[] }
const SITE = 'https://tripwire.askakshay.com';
/** Share actions for a ladder card (4.0, F8). Shown only when the build wrote a card for this pick (the manifest is a static file with no personal data). The text carries "paper only" and no call to act. */
export function ShareRow({ sym }: { sym: string | null }) {
  const m = useJson<Manifest>('/share/manifest.json'); const [msg, setMsg] = useState('');
  const key = sym == null ? 'book' : encodeURIComponent(sym);
  if (!m.data?.cards?.some((c) => c.key === key)) return null;
  const url = `${SITE}/share/${key}/`; const text = sym ? `${sym}: a paper pick on Tripwire, with its stop and targets. Paper only, not investment advice.` : 'The Tripwire paper book, every number traced to its events. Paper only, not investment advice.';
  const copy = () => { try { navigator.clipboard.writeText(url).then(() => setMsg('Link copied'), () => setMsg('Could not copy; select the link instead')); } catch { setMsg('Could not copy; select the link instead'); } };
  return <div className="share-row" role="group" aria-label="Share this card" data-share>
    <span className="small mute">Share the card</span>
    <a className="btn sm" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
    <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <button className="btn sm" type="button" onClick={copy}>Copy link</button>
    <span className="small mute" role="status" aria-live="polite">{msg}</span>
  </div>;
}
