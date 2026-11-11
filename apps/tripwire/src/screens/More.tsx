import { useState } from 'react';
import { Icon, useUi } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';
import { promptInstall, usePwa } from '../pwa.ts';

/** More: every destination that is not one of the three daily ones, as a plain list. Nothing here is a feature of its own; each row is a link to a page that already exists. */
interface Row { href: string; title: string; note: string; id: string }
const GROUPS: { head: string; rows: Row[] }[] = [
  { head: 'Yours', rows: [
    { id: 'desk', href: '#/desk', title: 'My Desk', note: 'The companies you follow, your theses, journal and plans' },
  ] },
  { head: 'Research', rows: [
    { id: 'signals', href: '#/signals', title: 'Signals', note: 'The rules that fired at the last close, your paper trades and the record' },
    { id: 'markets', href: '#/markets', title: 'Markets', note: 'Indices, commodities and the trend map' },
    { id: 'news', href: '#/news', title: 'News', note: 'Headlines for the market, what you follow and your paper book' },
  ] },
  { head: 'Understand', rows: [
    { id: 'data', href: '#/data', title: 'Data and coverage', note: 'How current each dataset is, and what it covers' },
    { id: 'methodology', href: '#/methodology', title: 'Methodology and evidence', note: 'How picks and trends are worked out, and what the tests found' },
    { id: 'help', href: '#/help', title: 'Help', note: 'How to use Tripwire' },
    { id: 'privacy', href: '#/privacy', title: 'Privacy', note: 'What stays on your device, and what the server is asked' },
    { id: 'terms', href: '#/terms', title: 'Terms of use', note: 'Paper only, not advice, no order placed' },
  ] },
  { head: 'This device', rows: [
    { id: 'settings', href: '#/settings', title: 'Settings', note: 'Stored on this device only: backup and restore, defaults, privacy, app lock' },
  ] },
];

/** Install guidance. Shown only when it can help: never when the app is already installed, and no promise the browser has not made. */
export function InstallHint() {
  const p = usePwa(); const { toast } = useUi(); const [busy, setBusy] = useState(false);
  if (p.standalone) return null;
  if (p.canPrompt) return <section className="card" aria-label="Install Tripwire" data-install="prompt">
    <b>Install Tripwire</b><p className="small dim" style={{ margin: '4px 0 10px' }}>Opens in its own window from your home screen or app list. Your notes stay on this device either way.</p>
    <button className="btn pri" disabled={busy} onClick={async () => { setBusy(true); const r = await promptInstall(); setBusy(false); if (r === 'dismissed') toast('Not installed. You can install later from here.'); }}>Install</button></section>;
  if (p.ios) return <section className="card" aria-label="Install Tripwire" data-install="ios">
    <b>Add to your home screen</b>
    <p className="small dim" style={{ margin: '4px 0 0' }}>In Safari, tap <b>Share</b> <Icon n="share" className="inl" />, then <b>Add to Home Screen</b>. It then opens in its own window. Your notes stay on this device.</p></section>;
  return null;
}

export function More() {
  return <div data-more>
    <PageBar title="More" sub="Everything else, in one list" />
    {GROUPS.map((g) => <section key={g.head} aria-label={g.head}><Head>{g.head}</Head>
      <div className="card" style={{ padding: '2px 14px' }}><div className="list">{g.rows.map((r) => <a key={r.id} className="li more-row" href={r.href} data-more-row={r.id}>
        <span className="grow"><span className="more-t">{r.title}</span><span className="small dim more-n">{r.note}</span></span><Icon n="chev" className="more-go" /></a>)}</div></div></section>)}
    <InstallHint />
    <section aria-label="About"><Head>About</Head>
      <div className="card small dim" data-about><p style={{ marginTop: 0 }}><b style={{ color: 'var(--tx)' }}>Experimental, closed research beta.</b> Tripwire shows which public rules fired at the last close and the evidence on each side. It is educational research, not investment advice. Every trade in it is a paper trade: no order is ever placed, and paper results are not real results.</p>
        <p style={{ marginBottom: 0 }}>No account, no tracking, no analytics. Your notes stay on this device.</p></div></section>
  </div>;
}
