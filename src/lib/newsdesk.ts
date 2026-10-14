/** The logic behind the News desk: themes, time buckets, which companies a story names, and the numbers that summarise a day of stories.
 *  Pure functions, tested directly. Nothing here predicts or rates: every label comes from words that are in the story, and the basis is kept so the page can show it. */
import type { Co, Story } from './news.ts';

export type TopicId = 'markets' | 'companies' | 'policy' | 'economy' | 'commodities' | 'global';
export const TOPICS: readonly { id: TopicId; label: string; re: RegExp }[] = [
  { id: 'markets', label: 'Markets', re: /\b(nifty|sensex|markets?|stocks?|shares?|index|indices|equit(y|ies)|rall(y|ies)|sell-?off|bulls?|bears?)\b/i },
  { id: 'companies', label: 'Companies', re: /\b(results?|profits?|earnings|quarter(ly)?|q[1-4]|ipo|acquisitions?|acquires?|stake|orders?|deals?|mergers?|dividends?|buy-?back)\b/i },
  { id: 'policy', label: 'Policy and regulators', re: /\b(sebi|rbi|government|govt|ministry|finance minister|regulators?|tax(es)?|budget|gst|policy|norms|rules)\b/i },
  { id: 'economy', label: 'Economy', re: /\b(inflation|gdp|economy|economic|fiscal|trade deficit|exports?|imports?|jobs|cpi|wpi|growth)\b/i },
  { id: 'commodities', label: 'Commodities and currency', re: /\b(oil|crude|brent|gold|silver|rupee|dollar|currency|commodit(y|ies)|forex|copper)\b/i },
  { id: 'global', label: 'Global', re: /\b(u\.?s\.?|fed|federal reserve|china|europe|middle east|israel|iran|saudi|ukraine|wall street|nasdaq|dow|yemen|houthi)\b/i },
];

/** Every theme whose words appear in the headline or summary. A story can have several, or none. */
export const topicsOf = (text: string): TopicId[] => TOPICS.filter((t) => t.re.test(text)).map((t) => t.id);

/** India's calendar date (UTC+5:30) of an ISO instant, as YYYY-MM-DD. */
const istDay = (ms: number) => new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10);

export type Bucket = 'Last 3 hours' | 'Earlier today' | 'Yesterday' | 'Older' | 'Time not stated';
export const BUCKETS: readonly Bucket[] = ['Last 3 hours', 'Earlier today', 'Yesterday', 'Older', 'Time not stated'];
export function bucketOf(published: string | null | undefined, now: number): Bucket {
  const t = published ? new Date(published).getTime() : NaN;
  if (!Number.isFinite(t)) return 'Time not stated';
  if (t > now) return 'Last 3 hours';                      // a clock a little ahead of ours is still "now", not the future
  if (now - t <= 3 * 3600e3) return 'Last 3 hours';
  const d = istDay(t), today = istDay(now);
  if (d === today) return 'Earlier today';
  return d === istDay(now - 864e5) ? 'Yesterday' : 'Older';
}

/** The company's name as a newspaper would print it in full: only the legal ending is dropped, so "Reliance Industries" stays whole and a bare "Reliance" (several companies) does not match. */
const coreName = (name: string) => name.replace(/\b(ltd|limited|pvt|private|plc|inc)\b\.?/gi, ' ').replace(/[^A-Za-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export interface Mention { sym: string; basis: string }

export interface NewsCo extends Co { mcap?: number | null }
/** First words that are ordinary words or places, never a company's brand on their own. */
const GENERIC = new Set(['general', 'national', 'international', 'global', 'central', 'united', 'indian', 'digital', 'natural', 'industrial', 'financial', 'capital', 'energy', 'madhya', 'karnataka', 'andhra', 'gujarat', 'maharashtra', 'universal', 'advanced', 'integrated', 'consolidated', 'imperial', 'eastern', 'western', 'northern', 'southern']);
const BRAND_MIN_MCAP_CR = 20_000;

/** Builds the matcher once for a company list. A company is named in a story when:
 *   1. its ticker is written in capitals as its own word (3+ letters), or
 *   2. its full name, without "Ltd" or "Limited", is written as in the master list and is not the tail of a longer name
 *      (so "Bank of India" does not match inside "Reserve Bank of India"), or
 *   3. it is a large company (market cap of 20,000 crore or more), its first word is written capitalised, is 6+ letters, is not an ordinary word or place,
 *      and NO other company in the list starts with that word (so "Infosys" counts; "Reliance", "Tata" and "Bharat" never do).
 *  Each match carries the rule it matched on, so the page can show why. */
export function makeMatcher(cos: NewsCo[]): (text: string) => Mention[] {
  const first = new Map<string, number>();
  const rules = cos.map((c) => {
    const nm = coreName(c.name), w = nm.split(' ')[0] ?? '';
    first.set(w.toLowerCase(), (first.get(w.toLowerCase()) ?? 0) + 1);
    return { c, nm, w };
  });
  const word = (x: string) => new RegExp(`(^|[^A-Za-z0-9&])(${esc(x)})(?=[^A-Za-z0-9&]|$)`, 'g');
  // a name written right after another capitalised word is part of a longer name ("Reserve Bank of India")
  const standalone = (re: RegExp, text: string) => {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const at = m.index + m[1].length;
      if (!/(^|[\s(])[A-Z][A-Za-z&.]*\s+$/.test(text.slice(Math.max(0, at - 24), at)) || at === 0) return true;
    }
    return false;
  };
  const compiled = rules.map(({ c, nm, w }) => ({
    sym: c.sym,
    tick: c.sym.length >= 3 ? word(c.sym) : null,
    full: nm.length >= 5 ? { re: word(nm), nm } : null,
    brand: (c.mcap ?? 0) >= BRAND_MIN_MCAP_CR && w.length >= 6 && /^[A-Z]/.test(w) && !GENERIC.has(w.toLowerCase()) && first.get(w.toLowerCase()) === 1 ? { re: word(w), w } : null,
  }));
  return (text) => {
    const out: Mention[] = [];
    for (const r of compiled) {
      if (r.tick && standalone(r.tick, text)) out.push({ sym: r.sym, basis: `ticker ${r.sym}` });
      else if (r.full && standalone(r.full.re, text)) out.push({ sym: r.sym, basis: `“${r.full.nm}”` });
      else if (r.brand && standalone(r.brand.re, text)) out.push({ sym: r.sym, basis: `“${r.brand.w}” (a large company, and no other starts with it)` });
    }
    return out;
  };
}
export const mentionsIn = (text: string, cos: NewsCo[]): Mention[] => makeMatcher(cos)(text);

export interface Desk {
  stories: number;
  sources: number;
  /** Stories per theme, most covered first, themes with none left out. */
  themes: { id: TopicId; label: string; n: number }[];
  /** Companies named, with how many stories name each, most first. */
  names: { sym: string; n: number }[];
  /** Sectors of the companies named, with the number of distinct companies. */
  sectors: { sector: string; n: number }[];
}

export function summarise(items: { story: Story; topics: TopicId[]; mentions: Mention[] }[], sectorOf: (sym: string) => string | undefined): Desk {
  const th = new Map<TopicId, number>(), nm = new Map<string, number>(), sec = new Map<string, Set<string>>();
  for (const { topics, mentions } of items) {
    for (const t of topics) th.set(t, (th.get(t) ?? 0) + 1);
    for (const m of mentions) {
      nm.set(m.sym, (nm.get(m.sym) ?? 0) + 1);
      const s = sectorOf(m.sym);
      if (s) (sec.get(s) ?? sec.set(s, new Set()).get(s))!.add(m.sym);
    }
  }
  return {
    stories: items.length,
    sources: new Set(items.map((i) => i.story.source)).size,
    themes: TOPICS.map((t) => ({ id: t.id, label: t.label, n: th.get(t.id) ?? 0 })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n),
    names: [...nm].map(([sym, n]) => ({ sym, n })).sort((a, b) => b.n - a.n || a.sym.localeCompare(b.sym)),
    sectors: [...sec].map(([sector, s]) => ({ sector, n: s.size })).sort((a, b) => b.n - a.n || a.sector.localeCompare(b.sector)),
  };
}
