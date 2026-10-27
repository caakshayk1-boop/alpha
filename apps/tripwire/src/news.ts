/** News in the browser: ONE store for the published snapshot and its status, hooks for the screens, live queries for names the snapshot does not cover.
 *
 *  What the browser does, and does not do:
 *    - It polls only /api/news/version (a few hundred bytes), once a minute while the tab is visible, not at all while hidden, and again when the tab regains focus. It reads the snapshot itself
 *      (/api/news) only when the version moved.
 *    - It never reorders a list under the reader. A screen freezes the list it drew; newer events are offered as "N new updates" and applied on a tap, or the next time the screen is opened.
 *    - "Refresh now" asks for the newest PUBLISHED check; it cannot make the job run. It is limited to once in 30 seconds here (and by the Worker), reports Checking / Updated / No new stories / Failed,
 *      and a Retry-After from the server is honoured for every request.
 *    - Content kept from an earlier visit is readable offline, labelled by the health model (newshealth.ts) as delayed, never as live. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { newsHealth, type NewsHealth, type StatusDoc } from './newshealth.ts';
import { mergePools, newUpdates, todayList, type Lists, type NewsEvent } from './newsview.ts';
import { companyQuery } from '../news/plan.js';
import { useScreen } from './data.ts';

export const companyQ = (name: string): string => companyQuery(name, 7);
export interface SourceStatus { id: string; label: string; status: string; queries?: number; ok?: number; failed?: number; skipped?: number; httpStatus?: number | null; error?: string | null; breaker?: { failures: number; openUntil: number | null }; breakerState?: string }
export interface NewsSnapshot {
  ok: true; schema: string; snapshotVersion: number; pipelineVersion: string; rankingVersion: string; scheduledAt: string | null; startedAt: string | null; completedAt: string | null; checkedAt: string | null; lastSuccessfulAt: string | null; nextScheduledAt: string | null; cadenceMin: number;
  status: 'ok' | 'partial' | 'failed'; lastError: string | null; sources: SourceStatus[]; coverage: { feeds: number; answered: number; failed: number; unresolvedNames: string[] }; rejections: Record<string, number>;
  scopes: { market: string; paper: string[]; covered: string[] }; names: Record<string, string>; events: NewsEvent[];
}
export type RefreshState = 'idle' | 'checking' | 'updated' | 'none' | 'failed';
export interface Refresh { state: RefreshState; message: string; at: number }
interface Core { doc: StatusDoc | null; snapshot: NewsSnapshot | null; unreachable: boolean; loaded: boolean; remembered: StatusDoc | null; refresh: Refresh; retryUntil: number; polledAt: number }

const KEEP = 'tripwire:newsSnap1';
const readKept = (): { doc: StatusDoc | null; snapshot: NewsSnapshot | null } => { try { const t = localStorage.getItem(KEEP); if (!t) return { doc: null, snapshot: null }; const o = JSON.parse(t); return o?.snapshot?.schema === 'tripwire-news/1' ? o : { doc: null, snapshot: null }; } catch { return { doc: null, snapshot: null }; } };
const keep = (doc: StatusDoc | null, snapshot: NewsSnapshot | null) => { try { const t = JSON.stringify({ doc, snapshot }); if (t.length < 900_000) localStorage.setItem(KEEP, t); } catch { /* private mode or full: the page still works, it just cannot show an earlier copy next time */ } };
const kept = readKept();
let core: Core = { doc: null, snapshot: kept.snapshot, unreachable: false, loaded: false, remembered: kept.doc, refresh: { state: 'idle', message: '', at: 0 }, retryUntil: 0, polledAt: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<Core>) => { core = { ...core, ...p }; subs.forEach((f) => f()); };

async function getJson(url: string, force = false): Promise<{ ok: boolean; status: number; data: any; retryAfterSec: number | null }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), cache: force ? 'reload' : 'default' }); const ra = Number(r.headers.get('retry-after')); let data: any = null; try { data = await r.json(); } catch { /* not JSON */ }
    const bodyRa = Number(data?.retry_after); const retryAfterSec = Number.isFinite(ra) && ra > 0 ? ra : Number.isFinite(bodyRa) && bodyRa > 0 ? bodyRa : null;
    return { ok: r.ok, status: r.status, data, retryAfterSec };
  } catch { return { ok: false, status: 0, data: null, retryAfterSec: null }; }
}
const holdFor = (sec: number | null) => { if (sec) core.retryUntil = Math.max(core.retryUntil, Date.now() + Math.min(sec, 3600) * 1000); };

/** Read the version document; when the version moved, read the snapshot too. Returns what happened. */
export async function pollVersion(force = false): Promise<'changed' | 'same' | 'failed' | 'held'> {
  if (!force && Date.now() < core.retryUntil) return 'held';
  const v = await getJson(`/api/news/version${force ? '?force=1' : ''}`, force); holdFor(v.retryAfterSec); core.polledAt = Date.now();
  if (!v.ok || !v.data) { set({ unreachable: true, loaded: true }); return 'failed'; }
  if (v.data.ok === false) { if (v.data.reason === 'absent') { set({ doc: null, unreachable: false, loaded: true }); return 'same'; } set({ unreachable: true, loaded: true }); return 'failed'; }
  const doc = v.data as StatusDoc; const had = core.snapshot?.snapshotVersion;
  if (had == null || doc.snapshotVersion !== had) {
    const s = await getJson('/api/news', force); holdFor(s.retryAfterSec);
    if (s.ok && s.data?.ok && s.data.schema === 'tripwire-news/1') { const snap = s.data as NewsSnapshot; set({ doc, snapshot: snap, unreachable: false, loaded: true, remembered: doc }); keep(doc, snap); return 'changed'; }
    set({ doc, unreachable: false, loaded: true, remembered: doc }); return 'failed';
  }
  set({ doc, unreachable: false, loaded: true, remembered: doc }); keep(doc, core.snapshot); return 'same';
}

let cooldownUntil = 0; let idleTimer = 0;
const REFRESH_COOLDOWN_MS = 30_000;
/** "Refresh now". Never faster than once in 30 seconds. Resolves to the outcome so a screen can apply what arrived. */
export async function refreshNow(): Promise<RefreshState> {
  const say = (state: RefreshState, message: string) => { set({ refresh: { state, message, at: Date.now() } }); window.clearTimeout(idleTimer); if (state !== 'checking') idleTimer = window.setTimeout(() => set({ refresh: { state: 'idle', message: '', at: Date.now() } }), 9000); return state; };
  if (core.refresh.state === 'checking') return 'checking';
  if (Date.now() < cooldownUntil) return say('none', 'No new stories: checked a moment ago');
  say('checking', 'Checking'); cooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
  const r = await pollVersion(true);
  if (r === 'failed') return say('failed', 'Failed: the news service did not answer. The last saved stories stay on screen.');
  if (r === 'held') return say('failed', 'Failed: the news service asked to be left alone for a while.');
  return r === 'changed' ? say('updated', 'Updated') : say('none', 'No new stories');
}

let timer = 0;
function ensurePolling() {
  if (timer) return;
  const tick = () => { if (document.visibilityState === 'visible') void pollVersion(false); };
  const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - core.polledAt > 30_000) void pollVersion(false); };
  timer = window.setInterval(tick, 60_000); document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', onVis);
  (ensurePolling as any).off = () => { window.clearInterval(timer); timer = 0; document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  if (!core.loaded || Date.now() - core.polledAt > 30_000) void pollVersion(false);
}
export function useNewsStore(): Core {
  const c = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); if (!subs.size) (ensurePolling as any).off?.(); }; }, () => core, () => core);
  useEffect(() => { ensurePolling(); }, []);
  return c;
}
/** The one health answer for every screen. Re-evaluated every 30 seconds so "delayed" appears without a reload. */
export function useNewsHealth(): NewsHealth {
  const c = useNewsStore(); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(i); }, []);
  return useMemo(() => newsHealth({ doc: c.doc, unreachable: c.unreachable, remembered: c.remembered, nowMs: now }), [c.doc, c.unreachable, c.remembered, now]);
}

/* ---------- live queries for names the snapshot does not cover ---------- */
export interface QueryResult { ok: boolean; checkedAt: string | null; events: NewsEvent[]; error: string | null }
const qcache = new Map<string, { at: number; r: QueryResult }>(); const qflight = new Map<string, Promise<QueryResult>>(); const QTTL = 5 * 60_000;
export async function queryNews(name: string, sym: string | null, force = false): Promise<QueryResult> {
  const key = `${sym ?? ''}|${name}`; const hit = qcache.get(key); if (hit && Date.now() - hit.at < QTTL && !force) return hit.r;
  const f = qflight.get(key); if (f) return f;
  const p = (async (): Promise<QueryResult> => {
    if (!force && Date.now() < core.retryUntil) return hit?.r ?? { ok: false, checkedAt: null, events: [], error: 'asked to wait' };
    const r = await getJson(`/api/news?q=${encodeURIComponent(companyQ(name))}${sym ? `&sym=${encodeURIComponent(sym)}` : ''}${force ? '&force=1' : ''}`, force); holdFor(r.retryAfterSec);
    if (r.ok && r.data?.ok && Array.isArray(r.data.events)) { const out = { ok: true, checkedAt: r.data.checkedAt as string, events: r.data.events as NewsEvent[], error: null }; qcache.set(key, { at: Date.now(), r: out }); return out; }
    return hit?.r ? { ...hit.r, error: r.data?.error ?? 'the news source did not answer' } : { ok: false, checkedAt: null, events: [], error: r.data?.error ?? (r.status === 429 ? 'checked a moment ago' : 'the news source did not answer') };
  })();
  qflight.set(key, p); try { return await p; } finally { qflight.delete(key); }
}
/** One company's own stories, through the same pipeline and gates. Used on the company page. */
export function useNameNews(name: string, sym: string | null) {
  const [st, setSt] = useState<{ r: QueryResult | null; loading: boolean }>({ r: null, loading: true });
  const run = useCallback((force: boolean) => { let live = true; setSt((s) => ({ ...s, loading: true })); void queryNews(name, sym, force).then((r) => live && setSt({ r, loading: false })); return () => { live = false; }; }, [name, sym]);
  useEffect(() => { const stop = run(false); const i = window.setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - (qcache.get(`${sym ?? ''}|${name}`)?.at ?? 0) >= QTTL) run(false); }, 60_000); return () => { stop(); window.clearInterval(i); }; }, [run, name, sym]);
  return { ...st, refresh: () => run(true) };
}
function useLiveNames(items: { sym: string; name: string }[]) {
  const key = items.map((x) => x.sym).join(','); const [st, setSt] = useState<{ events: NewsEvent[]; loading: boolean; failed: number; checkedAt: string | null }>({ events: [], loading: items.length > 0, failed: 0, checkedAt: null });
  const run = useCallback((force: boolean) => {
    if (!items.length) { setSt({ events: [], loading: false, failed: 0, checkedAt: null }); return () => {}; } let live = true; setSt((s) => ({ ...s, loading: true }));
    void Promise.all(items.map((x) => queryNews(x.name, x.sym, force))).then((rs) => live && setSt({ events: rs.flatMap((r) => r.events), loading: false, failed: rs.filter((r) => !r.ok).length, checkedAt: rs.map((r) => r.checkedAt).filter(Boolean).sort().pop() ?? null }));
    return () => { live = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const stop = run(false); const i = window.setInterval(() => { if (document.visibilityState === 'visible') run(false); }, 5 * 60_000); return () => { stop(); window.clearInterval(i); }; }, [run]);
  return { ...st, refresh: () => run(true) };
}

/* ---------- the board: what a screen draws, frozen until the reader asks ---------- */
const SEEN_KEY = 'tripwire:newsSeen';
/** When the reader last looked at the news, per browser, never sent anywhere. 0 means never: nothing is then called new. */
export const lastVisitSec = (): number => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
export const markVisited = (nowSec = Math.floor(Date.now() / 1000)) => { try { localStorage.setItem(SEEN_KEY, String(nowSec)); } catch { /* private mode: nothing is then new */ } };

export function useNewsBoard(lists: Lists) {
  const c = useNewsStore(); const scr = useScreen(); const health = useNewsHealth();
  const covered = useMemo(() => new Set([...(c.snapshot?.scopes.paper ?? []), ...(c.snapshot?.scopes.covered ?? [])]), [c.snapshot]);
  const wanted = useMemo(() => [...new Set([...lists.follows, ...lists.paper])].filter((s) => !covered.has(s)).slice(0, 10), [lists.follows.join(), lists.paper.join(), covered]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = useMemo(() => new Map((scr.data?.rows ?? []).map((r) => [r.sym, r.name])), [scr.data]);
  const named = useMemo(() => wanted.filter((s) => nameOf.has(s)).map((s) => ({ sym: s, name: nameOf.get(s) as string })), [wanted, nameOf]);
  const live = useLiveNames(named);
  const candidate = useMemo(() => mergePools(c.snapshot?.events ?? [], live.events), [c.snapshot, live.events]);
  const ready = (c.loaded || !!c.snapshot) && !live.loading && (wanted.length === 0 || !scr.loading);
  const [applied, setApplied] = useState<{ pool: NewsEvent[]; at: number } | null>(null); const candRef = useRef(candidate); candRef.current = candidate;
  useEffect(() => { if (!applied && ready) setApplied({ pool: candidate, at: Date.now() }); }, [ready, applied, candidate]);   // first sight, or the next visit: a new instance starts from the newest data
  useEffect(() => { if (applied && applied.pool.length === 0 && candidate.length > 0) setApplied({ pool: candidate, at: Date.now() }); }, [applied, candidate]);   // nothing on screen to disturb: show it
  const apply = useCallback(() => setApplied({ pool: candRef.current, at: Date.now() }), []);
  const pending = applied ? newUpdates(todayList(applied.pool, 'all', lists, applied.at), todayList(candidate, 'all', lists, Date.now())) : 0;
  const refresh = useCallback(async () => { const [r] = await Promise.all([refreshNow(), live.refresh()]); if (r !== 'failed' && r !== 'checking') window.setTimeout(apply, 60); return r; }, [live, apply]);
  return { health, snapshot: c.snapshot, pool: applied?.pool ?? [], at: applied?.at ?? Date.now(), loading: !applied, pending, apply, refresh, refreshState: c.refresh, liveFailed: live.failed, liveChecked: live.checkedAt, hasSnapshot: !!c.snapshot };
}
