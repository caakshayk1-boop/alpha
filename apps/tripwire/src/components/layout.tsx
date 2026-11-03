// Layout components of the design foundation. Each has a one-line usage note. Styles: foundation.css (nothing moves there; motion is motion.css, under html.fx).
import { createElement, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '../ui.tsx';
import { useSignals } from '../data.ts';
import { gateLine } from './gate.ts';
import { useTween } from './tween.ts';

/** A title, one plain line under it, and an optional action on the right. `<SectionHeader title="Fired at the last close" description="Rules that fired on the 26 Oct close." action={<a href="#/signals">All</a>} />`
 *  `level` is 2 for a section and 3 for a sub-section; a view's one h1 is the page bar, never this. */
export function SectionHeader({ title, description, action, level = 2, id }: { title: string; description?: string; action?: ReactNode; level?: 2 | 3; id?: string }) {
  return <div className="ds-sh"><div>{createElement(`h${level}`, { id }, title)}{description && <p>{description}</p>}</div>{action && <div className="act">{action}</div>}</div>;
}

/** Nothing to show, said honestly: an icon, one sentence, at most one action. `<EmptyState icon="inbox" action={<Button variant="secondary">Open Discover</Button>}>No rules fired at the last close. The gate is doing its job.</EmptyState>` */
export function EmptyState({ icon = 'info', children, action }: { icon?: string; children: ReactNode; action?: ReactNode }) {
  return <div className="ds-empty"><span className="ico"><Icon n={icon} /></span><p>{children}</p>{action}</div>;
}

/** A placeholder for a region whose data is on its way. Reserve the real size (h, w) so nothing shifts when it arrives; it shimmers only when motion is on.
 *  `<SkeletonBlock h={96} />` or `<SkeletonBlock lines={3} />`. Announced once as busy, never as content. */
export function SkeletonBlock({ h = 16, w = '100%', lines = 1, label = 'Loading' }: { h?: number; w?: number | string; lines?: number; label?: string }) {
  return <div aria-busy="true" aria-label={label} role="status">{Array.from({ length: lines }, (_, i) => <span key={i} className="ds-skel" style={{ height: h, width: lines > 1 && i === lines - 1 ? '62%' : w, marginBottom: i < lines - 1 ? 10 : 0 }} />)}</div>;
}

/** One big figure and its label. `<RecordStat value="42%" label="Win rate" tone="up" note="12 closed" />` Missing is the word for missing, never a zero: pass value={null}. */
export function RecordStat({ value, label, tone, note }: { value: ReactNode | null; label: string; tone?: 'up' | 'down'; note?: string }) {
  return <div className="ds-stat"><span className={`v num ${tone ?? ''}`}>{value ?? 'Not yet'}</span><span className="l">{label}</span>{note && <span className="n">{note}</span>}</div>;
}
/** Row of RecordStats that wraps on a phone: `<RecordStats>…</RecordStats>` */
export function RecordStats({ children }: { children: ReactNode }) { return <div className="ds-stats">{children}</div>; }

/** A headline figure that glides to a new value when motion is on and is simply the value when it is off. `<TweenNumber value={pnl} format={(n) => n.toFixed(2)} />` */
export function TweenNumber({ value, format = (n: number) => String(Math.round(n)), ms = 600 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const v = useTween(value, ms); return <span className="num">{format(v)}</span>;
}

/** Card is a flat surface with a hairline; CardRaised adds the one raised shadow and the soft gradient. `interactive` steps the surface up on hover.
 *  `<Card>…</Card>`, `<CardRaised as="a" href="#/c/TCS" interactive>…</CardRaised>` */
export type CardProps = { children?: ReactNode; raised?: boolean; interactive?: boolean; as?: 'div' | 'section' | 'article' | 'a'; className?: string } & Record<string, unknown>;
export function Card({ children, raised = false, interactive = false, as = 'div', className = '', ...rest }: CardProps) {
  return createElement(as, { className: `ds-card ${raised ? 'raised' : ''} ${interactive ? 'ds-hover' : ''} ${className}`.replace(/\s+/g, ' ').trim(), ...rest }, children);
}
export function CardRaised(p: Omit<CardProps, 'raised'>) { return <Card {...p} raised />; }

/** Buttons: primary (the accent, one per view), secondary (default), quiet (text-weight). `busy` shows the one place a spinner-like state is allowed: inside the button, as a word.
 *  `<Button variant="primary" onClick={…}>Take paper trade</Button>` Always at least 44px tall. */
export function Button({ variant = 'secondary', busy = false, children, className = '', ...rest }: { variant?: 'primary' | 'secondary' | 'quiet'; busy?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = variant === 'primary' ? 'pri' : variant === 'quiet' ? 'quiet' : 'sec';
  return <button type="button" {...rest} className={`btn ${v} ${className}`.trim()} aria-busy={busy || undefined} disabled={rest.disabled || busy}>{busy ? 'Working…' : children}</button>;
}

/** The market checks behind the Signals gate, each with the figures it was judged on, from the feed the app already holds. Renders nothing without a gate: it never guesses.
 *  The legacy feed's market filter is separate from the factor engines and their statistical validation. `<GatePanel />` */
export function GatePanel() {
  const sig = useSignals(); const g = gateLine(sig.data);
  if (!g) return null;
  return <section className="card gatepanel" data-gate-panel aria-labelledby="gp-h">
    <div className="row between"><h2 id="gp-h" className="sec" style={{ margin: 0 }}>Market checks</h2><span className={`ds-pill ds-status ${g.on ? 'up' : 'neutral'}`}><Icon n={g.on ? 'check' : 'lock'} />{g.on ? 'Market supportive' : 'Market cautious'} · {g.passed}/{g.total}</span></div>
    <p className="gp-plain">{g.plain}</p>
    <ul className="gp-list">{g.checks.map((c) => <li key={c.rule} className={c.ok ? 'ok' : 'no'}><span className="gp-mark" aria-hidden="true"><Icon n={c.ok ? 'check' : 'x'} /></span><span className="gp-rule">{c.rule}<span className="sr">{c.ok ? ': holds' : ': does not hold'}</span></span>{c.value && <b className="gp-val num">{c.value}</b>}</li>)}</ul>
    {g.holdout && <p className="small dim" style={{ margin: '8px 0 0' }}>Statistical validation is separate: the holdout month-clustered t is {g.holdout.t < 0 ? '−' : ''}{Math.abs(g.holdout.t).toFixed(2)} and needs +{g.holdout.needs.toFixed(1)}.</p>}
    <p className="small mute" style={{ margin: '8px 0 0' }}>These checks describe the published market snapshot. The factor engines' paper picks and statistical validation are separate. Each rule's results are under Evidence.</p>
  </section>;
}
