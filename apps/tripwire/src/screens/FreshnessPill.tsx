import type { ReactNode } from 'react';
import { pillOf } from '../freshness.ts';
import { useFreshness } from '../freshdata.ts';

/** Today's one "Data status" line, at the foot and collapsed (revamp v2, 11 Nov 2026). The header pill and the app banner already say how current the screen is, so this is not a
 *  third warning: closed, it reads "Data status · Data through Fri 30 Oct · built 02:16 IST" with a quiet dot (lime when every file carries the last finished session, plain while
 *  that session's build is due, amber WITH WORDS when a file is behind); open, it names each file that is behind and links to the full table. Closes and builds, never "live". */
export function DataStatus({ extra }: { extra?: ReactNode }) {
  const f = useFreshness(); const pill = pillOf(f.files, f.now);
  const tone = pill?.tone ?? 'loading';
  return <details className="t-status tfoot" data-hero data-fresh={tone}>
    <summary><span className={`t-dot ${tone}`} aria-hidden="true" /><span className="t-status-k">Data status</span><span className="fresh-pill" data-fresh={tone}>{pill ? pill.text : 'Checking how current the data is…'}</span></summary>
    <div className="t-status-body small">{pill && <p className={tone === 'stale' ? 'fresh-why' : 'dim'}>{pill.detail}</p>}{extra}</div>
  </details>;
}
