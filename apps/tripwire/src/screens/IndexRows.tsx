import { bankLead, indexFacts, type IndexFacts } from '../indexfacts.ts';
import { pct, tone } from '../fmt.ts';
import { Tick } from '../live.tsx';
import { tvIndexUrl } from '../tv.ts';
import type { Quote } from '../data.ts';

const num = (v: number, d: number) => v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), d)}`;

/** One index: the level, the move in points and percent, and where the price sits in today's range with yesterday's close marked on it.
 *  12 Nov 2026 (revamp v3): no sparkline. The day chart above owns the shape of the session (Nifty 50 was drawn there AND here); this row owns RANGE POSITION only.
 *  Always drawn (a dash while the quote is missing) so the card never changes height when the prices arrive. */
function Row({ k, name, q, d, vix }: { k: string; name: string; q: Quote | undefined; d: number; vix?: boolean }) {
  const f: IndexFacts | null = indexFacts(q); const col = f == null ? '' : vix ? (f.ch > 0 ? 'down' : f.ch < 0 ? 'up' : '') : tone(f.ch);
  return <a role="listitem" className="ix" href={tvIndexUrl(k as 'NIFTY')} target="_blank" rel="noopener noreferrer">
    <span className="ix-top"><span className="nm">{name}</span><span className="px num"><Tick v={f?.px}>{f ? num(f.px, d) : '—'}</Tick></span><span className={`ch num ${col}`}>{f ? `${sgn(f.pts, d)} · ${pct(f.ch)}` : '—'}</span></span>
    <span className="ix-mid">
      <span className="rg" role="img" aria-label={f ? `${name} day range ${num(f.lo, d)} to ${num(f.hi, d)}; now ${f.pos == null ? 'level' : `${Math.round(f.pos * 100)} percent of the way up`}` : `${name} range not available`}>
        <i className="trk" />{f?.prevPos != null && <i className="pv" style={{ left: `${f.prevPos * 100}%` }} title={`Previous close ${num(f.prev, d)}`} />}{f?.pos != null && <i className={`nw ${col}`} style={{ left: `${f.pos * 100}%` }} />}</span>
    </span>
    <span className="ix-bot small mute num"><span>low {f ? num(f.lo, d) : '—'}</span><span>prev {f ? num(f.prev, d) : '—'}{f?.gap != null ? ` · opened ${pct(f.gap)}` : ''}</span><span>high {f ? num(f.hi, d) : '—'}</span></span>
    <span className="sr"> on TradingView, opens in a new tab</span></a>;
}

/** Bank Nifty and India VIX. The Nifty 50 is not repeated here: the day chart on the same page is the Nifty. It is still READ (not drawn) for the one fact that sets the banks against it. */
export function IndexRows({ nifty, bank, vix, err }: { nifty?: Quote; bank?: Quote; vix?: Quote; err: boolean }) {
  const fn = indexFacts(nifty), fb = indexFacts(bank); const lead = bankLead(fb?.ch ?? null, fn?.ch ?? null);
  return <div className="idx" role="list" aria-label="Bank Nifty and India VIX">
    <p className="ix-note small dim" data-ix-note>{err && !nifty ? 'Index prices unavailable.' : !nifty ? 'Reading the market…' : lead == null ? 'Bank Nifty and India VIX against today’s range.' : `Banks ${lead > 0 ? 'ahead of' : lead < 0 ? 'behind' : 'level with'} the Nifty by ${Math.abs(lead).toFixed(2)} percentage points.`}</p>
    <Row k="BANKNIFTY" name="Bank Nifty" q={bank} d={0} /><Row k="VIX" name="India VIX" q={vix} d={2} vix />
    <p className="small mute ix-key">Bar: today’s low to high, in index points. Dot: the last price. Tick: yesterday’s close. A rising VIX shows red.</p>
  </div>;
}
