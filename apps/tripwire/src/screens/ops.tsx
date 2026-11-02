import { useEffect, useState } from 'react';
import { PageBar, Head } from './common.tsx';
import { lockSupported } from '../lock.ts';
import { storageWorks } from '../persist.ts';
import { SERVICES, serviceStatus, serviceSummary, type Evidence } from '../services.ts';
import { useJson, useLedger, useScreen } from '../data.ts';
import { useNewsHealth } from '../news.ts';
import { CADENCE, DELAY_AFTER } from '../../news/config.js';
import { fmtIst } from '../stamp.ts';

const ls = (): Storage | null => { try { return localStorage; } catch { return null; } };
interface HealthFeed { ok: boolean; checked_at: string; prices: { ok: boolean; ms: number | null; last_print: string | null; age_sec: number | null; error: string | null }; news: { ok: boolean; ms: number | null; error: string | null; status?: string | null; last_successful_at?: string | null; checked_at?: string | null }; bindings: string[]; secrets_configured: number }
const ageWord = (sec: number) => (sec < 120 ? `${sec} s` : sec < 7200 ? `${Math.round(sec / 60)} min` : `${Math.round(sec / 3600)} h`);


/** Operations (route #/ops): two readers, kept apart. The top of the page is service health in plain words for anyone; developer diagnostics (probe timings, binding names, schedules, cache lifetimes) are behind a labelled section that is closed by default.
 *  The page is NOT access-protected: there is no sign-in, so anyone who knows the address (or reads /api/health, which is public) sees the same. Putting the diagnostics in a closed section is tidiness, not security. It carries names and counts only, never a secret value. */
export function Operations() {
  const h = useJson<HealthFeed>('/api/health'); const nh = useNewsHealth(); const scr = useScreen(); const led = useLedger();
  const [lock, setLock] = useState<boolean | null>(null); useEffect(() => { void lockSupported().then(setLock); }, []);
  const [stor, setStor] = useState<boolean | null>(null); useEffect(() => { setStor(storageWorks(ls())); }, []);
  const [now, setNow] = useState(() => Date.now()); useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(i); }, []);
  const ev: Evidence = { nowMs: now, health: h.data, healthErr: !!h.err, news: nh, screenAsOf: scr.data?.as_of ?? null, ledgerUpdated: led.data?.ledger?.updated ?? null, storageOk: stor, lockSupported: lock };
  const sum = serviceSummary(SERVICES, ev);
  return <div className="read" data-ops>
    <PageBar title="Operations" onBack sub="Service health, in plain words" />
    <div className="note info" data-ops-unprotected><b>This page is not access-protected.</b> Tripwire has no accounts and no sign-in, so anyone with the address can open it, and the health data behind it is public. Keeping a link out of the menu or closing a section hides nothing. The page shows names, times and counts, never a key, token or other secret value.</div>

    <section className="card" aria-labelledby="ops-sum" data-ops-summary>
      <h2 id="ops-sum" className="sec" style={{ margin: 0 }}>Service health</h2>
      <p className="lead" style={{ margin: '6px 0 4px' }}>{sum.headline}</p>
      <p className="small dim" style={{ margin: 0 }}>{sum.detail}</p>
    </section>

    <Head>Services</Head>
    <div className="card" style={{ padding: '2px 14px' }}>
      {SERVICES.map((v) => { const st = serviceStatus(v, ev);
        return <details key={v.id} className="ev" style={{ margin: 0 }}><summary>{v.label}<span className={`tag ${st.tone} num`} style={{ marginLeft: 'auto' }}>{st.word}</span><span className="chev">▾</span></summary>
          <div className="body small"><p style={{ margin: '0 0 6px' }}>{v.what}</p>
            {v.kind === 'probe' ? <><p style={{ margin: '0 0 6px' }}><b>Right now:</b> {st.line}</p><p style={{ margin: '0 0 6px' }}><b>How this is known:</b> {v.evidence}.</p></> : null}
            {v.needs ? <p style={{ margin: 0 }}><b>To make it real:</b> {v.needs}</p> : null}</div></details>; })}
      <p className="small mute" style={{ margin: '6px 0 10px' }}>A word here comes from a real check or a last-success time. "Not verified" means no check has answered yet, not that something is broken.</p>
    </div>

    <Head>News checks</Head>
    <div className="card small">
      <dl className="nw-times" style={{ margin: 0 }}>
        <div><dt>State</dt><dd>{nh.word}</dd></div>
        <div><dt>Last successful scheduled check</dt><dd>{nh.lastGood ?? 'none yet'}</dd></div>
        <div><dt>Latest scheduled check</dt><dd>{nh.checked ?? 'none yet'}</dd></div>
        <div><dt>Next check due</dt><dd>{nh.state === 'unavailable' ? 'unknown' : nh.next ?? 'unknown'}</dd></div>
        <div><dt>Refreshed on demand</dt><dd>{nh.onDemand ?? 'not needed, or not run'}</dd></div>
      </dl>
      <p style={{ margin: '8px 0 0' }}>{nh.line}</p>
    </div>

    <Head>This device</Head>
    <div className="card small">
      <p style={{ margin: '0 0 6px' }}><b>Saving:</b> {stor == null ? 'not tested yet' : stor ? 'a test value was written and read back' : 'this browser would not keep a test value'}.</p>
      <p style={{ margin: 0 }}><b>Screen lock:</b> {lock == null ? 'checking' : lock ? 'this device offers a platform authenticator' : 'not offered by this browser'}.</p>
    </div>


    <details className="ev ops-dev" data-ops-dev>
      <summary><span className="grow"><span className="k" style={{ display: 'block' }}>For whoever runs the service</span><b>Developer diagnostics</b></span><span className="chev">▾</span></summary>
      <div className="body small">
        <p style={{ margin: '0 0 8px' }}>Probe timings, binding names, schedules and cache lifetimes. Nothing here is needed to use Tripwire, and none of it is access-protected: this section is closed to keep the page readable, not to keep anything private.</p>
    <h3 className="sec" style={{ margin: '8px 0 6px' }}>Service probes</h3>
    <div className="card small">{h.loading ? 'Checking…' : h.err || !h.data ? `The health check did not answer (${h.err ?? 'no data'}).` : <>
      <p style={{ margin: '0 0 6px' }}><b>Prices:</b> {h.data.prices.ok ? `answering${h.data.prices.ms != null ? ` in ${h.data.prices.ms} ms` : ''}${h.data.prices.age_sec != null ? `; last exchange print ${ageWord(h.data.prices.age_sec)} before the check` : ''}` : `not answering (${h.data.prices.error ?? 'no reply'})`}.</p>
      <p style={{ margin: '0 0 6px' }}><b>News status file:</b> {h.data.news.ok ? `readable${h.data.news.ms != null ? ` in ${h.data.news.ms} ms` : ''}${h.data.news.status ? `; the job reports "${h.data.news.status}"` : ''}` : `not readable (${h.data.news.error ?? 'no reply'})`}.</p>
      <p style={{ margin: 0 }}>The Worker holds {h.data.secrets_configured} secrets and {h.data.bindings.length} binding{h.data.bindings.length === 1 ? '' : 's'} ({h.data.bindings.join(', ') || 'none'}); checked {fmtIst(Date.parse(h.data.checked_at) / 1000, now)}.</p></>}</div>

    <h3 className="sec" style={{ margin: '12px 0 6px' }}>Schedules and caches</h3>
    <div className="card small"><p style={{ margin: '0 0 0' }}><b>News job.</b> {`GitHub Actions, every ${CADENCE.session} minutes in the NSE session, ${CADENCE.off} otherwise. Best effort: runs start late and some are dropped. The page says delayed after ${DELAY_AFTER.cadences} cadences plus ${DELAY_AFTER.graceMin} minutes.`}</p><p style={{ margin: '8px 0 0' }}><b>On-demand refresh.</b> The Worker, only when the scheduled check is older than two cadences and the session is on; market stories only; kept 15 minutes.</p><p style={{ margin: '8px 0 0' }}><b>Screen, ledger, deploy.</b> Built in the research repository, then the newspaper job publishes it; this app's ledger and deploy run after that (see docs/tripwire/launch/RELIABILITY.md for the chain and its measured lateness).</p><p style={{ margin: '8px 0 0' }}><b>Worker caches.</b> News status 60 s, news snapshot 5 min, one company's news 5 min, health 60 s, prices a few seconds to 5 min by route. A copy is never newer than its own time.</p></div>


      </div>
    </details>
  </div>;
}
