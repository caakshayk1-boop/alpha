// /api/family (28 Nov 2026): the four askakshay products and the market day each one's own data describes, read from what each
// product publishes about itself. Nothing is estimated: a product that does not answer is "not reached", and a date that cannot be
// read is null. The browser judges current / behind with the hub's own session calendar (src/lib/status.ts), so the hub, its
// /status/ page and this block can never disagree about what "current" means.
//
//   Rulebook  lockedfree.askakshay.com/status/      the data-asof of each row of its own status table
//   Tripwire  tripwire.askakshay.com/data/freshness.json   asOf per file
//   ApexPro   apexpro.askakshay.com/                 reachability; its company data IS Alpha's daily screen (apps/apexpro/worker.mjs /api/screen)
//   Alpha     this Worker's screen feed              the session the screen describes

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const day = (s) => (typeof s === 'string' && ISO.test(s.slice(0, 10)) ? s.slice(0, 10) : null);

/** Rulebook's status table rows: [{ label, asOf, cadence }]. Pure. */
export function parseRulebookStatus(html) {
  const out = [];
  const re = /<tr data-status-row data-asof="([^"]*)" data-cadence="(daily|weekly)"[^>]*>\s*<th scope="row">([^<]{1,60})<\/th>/g;
  for (const m of String(html || '').matchAll(re)) out.push({ label: m[3].trim(), asOf: day(m[1]), cadence: m[2] });
  return out;
}

/** Tripwire's freshness file: [{ label, asOf, cadence }]. Pure. */
export function parseTripwireFreshness(j) {
  const names = { screen: 'Daily screen', companies: 'Company pages', signals: 'Rule triggers' };
  return (Array.isArray(j?.files) ? j.files : []).filter((f) => names[f?.id]).map((f) => ({ label: names[f.id], asOf: day(f.asOf), cadence: 'daily' }));
}

async function get(url, timeout = 5000) {
  try { return await fetch(url, { headers: { accept: 'text/html,application/json' }, signal: AbortSignal.timeout(timeout), cf: { cacheTtl: 300 } }); } catch { return null; }
}

/** Everything the block shows, with the time it was read. `screenAsOf` is the session Alpha's screen describes (null when unread). */
export async function readFamily(screenAsOf) {
  const [rb, tw, ap] = await Promise.all([
    get('https://lockedfree.askakshay.com/status/'),
    get('https://tripwire.askakshay.com/data/freshness.json'),
    get('https://apexpro.askakshay.com/'),
  ]);
  const rbRows = rb?.ok ? parseRulebookStatus(await rb.text().catch(() => '')) : [];
  const twRows = tw?.ok ? parseTripwireFreshness(await tw.json().catch(() => null)) : [];
  const screen = { label: 'Daily screen', asOf: day(screenAsOf), cadence: 'daily' };
  return {
    ok: true,
    read_at: new Date().toISOString(),
    products: [
      { id: 'alpha', reached: true, datasets: [screen] },
      { id: 'rulebook', reached: !!rb?.ok, datasets: rbRows.filter((r) => /feed|ledger/i.test(r.label)) },
      { id: 'tripwire', reached: !!tw?.ok, datasets: twRows.filter((r) => r.label !== 'Company pages') },
      { id: 'apexpro', reached: !!ap?.ok, datasets: ap?.ok ? [{ ...screen, label: 'Daily screen (read from Alpha)' }] : [] },
    ],
  };
}
