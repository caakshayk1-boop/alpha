/** Optional context files from the owner's data repository (ADR-022): market regime, the barometer, the pulse (volume leaders) and the dataset health table.
 *  Fetched best effort by tools/fetch-feed.mjs. A file that is absent, malformed or too old is null here and its widget says "not available"; nothing is filled in. */
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';
const DIR = process.env.RULEBOOK_FEED_DIR || join(process.cwd(), 'feed');
const rd = (f: string): any | null => { try { const p = join(DIR, f); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch { return null; } };
export const STALE_DAYS = 5;
const ageDays = (iso: string | null | undefined) => (iso && Number.isFinite(Date.parse(iso)) ? (Date.now() - Date.parse(iso)) / 864e5 : null);
export interface Part { key: string; label: string; score: number; weight: number; detail: string }
export interface Regime { name: string; text: string; asOf: string; volAnnPct: number | null; volPctile: number | null; drawdownPct: number | null; above200: boolean | null; lastYear: Record<string, number>; labels: Record<string, string> }
export interface Barometer { score: number; band: string; parts: Part[]; asOf: string | null; complete: boolean }
export interface VolumeRow { sym: string; name: string; sector: string; price: number; r1w: number | null; vol: number; turnoverCr: number }
export interface Health { dataset: string; source: string; status: string; age: string; hours: number | null }
export interface Context { regime: Regime | null; barometer: Barometer | null; volume: { built: string; rows: VolumeRow[] } | null; health: Health[] | null; healthAt: string | null }
const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
let cache: Context | null = null;
export function loadContext(): Context {
  if (cache) return cache; const r = rd('regime.json'), b = rd('barometer.json'), p = rd('pulse.json'), h = rd('data-health.json');
  const regime: Regime | null = r?.today?.regime && (ageDays(r.today.date) ?? 99) <= STALE_DAYS ? { name: r.today.t ?? r.today.regime, text: r.today.d ?? '', asOf: r.today.date, volAnnPct: n(r.today.vol_ann_pct), volPctile: n(r.today.vol_pctile), drawdownPct: n(r.today.drawdown_pct), above200: typeof r.today.above_200dma === 'boolean' ? r.today.above_200dma : null, lastYear: r.last_year ?? {}, labels: Object.fromEntries(Object.entries(r.regimes ?? {}).map(([k, v]: [string, any]) => [k, v?.t ?? k])) } : null;
  const barometer: Barometer | null = typeof b?.today?.score === 'number' && (ageDays(b.today.nifty_date) ?? 99) <= STALE_DAYS ? { score: b.today.score, band: b.today.band?.t ?? '', parts: (b.today.parts ?? []).filter((x: any) => n(x.score) != null).map((x: any) => ({ key: x.key, label: x.label, score: x.score, weight: x.weight, detail: x.detail })), asOf: b.today.nifty_date ?? null, complete: !!b.today.coverage?.complete } : null;
  const volume = Array.isArray(p?.volume) && p.built_on && (ageDays(p.built_on) ?? 99) <= STALE_DAYS ? { built: p.built_on as string, rows: p.volume.filter((v: any) => n(v.vol_spike) != null && n(v.turnover_cr) != null && v.vol_spike >= 2 && v.turnover_cr >= 5).slice(0, 10).map((v: any): VolumeRow => ({ sym: v.sym, name: v.name, sector: v.sector, price: v.price, r1w: n(v.r1w), vol: v.vol_spike, turnoverCr: v.turnover_cr })) } : null;
  const health: Health[] | null = Array.isArray(h?.datasets) ? h.datasets.filter((d: any) => ['Stock screen', 'Markets', 'Market Intelligence'].includes(d.dataset)).map((d: any): Health => ({ dataset: d.dataset, source: d.source, status: d.status, age: d.freshness_age, hours: n(d.freshness_age_hours) })) : null;
  return (cache = { regime, barometer, volume, health, healthAt: h?.generated_at ?? null });
}
