import { QuestionOrb } from '../components/QuestionOrb.tsx';
import { prefetchScreens } from '../prefetch.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { go, setState } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Icon } from '../ui.tsx';
import { trendOf, type Row } from '../screen.ts';
import { dayWord, inr, pct } from '../fmt.ts';

/** First use: choose ONE company, read its case and countercase on the company page, optionally save a thought there. Nothing is followed for the person.
 *  Explore markets leaves with nothing chosen. The company list and the sample card are the real screen, never a made-up example.
 *  The page around that is the landing: a hero, an evidence card built from a real company in today's screen, why it is different, how it works, and what it is built on. Motion is CSS only and
 *  follows the app's motion setting (html.fx); with motion off, or reduced, every section is simply there. */
const SAMPLE = ['TCS', 'INFY', 'HDFCBANK', 'RELIANCE', 'ITC'];
const TREND_WORD = { up: 'Uptrend', down: 'Downtrend', mixed: 'Sideways' } as const;

/** Adds `in` to each `.lp-rv` as it scrolls into view. Without IntersectionObserver every section is shown at once. */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>('.lp-rv') ?? [])];
    if (typeof IntersectionObserver !== 'function') { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach((e) => io.observe(e)); return () => io.disconnect();
  }, [root]);
}

/** The facts for the sample card, each read from the company's own screen row. A figure the row does not carry is left out, never filled in. */
export function sampleFacts(r: Row): { k: string; v: string; tone?: 'up' | 'down' }[] {
  const out: { k: string; v: string; tone?: 'up' | 'down' }[] = []; const t = trendOf(r).trend;
  if (t) out.push({ k: 'Trend', v: TREND_WORD[t], tone: t === 'up' ? 'up' : t === 'down' ? 'down' : undefined });
  if (typeof r.r3m === 'number') out.push({ k: '3 months', v: pct(r.r3m), tone: r.r3m >= 0 ? 'up' : 'down' });
  if (typeof r.piotroski === 'number') out.push({ k: 'Financial health', v: `${r.piotroski} of 9` });
  if (typeof r.roce_med === 'number') out.push({ k: 'Return on capital', v: `${r.roce_med.toFixed(0)}%` });
  if (typeof r.de === 'number') out.push({ k: 'Debt to equity', v: r.de.toFixed(2) });
  return out.slice(0, 4);
}

export function Welcome({ unreadable = false }: { unreadable?: boolean }) {
  const scr = useScreen(); const [q, setQ] = useState(''); const root = useRef<HTMLElement | null>(null); useReveal(root);
  const t = q.trim().toLowerCase();
  const hits = useMemo(() => (t.length < 1 ? [] : (scr.data?.rows ?? []).filter((r) => r.sym.toLowerCase().startsWith(t) || r.name.toLowerCase().includes(t)).slice(0, 6)), [t, scr.data]);
  const sample = useMemo(() => { const rows = scr.data?.rows ?? []; for (const s of SAMPLE) { const r = rows.find((x) => x.sym === s && typeof x.price === 'number'); if (r && sampleFacts(r).length >= 3) return r; } return null; }, [scr.data]);
  const leave = () => setState((x) => ({ ...x, onboarded: true }));
  const choose = (sym: string) => { go(`/c/${encodeURIComponent(sym)}?first=1`); leave(); };
  const toSearch = () => { document.getElementById('wl-q')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: document.documentElement.classList.contains('fx') ? 'smooth' : 'auto' }); };
  return <main className="welcome lp" id="main" ref={root} onPointerDownCapture={prefetchScreens} onFocusCapture={prefetchScreens}>
    {unreadable && <div className="banner" role="alert" style={{ position: 'static', margin: 0 }}>Saved data on this device could not be read. A copy was kept and nothing was erased. Choose Explore markets, then import a backup from Settings to restore your notes.</div>}
    <section className="lp-hero" aria-labelledby="lp-h">
      <div className="lp-copy">
        <div className="k lp-eyebrow"><span className="lp-mark" aria-hidden="true" />Tripwire · research for Indian stocks · by Akshay, CA</div>
        <h1 id="lp-h">Start with one company.</h1>
        <p className="lp-sub">Understand an Indian company. See the evidence for it, the risks against it, and build your own view.</p>
        <form className="wl-find" role="search" onSubmit={(e) => { e.preventDefault(); if (hits[0]) choose(hits[0].sym); }}>
          <label className="l" htmlFor="wl-q">Company name or symbol</label>
          <div className="search"><Icon n="search" /><input id="wl-q" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example TCS or Infosys" autoComplete="off" autoCapitalize="none" spellCheck={false} /></div>
          {scr.loading && <p className="small dim" style={{ margin: '8px 0 0' }}>Reading the company list…</p>}
          {scr.err && <p className="small down" role="alert" style={{ margin: '8px 0 0' }}>The company list could not be loaded ({scr.err}). You can still explore markets and search later.</p>}
          <p className="sr" role="status" aria-live="polite">{t && scr.data ? `${hits.length} ${hits.length === 1 ? 'company matches' : 'companies match'}` : ''}</p>
          {hits.length > 0 && <div className="list wl-hits">{hits.map((r) => <button type="button" key={r.sym} className="li" style={{ textAlign: 'left' }} onClick={() => choose(r.sym)}><span className="avatar" aria-hidden="true">{r.sym.slice(0, 2)}</span><span className="grow"><span className="sym">{r.sym}</span><span className="small dim trunc" style={{ display: 'block' }}>{r.name}</span></span><Icon n="chev" /></button>)}</div>}
          {t && scr.data && hits.length === 0 && <p className="dim small" style={{ margin: '8px 0 0' }}>No company matches “{q.trim()}”. Try a name or symbol from the published company screen.</p>}
        </form>
        {!t && <div className="wl-examples" aria-label="Example companies">{['TCS', 'INFY', 'RELIANCE'].filter((sym) => scr.data?.rows.some((r) => r.sym === sym)).map((sym) => <button key={sym} className="chip" onClick={() => choose(sym)}>{sym}<Icon n="chev" /></button>)}</div>}
        <div className="wl-out"><button className="btn" onClick={() => { go('/markets'); leave(); }}>Explore markets</button></div>
        <ul className="lp-pills" aria-label="What to expect"><li>No account</li><li>Notes stay on this device</li><li>Paper analysis only</li></ul>
      </div>
      {sample && <aside className="lp-card" aria-label={`A real example: ${sample.name}`}>
        <div className="lp-card-top"><span className="avatar" aria-hidden="true">{sample.sym.slice(0, 2)}</span><span className="grow"><b className="sym">{sample.sym}</b><span className="small dim trunc" style={{ display: 'block' }}>{sample.name}{sample.sector ? ` · ${sample.sector}` : ''}</span></span><span className="lp-live small"><i aria-hidden="true" />From the screen</span></div>
        <div className="lp-price num">{inr(sample.price)}<span className="small dim"> close of {dayWord(scr.data?.as_of)}</span></div>
        <dl className="lp-facts">{sampleFacts(sample).map((f) => <div key={f.k}><dt>{f.k}</dt><dd className={`num ${f.tone ?? ''}`}>{f.v}</dd></div>)}</dl>
        <div className="lp-ask"><QuestionOrb label={`Explore questions about ${sample.sym}`} expanded={false} onClick={() => choose(sample.sym)} /><span className="small dim">Start with a fact.<br />Find your next question.</span></div>
        <p className="small mute lp-card-note">Every claim on a company page is a figure like these, with the rule that judged it and the date it is from. Missing data is shown as missing.</p>
        <button type="button" className="btn pri lp-card-go" onClick={() => choose(sample.sym)}>Read the full evidence<Icon n="chev" /></button>
      </aside>}
    </section>

    <section className="lp-sec lp-rv" aria-labelledby="lp-why">
      <h2 id="lp-why" className="lp-h2">Built to be checked, not believed</h2>
      <div className="lp-grid3">
        <article className="lp-tile"><span className="lp-ic" aria-hidden="true">01</span><h3>The case, and the case against</h3><p>Every company shows what supports it and what counts against it, side by side, with the figure behind each claim.</p></article>
        <article className="lp-tile"><span className="lp-ic" aria-hidden="true">02</span><h3>Honest about what it does not know</h3><p>A missing number is shown as missing. A weak back-test is labelled weak. Nothing is dressed up to look certain.</p></article>
        <article className="lp-tile"><span className="lp-ic" aria-hidden="true">03</span><h3>Your view, in writing</h3><p>Write a short thesis, what would prove you wrong, and a date to review it. Then come back and see what changed.</p></article>
      </div>
    </section>

    <section className="lp-sec lp-rv" aria-labelledby="lp-how">
      <h2 id="lp-how" className="lp-h2">How it works</h2>
      <ol className="lp-steps">
        <li><b>Find a company.</b><span>Search any of the {scr.data ? scr.data.count.toLocaleString('en-IN') : 'listed'} companies in the screen, or open a market view.</span></li>
        <li><b>Read the evidence.</b><span>Trend, quality, valuation and ownership, each stated with its rule and its date. Compare two companies side by side.</span></li>
        <li><b>Write your view.</b><span>Save a thesis and a review date. Follow the company and Tripwire shows what changed since you last looked.</span></li>
      </ol>
    </section>

    <section className="lp-sec lp-band lp-rv" aria-labelledby="lp-trust">
      <h2 id="lp-trust" className="lp-h2">What it is built on</h2>
      <p className="lp-trust-copy">{scr.data ? `${scr.data.count.toLocaleString('en-IN')} companies, with data through the close of ${dayWord(scr.data.as_of)}. ` : ''}Prices come from Yahoo Finance and refresh during market hours; the screen is rebuilt after each close. The method, its tests and its weak results are public.</p>
      <div className="lp-links"><a href="#/methodology">Methodology and evidence</a><a href="#/data">Data and coverage</a><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a></div>
      <button type="button" className="btn pri lp-cta" onClick={toSearch}>Start with a search<Icon n="search" /></button>
    </section>

    <p className="mute small lp-foot">No account needed. Notes stay on this device. Paper analysis only: not investment advice, and no order is ever placed.</p>
  </main>;
}
