'use client';
/** Three small Today widgets, each a doorway to the page that owns the detail: sector rotation (/rotation/), the week in the
 *  brief (/brief/) and a position sizer (/tools/). Each reads a feed the site already publishes; nothing is estimated. */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chg, Rv, Skel } from '@/components/ui';
import { useFeed, useRotation } from '@/lib/data';
import { num, pct } from '@/lib/format';
import { rotationShift } from '@/lib/rotationShift';
import { companyHref } from '@/lib/slug';
import { useBarometer } from '@/lib/useBarometer';

export function RotationWidget() {
  const r = useRotation();
  const s = useMemo(() => (r.data ? rotationShift(r.data, 4) : []), [r.data]);
  const top = s.slice(0, 3), bottom = s.slice(-3).reverse();
  const max = Math.max(1, ...s.map((x) => Math.abs(x.shift)));
  const row = (x: (typeof s)[number]) => (
    <li key={x.name}><span className="rw-n">{x.name}</span><span className="rw-bar"><i className={x.shift >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(x.shift) / max) * 100}%` }} /></span><Chg v={x.shift} dp={1} /></li>
  );
  return (
    <Rv className="panel tight xw">
      <div className="tr-h"><h2>Rotation · 4 weeks</h2><Link href="/rotation/" className="more">All groups →</Link></div>
      {!r.data ? <Skel h={150} /> : (
        <>
          <div className="eyebrow">Gaining strength against the Nifty</div><ul className="rw">{top.map(row)}</ul>
          <div className="eyebrow" style={{ marginTop: 8 }}>Losing strength</div><ul className="rw">{bottom.map(row)}</ul>
        </>
      )}
    </Rv>
  );
}

export function BriefDigest() {
  const p = useFeed('pulse');
  const baro = useBarometer().view;
  const up = (p.data?.movers_up ?? []).slice(0, 3), dn = (p.data?.movers_dn ?? []).slice(0, 3);
  return (
    <Rv className="panel tight xw">
      <div className="tr-h"><h2>The week</h2><Link href="/brief/" className="more">The brief →</Link></div>
      {baro?.reading.stage?.t && <p className="xw-lead">Valuation: <b>{baro.reading.stage.t.toLowerCase()}</b> · Barometer {Math.round(baro.reading.score)}/100</p>}
      {!p.data ? <Skel h={120} /> : (
        <div className="xw-cols">
          <div><div className="eyebrow">Biggest gains</div><div className="xw-list">{up.map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="xw-li"><span className="t">{m.sym}</span><Chg v={m.r1w} dp={0} /></Link>)}</div></div>
          <div><div className="eyebrow">Biggest falls</div><div className="xw-list">{dn.map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="xw-li"><span className="t">{m.sym}</span><Chg v={m.r1w} dp={0} /></Link>)}</div></div>
        </div>
      )}
    </Rv>
  );
}

export function QuickSizer() {
  const [cap, setCap] = useState('500000'), [risk, setRisk] = useState('1'), [entry, setEntry] = useState(''), [stop, setStop] = useState('');
  const C = Number(cap) || 0, R = Number(risk) || 0, E = Number(entry) || 0, S = Number(stop) || 0;
  const per = E - S;
  const qty = per > 0 && C > 0 && R > 0 ? Math.floor((C * R / 100) / per) : 0;
  const clean = (v: string) => v.replace(/[^\d.]/g, '').slice(0, 12);
  return (
    <Rv className="panel tight xw">
      <div className="tr-h"><h2>Size a trade</h2><Link href="/tools/" className="more">All tools →</Link></div>
      <div className="qs">
        <label>Capital ₹<input className="field" inputMode="numeric" value={cap} onChange={(e) => setCap(clean(e.target.value))} /></label>
        <label>Risk %<input className="field" inputMode="decimal" value={risk} onChange={(e) => setRisk(clean(e.target.value))} /></label>
        <label>Entry ₹<input className="field" inputMode="decimal" value={entry} placeholder="e.g. 173.7" onChange={(e) => setEntry(clean(e.target.value))} /></label>
        <label>Stop ₹<input className="field" inputMode="decimal" value={stop} placeholder="e.g. 165" onChange={(e) => setStop(clean(e.target.value))} /></label>
      </div>
      <p className="qs-out num" aria-live="polite">{qty > 0 ? <><b>{num(qty)}</b> shares ≈ ₹{num(qty * E, 0)} ({pct(((qty * E) / C * 100), 0, false)} of capital) · a stop-out costs ₹{num(qty * per, 0)}</> : per <= 0 && E && S ? 'The stop must be below the entry.' : 'Enter an entry and a stop.'}</p>
    </Rv>
  );
}
