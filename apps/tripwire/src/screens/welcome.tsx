import { useMemo, useState } from 'react';
import { go, setState } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Icon } from '../ui.tsx';

/** First use: choose ONE company, read its case and countercase on the company page, optionally save a thought there. Nothing is followed for the person.
 *  Skip and the guest door both leave with nothing chosen. The company list is the real screen, never a made-up example. */
export function Welcome({ unreadable = false }: { unreadable?: boolean }) {
  const scr = useScreen(); const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const hits = useMemo(() => (t.length < 1 ? [] : (scr.data?.rows ?? []).filter((r) => r.sym.toLowerCase().startsWith(t) || r.name.toLowerCase().includes(t)).slice(0, 6)), [t, scr.data]);
  const leave = () => setState((x) => ({ ...x, onboarded: true }));
  const choose = (sym: string) => { go(`/c/${encodeURIComponent(sym)}?first=1`); leave(); };
  return <main className="welcome" id="main">
    {unreadable && <div className="banner" role="alert" style={{ position: 'static', margin: 0 }}>Saved data on this device could not be read. A copy was kept and nothing was erased. Choose Explore markets, then import a backup from Settings to restore your notes.</div>}
    <div className="k">Tripwire</div>
    <h1>Start with one company.</h1>
    <p className="dim" style={{ fontSize: '0.9688rem', margin: 0 }}>Understand an Indian company. See the evidence for it, the risks against it, and build your own view.</p>
    <form className="wl-find" role="search" onSubmit={(e) => { e.preventDefault(); if (hits[0]) choose(hits[0].sym); }}>
      <label className="l" htmlFor="wl-q">Company name or symbol</label>
      <div className="search"><Icon n="search" /><input id="wl-q" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example TCS or Infosys" autoComplete="off" autoCapitalize="none" spellCheck={false} /></div>
      {scr.loading && <p className="small dim" style={{ margin: '8px 0 0' }}>Reading the company list…</p>}
      {scr.err && <p className="small down" role="alert" style={{ margin: '8px 0 0' }}>The company list could not be loaded ({scr.err}). You can still explore markets and search later.</p>}
      <p className="sr" role="status" aria-live="polite">{t && scr.data ? `${hits.length} ${hits.length === 1 ? 'company matches' : 'companies match'}` : ''}</p>
      {hits.length > 0 && <div className="list wl-hits">{hits.map((r) => <button type="button" key={r.sym} className="li" style={{ textAlign: 'left' }} onClick={() => choose(r.sym)}><span className="avatar" aria-hidden="true">{r.sym.slice(0, 2)}</span><span className="grow"><b>{r.sym}</b><span className="dim small trunc" style={{ display: 'block' }}>{r.name}{r.sector ? ` · ${r.sector}` : ''}</span></span></button>)}</div>}
      {t && scr.data && hits.length === 0 && <p className="dim small" style={{ margin: '8px 0 0' }}>No company matches “{q.trim()}”. Try a name or symbol from the published company screen.</p>}
    </form>
    {!t && <div className="wl-examples" aria-label="Example companies">{['TCS', 'INFY', 'RELIANCE'].filter((sym) => scr.data?.rows.some((r) => r.sym === sym)).map((sym) => <button key={sym} className="chip" onClick={() => choose(sym)}>{sym}<Icon n="chev" /></button>)}</div>}
    <div className="wl-out"><button className="btn" onClick={() => { go('/markets'); leave(); }}>Explore markets</button></div>
    <p className="mute small" style={{ margin: 0 }}>No account needed. Notes stay on this device. Paper analysis only: not investment advice, and no order is ever placed. <a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a></p>
  </main>;
}
