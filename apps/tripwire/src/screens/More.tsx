import { useEffect, useState } from 'react';
import { Icon, useUi } from '../ui.tsx';
import { PageBar } from './common.tsx';
import { promptInstall, usePwa } from '../pwa.ts';
import { useScreen } from '../data.ts';
import { useLivePulse } from '../quotes.ts';
import { quoteWord } from '../stamp.ts';
import { freshness } from '../fresh.ts';
import { dayWord } from '../fmt.ts';

/** Menu: every destination that is not one of the three daily tabs, as a grouped list of big rows (icon, title, one-line note). Nothing here is a feature of its own;
 *  each row is a link to a page that already exists. 11 Nov 2026 (revamp v2): Signals left this list (it is the Book tab), and the app's state is one line at the
 *  top, so no page under Menu repeats it in its own header. Operations stays one link away, from Settings. */
interface Row { href: string; title: string; note: string; id: string; icon: string }
const GROUPS: { head: string; rows: Row[] }[] = [
  { head: 'Yours', rows: [
    { id: 'desk', href: '#/desk', icon: 'desk', title: 'My Desk', note: 'The companies you follow, your theses, journal and plans' },
  ] },
  { head: 'Research', rows: [
    { id: 'markets', href: '#/markets', icon: 'chart', title: 'Markets', note: 'Indices, commodities and the trend map' },
    { id: 'news', href: '#/news', icon: 'note', title: 'News', note: 'Headlines for the market, what you follow and your paper book' },
  ] },
  { head: 'About the data', rows: [
    { id: 'info', href: '#/info', icon: 'info', title: 'About and data', note: 'Data status, how the numbers are made, definitions, the fine print' },
    { id: 'data', href: '#/data', icon: 'clock', title: 'Data and coverage', note: 'How current each dataset is, and what it covers' },
    { id: 'methodology', href: '#/methodology', icon: 'check', title: 'Methodology', note: 'How picks and trends are worked out, and what the tests found' },
    { id: 'help', href: '#/help', icon: 'info', title: 'Help', note: 'How to use Tripwire' },
  ] },
  { head: 'Settings', rows: [
    { id: 'settings', href: '#/settings', title: 'Settings', icon: 'profile', note: 'Backup and restore, defaults, display, app lock' },
  ] },
  { head: 'Legal', rows: [
    { id: 'privacy', href: '#/privacy', icon: 'lock', title: 'Privacy', note: 'What stays on your device, and what the server is asked' },
    { id: 'terms', href: '#/terms', icon: 'flag', title: 'Terms of use', note: 'Not advice, no order placed, data can be late' },
  ] },
];

/** The app's state in one line: the close the screen carries, and the word for the newest index print (Live, Delayed, Last traded, Unavailable). */
export function MenuState() {
  const scr = useScreen(); const pulse = useLivePulse(); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);   // 12 Nov 2026 (Codex on #60): the price word ages with the clock, so a stale print never keeps reading Live
  const asOf = scr.data?.as_of; const fr = asOf ? freshness(asOf) : null;
  const word = pulse.loading ? null : quoteWord(pulse.obs, now);
  return <p className={`mn-state${fr && fr.word !== 'Current' ? ' behind' : ''}`} data-menu-state role="status">
    <span className="mn-dot" aria-hidden="true" />
    <span className="mn-line">{scr.loading ? 'Checking the data' : asOf ? <>Data through <b className="num">{dayWord(asOf)}</b></> : 'Data date unavailable'}<span className="mn-sep" aria-hidden="true"> · </span>Prices <b>{word ? word.toLowerCase() : 'checking'}</b></span>
  </p>;
}

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
  return <div className="mp mn" data-more>
    <PageBar title="Menu" />
    <MenuState />
    {GROUPS.map((g) => <section key={g.head} className="mn-g" aria-labelledby={`mn-${g.rows[0].id}`}><h2 className="mn-h" id={`mn-${g.rows[0].id}`}>{g.head}</h2>
      <div className="mn-list">{g.rows.map((r) => <a key={r.id} className="mn-row" href={r.href} data-more-row={r.id}>
        <span className="mn-ic" aria-hidden="true"><Icon n={r.icon} /></span>
        <span className="mn-tx"><span className="mn-t">{r.title}</span><span className="mn-n">{r.note}</span></span><Icon n="chev" className="mn-go" /></a>)}</div></section>)}
    <InstallHint />
    <p className="mn-about small mute" data-about><b>Experimental research beta.</b> Educational, not investment advice; every trade is a paper trade and no order is placed. <a href="#/info?s=legal">The fine print</a></p>
  </div>;
}
