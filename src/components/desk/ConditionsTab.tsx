'use client';
/** Conditions, the My Desk tab (Pro §28 P3): the reader's own data conditions in the Screen's query language, parsed by
 *  lib/conditions.ts and checked against the latest screen. They are evaluated only while this page is open in this
 *  browser: there is no background job and no account, so no alert is ever sent. The page says so in so many words. */
import { useMemo, useState } from 'react';
import { Skel } from '@/components/ui';
import { check, parseCondition } from '@/lib/conditions';
import { dateLabel, num } from '@/lib/format';
import type { Row } from '@/lib/types';

const EXAMPLES = ['TCS: rsi < 30', 'roce < 15', 'INFY: pe < 22'];

export function ConditionsTab({ list, add, remove, storeError, rows, watch, asOf, loading }: { list: string[]; add: (s: string) => boolean; remove: (s: string) => boolean; storeError: string | null; rows: Row[]; watch: string[]; asOf: string | null; loading: boolean }) {
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseCondition(text) : null;
  const err = parsed && 'message' in parsed ? parsed.message : null;
  const conds = useMemo(() => list.map((raw) => { const c = parseCondition(raw); return 'message' in c ? { raw, c: null, res: [] } : { raw, c, res: check(c, rows, watch) }; }), [list, rows, watch]);
  const met = conds.reduce((n, x) => n + x.res.filter((y) => y.met).length, 0);
  const submit = () => { if (parsed && !('message' in parsed) && add(parsed.raw)) setText(''); };

  return (
    <div className="grid-lead desk-conds">
      <section className="card" aria-labelledby="cd-h">
        <div className="card-h"><h2 id="cd-h">Conditions <span className="dim num" style={{ fontWeight: 500 }}>· {loading ? 'checking…' : met ? `${num(met)} met` : 'none met'}</span></h2></div>
        <div className="desk-delivery" role="note">
          <span className="pill warn nodot">Delivery: browser only</span>
          <p>Conditions are evaluated only while this page is open in this browser, against the {asOf ? `${dateLabel(asOf)} ` : 'latest '}screen. No background alert, email or notification is sent: there is no account and no server job to send one.</p>
        </div>
        <form className="desk-condform" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="cond-in"><span>New condition</span></label>
          <div className="desk-condrow">
            <input id="cond-in" className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. TCS: rsi < 30" aria-invalid={!!err} aria-describedby={err ? 'cond-err' : 'cond-help'} autoComplete="off" spellCheck={false} />
            <button className="act primary" type="submit" disabled={!parsed || !!err}>Add condition</button>
          </div>
          {err ? <p id="cond-err" className="desk-err">{err}</p> : <p id="cond-help" className="dim desk-small">&ldquo;SYMBOL: rule&rdquo; checks one company; a rule alone checks every company you follow. Fields and operators are the Screen&apos;s. No price targets.</p>}
          {storeError && <p className="desk-err" role="alert">{storeError}</p>}
        </form>
        {loading && list.length > 0 ? <Skel h={80} /> : conds.length === 0 ? (
          <div className="state">
            <b>No conditions yet.</b>
            <p>A condition is a rule about the data you want to notice, such as an RSI below 30 or a ROCE that falls under 15. Pick an example to start from.</p>
            <div className="acts">{EXAMPLES.map((x) => <button key={x} type="button" className="act quiet" onClick={() => setText(x)}><code>{x}</code></button>)}</div>
          </div>
        ) : (
          <ul className="rows desk-condlist">
            {conds.map(({ raw, c, res }) => (
              <li key={raw} className="dcond">
                <div className="dcond-h"><code>{raw}</code><button type="button" className="act quiet" onClick={() => remove(raw)} aria-label={`Remove condition ${raw}`}>Remove</button></div>
                {!c ? <p className="desk-err">This condition no longer parses, so it is not checked.</p>
                  : res.length === 0 ? <p className="dim desk-small">It covers every company you follow, and you follow none, so it checks nothing yet.</p>
                    : <ul className="dcond-res">{res.map((x) => <li key={x.sym}><b>{x.sym}</b> {x.met === null ? <span className="pill nodot">not measurable: {x.why}</span> : x.met ? <span className="pill ok">met</span> : <span className="pill nodot">not met</span>}</li>)}</ul>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="desk-aside">
        <section className="card tight" aria-labelledby="cdh-h">
          <div className="card-h"><h3 id="cdh-h">How a condition is read</h3></div>
          <ul className="desk-plain">
            <li>A company with no value for a field is <b>not measurable</b>, never counted as not met.</li>
            <li>Checked against the screen close{asOf ? ` of ${dateLabel(asOf)}` : ''}, not a live price.</li>
            <li>Kept in this browser with your other records, and included in &ldquo;Export everything&rdquo;.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
