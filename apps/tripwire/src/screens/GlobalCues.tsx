/** Global cues (12 Nov 2026): headlines from outside India grouped by the cue they matched (news/cues.js), each with its standing connection text, the MEASURED instrument and sector moves beside it, and one or two headlines.
 *  Nothing here predicts. The connection line is the same for every headline of that cue; the moves are read from the live macro/index feeds and the published screen, and say when and what they are. A figure that is not there reads "not measured", never zero. */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useScreen, usePulse } from '../data.ts';
import { fmtMacro, macroDef, useMacro } from '../macro.ts';
import { asOfTime } from '../quotes.ts';
import { cueBlocks, dayWord, GLOBAL_EMPTY, GLOBAL_NOTE, moveWords, sectorDay, type CueBlock, type Lists, type NewsEvent } from '../newsview.ts';
import { plural } from '../newshealth.ts';
import { NewsRow } from './News.tsx';

const INDEX_NAME: Record<string, string> = { NIFTY: 'Nifty 50', BANKNIFTY: 'Bank Nifty', VIX: 'India VIX' };
const MOVE_CLASS = { up: 'up', down: 'down', flat: '', none: 'mute' } as const;

/** One measured change as words first, an arrow second, colour last. */
export function Move({ chg, dp = 1 }: { chg: number | null | undefined; dp?: number }) {
  const m = moveWords(chg, dp);
  return <span className={`cue-move ${MOVE_CLASS[m.dir]}`}>{m.arrow && <span aria-hidden="true">{m.arrow} </span>}{m.text}</span>;
}

/** The linked live instrument of a cue. Reads the same live feeds as Markets: the macro feed for gold, oil and the dollar, the index feed for Nifty and the VIX. */
export function useCueFeeds() {
  const macro = useMacro(); const pulse = usePulse(true);
  return (key: string) => {
    const idx = key in INDEX_NAME; const q = (idx ? pulse.data?.quotes : macro.data?.quotes)?.[key] ?? null; const loading = idx ? pulse.loading && !pulse.err : macro.loading && !macro.err;
    const def = macroDef(key); const label = idx ? INDEX_NAME[key] : def?.label ?? key;
    const px = q && Number.isFinite(q.px) ? q.px : null; const chg = q && px != null && Number.isFinite(q.prev) && q.prev > 0 ? (px / q.prev - 1) * 100 : null;
    const value = px == null ? null : idx ? px.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : def ? fmtMacro(def, px) : String(px);
    return { key, label, value, chg, at: q?.pt ? asOfTime(q.pt) : '', loading };
  };
}
export type CueFeed = ReturnType<typeof useCueFeeds>;

/** The instrument as one chip: name, value, day change in words. While the feed is on its way the chip keeps its size (a placeholder word), so nothing moves when it arrives. */
export function InstrumentChip({ f, className = '' }: { f: ReturnType<CueFeed>; className?: string }) {
  return <span className={`cue-inst ${className}`} data-cue-instrument={f.key} title={f.at ? `Last price at ${f.at} IST. Day change against the previous close.` : undefined}>
    <span className="cue-inst-n">{f.label}</span>{' '}
    {f.value == null ? <span className="mute">{f.loading ? 'checking…' : 'not measured'}</span> : <><b className="num">{f.value}</b>{' '}<Move chg={f.chg} /><span className="sr"> today{f.at ? `, at ${f.at} IST` : ''}</span></>}
  </span>;
}

function Block({ b, feed, rows, asOf, lists, seenSec, nowMs, summaries, i }: { b: CueBlock; feed: CueFeed; rows: Parameters<typeof sectorDay>[0]; asOf: string | null; lists: Lists; seenSec: number; nowMs: number; summaries: boolean; i: number }) {
  const f = feed(b.measure); const hid = `cue-${b.id}`;
  return <article className="cue" data-cue={b.id} aria-labelledby={hid} style={{ ['--i' as string]: i } as CSSProperties}>
    <h3 className="cue-h" id={hid}><span className="tag cue-chip">{b.label}</span></h3>
    <p className="cue-channel">{b.channel}</p>
    <details className="cue-more"><summary>What is exposed, and what to watch</summary>
      <dl className="cue-dl"><div><dt>Exposed on the Indian side</dt><dd>{b.exposed}</dd></div><div><dt>Measures to watch</dt><dd>{b.watch}</dd></div></dl>
      <p className="mute small">Standing context for this kind of headline, the same for every one. It is not read from today's headline, and it says nothing about where any price goes.</p></details>
    <div className="cue-measure" data-cue-measure>
      <p className="cue-mh">Measured now</p>
      <InstrumentChip f={f} />
      <p className="cue-mh">Sectors it connects to · close of {asOf ? dayWord(asOf) : 'an unknown date'}</p>
      <ul className="cue-sectors">{b.sectors.map((s) => { const chg = sectorDay(rows, s); return <li key={s}><a className="cue-sector" href={`#/discover?sector=${encodeURIComponent(s)}`} data-cue-sector={s}><span>{s}</span> <Move chg={chg} /><span className="sr">, one-day change at the close of {asOf ? dayWord(asOf) : 'an unknown date'}. Research {s}</span></a></li>; })}</ul>
    </div>
    <ul className="nw-list">{b.items.map(({ ev, also }) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} seenSec={seenSec} nowMs={nowMs} summaries={summaries} board also={also} />)}</ul>
  </article>;
}

/** The Global cues section of the News page. `events` are the global events the page's filters kept. `empty`: what to say when there are none (it differs when the news check itself is late). */
export function GlobalCues({ events, lists, seenSec, nowMs, summaries, emptyNote }: { events: NewsEvent[]; lists: Lists; seenSec: number; nowMs: number; summaries: boolean; emptyNote?: ReactNode }) {
  const scr = useScreen(); const feed = useCueFeeds(); const blocks = useMemo(() => cueBlocks(events), [events]);
  const rows = scr.data?.rows; const asOf = scr.data?.as_of ?? null;
  return <section className="nwp-group nwg-global" data-news-group="global" aria-labelledby="nwg-global">
    <h2 className="nwp-gh" id="nwg-global">Global cues<span className="nwp-n num" aria-label={`, ${plural(events.length, 'event')}`}>{events.length}</span></h2>
    <p className="nwg-note" data-global-note>{GLOBAL_NOTE}</p>
    {blocks.length ? blocks.map((b, i) => <Block key={b.id} b={b} feed={feed} rows={rows} asOf={asOf} lists={lists} seenSec={seenSec} nowMs={nowMs} summaries={summaries} i={i} />)
      : <p className="nwp-none" data-news-empty="global">{emptyNote ?? GLOBAL_EMPTY}</p>}
  </section>;
}
