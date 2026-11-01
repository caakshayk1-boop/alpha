// Pills: small labels. Two kinds, and they are not interchangeable.
//   Pill        quiet, neutral: a tier, a sector, an engine. Says what something IS.
//   StatusPill  a state with a word AND an icon, tinted --up / --down / --amber: says how something IS DOING. Colour is never the only carrier.
// SessionPill and GatePill are the two status pills the shell and Today use. Both read data that already exists and render nothing when it is absent.
import type { ReactNode } from 'react';
import { Icon } from '../ui.tsx';
import { freshness } from '../fresh.ts';
import { dayWord } from '../fmt.ts';
import { useSignals } from '../data.ts';
import { gateLine } from './gate.ts';

/** `<Pill>Small cap</Pill>`, quiet, for tier, sector, engine. */
export function Pill({ children, title, className = '' }: { children: ReactNode; title?: string; className?: string }) {
  return <span className={`ds-pill ${className}`} title={title}>{children}</span>;
}

export type Tone = 'up' | 'down' | 'amber' | 'neutral';
const TONE_ICON: Record<Tone, string> = { up: 'check', down: 'x', amber: 'clock', neutral: 'minus' };
/** `<StatusPill tone="amber" icon="alert">Behind</StatusPill>`. Always give it words. Amber is for staleness and warnings only. */
export function StatusPill({ tone = 'neutral', icon, children, title, className = '' }: { tone?: Tone; icon?: string; children: ReactNode; title?: string; className?: string }) {
  return <span className={`ds-pill ds-status ${tone} ${className}`} title={title}><Icon n={icon ?? TONE_ICON[tone]} />{children}</span>;
}

/** How many sessions behind the screen is, compact, for the top bar and in-line use, in the words the page already uses (Current, Build due, One session behind, Behind, Unknown).
 *  The fuller 'Data through … · built …' pill with the file-by-file detail is screens/FreshnessPill.tsx (restyled in foundation.css, wording unchanged). `<SessionPill asOf={screen.data?.as_of} />`
 *  With `showDay` it also names the close the data stops at. Stale reads amber with words; current reads green. `undefined` (not loaded yet) holds its space with no layout shift; `null` (loaded, no date) says Unknown. */
export function SessionPill({ asOf, showDay = false, className = '' }: { asOf?: string | null; showDay?: boolean; className?: string }) {
  if (asOf === undefined) return <span className={`ds-pill ds-status ds-hold ${className}`} aria-hidden="true" />;
  const f = freshness(asOf);
  const tone: Tone = f.behind === 0 ? 'up' : f.pending ? 'neutral' : 'amber';
  const icon = f.pending ? 'clock' : f.behind === 0 ? 'check' : f.behind === null ? 'alert' : f.behind === 1 ? 'clock' : 'alert';
  const title = `Screen data is from the close of ${dayWord(asOf)}${f.behind ? `, ${f.behind === 1 ? 'one session' : `${f.behind} sessions`} behind the last finished one` : ''}.`;
  return <StatusPill tone={tone} icon={icon} title={title} className={`ds-fresh ${className}`}>{showDay ? <><span>{f.label}</span><span className="ds-fresh-day">{dayWord(asOf)}</span></> : f.label}</StatusPill>;
}

/** The compact gate state for the top bar: "Gate OFF · 1/4", a link to the Signals page. Renders nothing when the signals feed or its gate is absent: it never guesses. */
export function GatePill({ className = '' }: { className?: string }) {
  const sig = useSignals(); const g = gateLine(sig.data);
  if (!g) return null;
  return <a href="#/signals" className={`ds-pill ds-status ds-gate ${g.on ? 'up' : 'neutral'} ${className}`} title={g.text} aria-label={g.text}><Icon n={g.on ? 'check' : 'lock'} />{g.short}</a>;
}
