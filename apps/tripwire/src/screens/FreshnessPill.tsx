import { pillOf } from '../freshness.ts';
import { useFreshness } from '../freshdata.ts';

/** "Data through Fri 30 Oct · built 02:16 IST": the screen's data day and build time, judged by the one freshness module. Lime when every file carries the last finished session,
 *  plain while that session's own build is still due, amber WITH WORDS naming the file when anything is behind. These are closes and builds, never "live". Links to the full table. */
export function FreshnessPill() {
  const f = useFreshness(); const pill = pillOf(f.files, f.now);
  if (!pill) return <a className="tag" href="#/data" data-fresh="loading" role="status">Checking how current the data is…</a>;
  const cls = pill.tone === 'ok' ? 'lime' : pill.tone === 'pending' ? '' : 'amber';
  return <a className={`tag ${cls} fresh-pill`} href="#/data" data-fresh={pill.tone} role="status" title={pill.detail} style={{ maxWidth: '100%', whiteSpace: 'normal', padding: '4px 10px' }}>
    <span>{pill.text}</span>{pill.tone !== 'ok' && <span className="fresh-why"> · {pill.detail}</span>}</a>;
}
