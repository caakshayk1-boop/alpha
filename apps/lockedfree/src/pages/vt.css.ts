// View-transition names as a real stylesheet (no inline style attributes, so the CSP stays strict). One per screen and per listed stock.
import { SCREENS } from '../lib/screens.ts'; import { ledger } from '../lib/data.ts';
export const GET = () => {
  const L = ledger(), syms = new Set(L.picks.map((p) => p.symbol)); for (const r of L.runs) r.passed.forEach((s) => syms.add(s));
  const css = ['.vt-equity{view-transition-name:equity-card}', ...SCREENS.map((s) => `[data-vt="screen-${s.id}"]{view-transition-name:screen-${s.id}}`), ...[...syms].sort().map((s) => `[data-vt="stock-${s}"]{view-transition-name:stock-${s.replace(/[^A-Za-z0-9_-]/g, '_')}}`)].join('\n');
  return new Response(css + '\n', { headers: { 'content-type': 'text/css' } });
};
