import { useState } from 'react';
import { useEngines } from '../useEngines.ts';
import { FlowCard } from './FlowCard.tsx';
import { DayChart } from '../components/DayChart.tsx';
import { usePulse } from '../data.ts';
import { isLiveQuote, quoteWord } from '../stamp.ts';
import { sessionNow } from '../market.ts';
import { Observed } from '../live.tsx';
import { useTrendSummary } from '../trendsummary.ts';
import { PageBar } from './common.tsx';
import { marketTakeaway } from '../takeaway.ts';
import { freshness } from '../fresh.ts';
import { useAppState } from '../app.tsx';
import { useNewsBoard } from '../news.ts';
import { usePaperSyms } from './NewsPage.tsx';
import { BreadthCard, CuesList, FxStrip, IndexTile, Movers, SectorTiles } from './mk.tsx';

/** Markets (v6, 13 Nov 2026): a summary row of index tiles, the session chart with the trend map and sectors beside the movers and the global cues, then the commodities strip and the flows.
 *  Every card has one job and a one-line title; what the numbers mean is on #/info. Same feeds and the same rules as before: nothing here was recalculated. */
export function Markets() {
  const { scr } = useEngines(); const rows = scr.data?.rows ?? []; const day = scr.data?.as_of ?? null;
  const pulse = usePulse(true); const anyLive = pulse.data ? Object.values(pulse.data.quotes).some((q) => isLiveQuote(q)) : null; const sess = sessionNow(Date.now(), anyLive); const pw = quoteWord(pulse.obs, Date.now(), { loading: pulse.loading && !pulse.err });
  const [dayIx, setDayIx] = useState<'NIFTY' | 'BANKNIFTY' | 'VIX'>('NIFTY');
  const t = useTrendSummary(rows, day, true); const live = sess.phase === 'open' && !!anyLive;
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const take = marketTakeaway({ niftyCh: chOf('NIFTY'), vixCh: chOf('VIX'), upPct: t.upPct, downPct: t.downPct, nTrend: t.map.n, live, behind: day ? freshness(day).behind : null, shares: true });
  const s = useAppState(); const paper = usePaperSyms(); const news = useNewsBoard({ follows: s.follows, paper });
  const q = pulse.data?.quotes[dayIx]; const nm = dayIx === 'NIFTY' ? 'Nifty 50' : dayIx === 'BANKNIFTY' ? 'Bank Nifty' : 'India VIX';
  return <div className="mk6">
    <PageBar title="Markets" onBack sub={<>{sess.label} · {sess.detail}</>} />
    <p className="mk-read" data-takeaway data-glance>{take ? take.text : scr.loading || pulse.loading ? <span className="sk" style={{ display: 'inline-block', height: 16, width: '70%' }} aria-label="Reading the market" /> : 'No market figures are available right now.'}</p>
    <section className="mk-tiles" aria-label="Index summary" data-tiles>
      <div className="mk-tiles-grid" role="list">
        <IndexTile k="NIFTY" name="Nifty 50" q={pulse.data?.quotes.NIFTY} d={2} err={!!pulse.err} />
        <IndexTile k="BANKNIFTY" name="Bank Nifty" q={pulse.data?.quotes.BANKNIFTY} d={0} err={!!pulse.err} />
        <IndexTile k="VIX" name="India VIX" q={pulse.data?.quotes.VIX} d={2} vix err={!!pulse.err} />
      </div>
      <p className="mk-basis small mute" data-market-status>{pw === 'Live' && <i className="dot-live" aria-hidden="true" />}Against the previous close · <Observed sec={pulse.obs} err={pulse.err} loading={pulse.loading} /></p>
    </section>
    <div className="mk-cols">
      <div className="mk-main">
        {q && q.c.length > 2 ? <section className="card mk-card dc-card" aria-labelledby="dc-h" data-day-chart>
          <div className="mk-head"><h2 id="dc-h" className="mk-h">Today's session</h2>
            <div className="mini-seg" role="group" aria-label="Index">{([['NIFTY', 'Nifty 50'], ['BANKNIFTY', 'Bank Nifty'], ['VIX', 'India VIX']] as const).map(([k, n]) => <button key={k} type="button" aria-pressed={dayIx === k} onClick={() => setDayIx(k)}>{n}</button>)}</div></div>
          <DayChart key={dayIx} q={q} nse lean good={dayIx === 'VIX' ? (chOf('VIX') ?? 0) <= 0 : (chOf(dayIx) ?? 0) >= 0} label={nm} />
        </section> : null}
        {scr.data && <BreadthCard rows={rows} map={t.map} day={day} live={!!t.liveMap} liveAt={t.breadth.at} open={sess.phase === 'open'} />}
        {scr.data && <SectorTiles rows={rows} day={day} />}
        {scr.loading && !scr.data && <section className="card mk-card" aria-busy="true"><div className="sk" style={{ height: 120 }} aria-label="Loading the trend map" /></section>}
      </div>
      <aside className="mk-side" aria-label="Movers and global cues">
        {scr.data && <Movers rows={rows} day={day} />}
        <CuesList pool={news.pool} loading={news.loading} />
      </aside>
    </div>
    <FxStrip />
    <FlowCard slim />
  </div>;
}
