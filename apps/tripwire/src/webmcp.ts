/** WebMCP: where the browser offers `document.modelContext`, the page tells an assistant what it can do. Three tools, none of which writes anything:
 *  a search of the published screen, navigation to a company's page, and the market session's state. Absent API, no effect. */
import { sessionNow } from './market.ts';
interface Tool { name: string; description: string; inputSchema: object; annotations?: Record<string, boolean>; execute: (a: Record<string, unknown>) => Promise<string> }
interface Ctx { registerTool: (t: Tool) => Promise<void> | void }
interface Slim { sym: string; name: string; sector?: string; tier?: string; price?: number | null }
let rows: Promise<Slim[]> | null = null;
const load = () => (rows ??= fetch('/data/screen.json').then((r) => r.json()).then((d: { rows: Slim[] }) => d.rows));
export function registerWebMcp() {
  const mc = (document as Document & { modelContext?: Ctx }).modelContext; if (!mc?.registerTool) return;
  const reg = (t: Tool) => { try { void Promise.resolve(mc.registerTool(t)).catch(() => {}); } catch { /* the API is experimental; a refusal changes nothing */ } };
  reg({ name: 'search_companies', description: 'Find companies in the published Tripwire screen by symbol or name. Returns up to 8 matches with sector, size class and the last close. The close is the last finished session, not a live price.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Part of a symbol or company name' } }, required: ['query'] }, annotations: { readOnlyHint: true },
    execute: async ({ query }) => { const q = String(query ?? '').trim().toLowerCase(); if (!q) return 'Give a symbol or part of a name.'; const hit = (await load()).filter((r) => r.sym.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)).slice(0, 8); return hit.length ? hit.map((r) => `${r.sym}: ${r.name}${r.sector ? `, ${r.sector}` : ''}${r.tier ? `, ${r.tier} cap` : ''}${r.price != null ? `, last close ${r.price}` : ''}`).join('\n') : 'No company matched.'; } });
  reg({ name: 'open_company', description: 'Open one company page (price chart, figures with dates, risks, news). Navigation only.',
    inputSchema: { type: 'object', properties: { symbol: { type: 'string', description: 'NSE symbol, for example TCS' } }, required: ['symbol'] }, annotations: { readOnlyHint: true },
    execute: async ({ symbol }) => { const s = String(symbol ?? '').trim().toUpperCase(); if (!/^[A-Z0-9&_-]{1,20}$/.test(s)) return 'That is not a symbol.'; location.hash = `#/c/${encodeURIComponent(s)}`; return `Opened ${s}.`; } });
  reg({ name: 'market_status', description: 'Whether the NSE cash market is open, closed for the day, or on a holiday, by the exchange calendar.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
    execute: async () => { const s = sessionNow(Date.now(), null); return `${s.label}. ${s.detail}`; } });
}
