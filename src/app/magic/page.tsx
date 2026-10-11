'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { num, pct } from '@/lib/format';

export default function Magic() {
  const s = useFeed('screen');
  const [limit, setLimit] = useState(50);
  const ranked = useMemo(() => (s.data?.rows ?? []).filter((r) => typeof r.mf?.rank === 'number').sort((a, b) => (a.mf!.rank as number) - (b.mf!.rank as number)), [s.data]);
  const mf = s.data?.magic_formula;
  return (
    <>
      <PageHead eyebrow="Magic Formula" title="Greenblatt’s ranking," em="every company." lede="Each company is ranked on return on capital and on earnings yield, the two ranks are added, and the lowest total comes first. Shown with the rules, the exclusions and the places this implementation differs from the book." />
      <section className="wrap">
        <Async loading={s.loading} error={s.error}>
          {mf && (
            <Rv className="panel" >
              <div className="grid g3">
                <div><div className="eyebrow">Ranked</div><div className="disp" style={{ fontSize: 56 }}>{num(mf.ranked)}</div><div className="dim">of {num(mf.universe)} screened</div></div>
                <div><div className="eyebrow">How it works</div><p className="muted" style={{ margin: '12px 0 0' }}>{mf.rules.roc}. {mf.rules.ey}. {mf.rules.combine}.</p></div>
                <div><div className="eyebrow">Source</div><p className="muted" style={{ margin: '12px 0 0' }}>{mf.rules.source}</p></div>
              </div>
            </Rv>
          )}
          <div style={{ height: 24 }} />
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Company</th><th>Rank</th><th>ROCE</th><th>ROC rank</th><th>Earnings yield</th><th>EY rank</th><th>Price</th><th>1Y</th></tr></thead><tbody>
            {ranked.slice(0, limit).map((r) => (
              <tr key={r.sym} onClick={() => { window.location.href = `/company/?s=${r.sym}`; }}>
                <td><div className="co"><b>{r.sym}</b><span>{r.name}</span></div></td>
                <td className="num"><b>{r.mf!.rank}</b></td>
                <td className="num">{pct(r.mf!.roc ?? null, 1, false)}</td><td className="num dim">{r.mf!.roc_rank}</td>
                <td className="num">{pct(r.mf!.ey ?? null, 1, false)}</td><td className="num dim">{r.mf!.ey_rank}</td>
                <td className="num">₹{num(r.price, 2)}</td>
                <td className={`num ${(r.r1y ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(r.r1y, 1)}</td>
              </tr>
            ))}
          </tbody></table></div>
          {limit < ranked.length && <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn ghost" onClick={() => setLimit((n) => n + 100)}>Show 100 more</button></div>}
          {mf && (
            <div className="grid g2" style={{ marginTop: 32 }}>
              <div className="panel"><div className="eyebrow">Excluded, and why</div><ul className="muted" style={{ paddingLeft: 18 }}>{Object.entries(mf.excluded).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}><b className="num" style={{ color: 'var(--text)' }}>{v}</b> · {k}</li>)}</ul></div>
              <div className="panel"><div className="eyebrow">Where this differs from the book</div><p className="muted">Return on capital uses the screen’s ROCE on invested capital, not net working capital plus net fixed assets. EBIT is the last fiscal year, not trailing twelve months. A year whose EBIT margin moved 15+ points is left unranked as a likely one-off. Enterprise value carries no minority-interest line, so a holding company that consolidates a listed subsidiary can look cheaper than it is.</p><p className="dim" style={{ fontSize: 13 }}>A ranking is a way to read the market, not a list to buy from. <Link href="/about/" style={{ color: 'var(--accent-2)' }}>Method →</Link></p></div>
            </div>
          )}
        </Async>
      </section>
    </>
  );
}
