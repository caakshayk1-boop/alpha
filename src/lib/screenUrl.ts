/** Screen state <-> address bar, so refresh, Back from a company page and a shared link all restore the same view.
 *  Everything read from the address is untrusted: unknown measures, flags and sort keys are dropped, values must be numbers. */
export interface ScreenCond { f: string; op: '>=' | '<='; v: string }
export interface ScreenState {
  q: string;
  sector: string;
  tier: string;
  conds: ScreenCond[];
  flags: string[];
  lens: string;
  sort: string;
  dir: 1 | -1;
  ask: string;
  off: string[];
}
interface Has { has(key: string): boolean }
export interface ScreenAllow { fields: Has; flags: Has; lenses: Has; tiers: Has }

export const SCREEN_DEFAULT: ScreenState = { q: '', sector: '', tier: '', conds: [], flags: [], lens: '', sort: 'comp', dir: -1, ask: '', off: [] };
const MAX = 200;
const clip = (s: string | null) => (s ?? '').slice(0, MAX);

export function toQuery(s: ScreenState): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.sector) p.set('sector', s.sector);
  if (s.tier) p.set('size', s.tier);
  if (s.lens) p.set('lens', s.lens);
  for (const c of s.conds) if (c.v !== '') p.append('f', `${c.f}:${c.op === '>=' ? 'min' : 'max'}:${c.v}`);
  if (s.flags.length) p.set('only', s.flags.join(','));
  if (s.sort !== SCREEN_DEFAULT.sort || s.dir !== SCREEN_DEFAULT.dir) p.set('sort', `${s.sort}:${s.dir === 1 ? 'asc' : 'desc'}`);
  if (s.ask) p.set('ask', s.ask);
  if (s.off.length) p.set('off', s.off.join('|'));
  const out = p.toString();
  return out ? `?${out}` : '';
}

export function fromQuery(search: string, allow: ScreenAllow): ScreenState {
  const p = new URLSearchParams(search);
  const conds: ScreenCond[] = [];
  for (const raw of p.getAll('f').slice(0, 20)) {
    const m = /^([a-z0-9_]+):(min|max):(-?\d+(?:\.\d+)?)$/.exec(raw);
    if (m && allow.fields.has(m[1])) conds.push({ f: m[1], op: m[2] === 'min' ? '>=' : '<=', v: m[3] });
  }
  const [sortKey, sortDir] = clip(p.get('sort')).split(':');
  const lens = clip(p.get('lens'));
  const tier = clip(p.get('size'));
  return {
    q: clip(p.get('q')),
    sector: clip(p.get('sector')),
    tier: allow.tiers.has(tier) ? tier : '',
    conds,
    flags: clip(p.get('only')).split(',').filter((x) => allow.flags.has(x)),
    lens: allow.lenses.has(lens) ? lens : '',
    sort: sortKey && allow.fields.has(sortKey) ? sortKey : SCREEN_DEFAULT.sort,
    dir: sortKey && allow.fields.has(sortKey) ? (sortDir === 'asc' ? 1 : -1) : SCREEN_DEFAULT.dir,
    ask: clip(p.get('ask')),
    off: clip(p.get('off')).split('|').filter(Boolean),
  };
}
