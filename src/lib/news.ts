/** News helpers: grouping of repeated coverage, and matching a story to companies with the basis shown. Pure, so it is tested directly. */
export interface Story { title: string; summary: string; link: string; source: string; published?: string | null }
export interface Group<T extends Story = Story> { lead: T; more: T[] }

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'as', 'at', 'by', 'is', 'are', 'its', 'with', 'from', 'after', 'over', 'amid', 'says', 'said', 'will', 'new', 'up', 'down']);
const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 0; };

/** Stories about the same event: another source with a near-identical headline. Order is kept; the earliest listed is the lead. */
export function groupStories<T extends Story>(items: T[], threshold = 0.6): Group<T>[] {
  const out: { g: Group<T>; t: Set<string> }[] = [];
  for (const it of items) {
    const t = tokens(it.title);
    const hit = t.size >= 4 ? out.find((o) => o.g.lead.source !== it.source && jaccard(o.t, t) >= threshold) : undefined;
    if (hit) hit.g.more.push(it); else out.push({ g: { lead: it, more: [] }, t });
  }
  return out.map((o) => o.g);
}

export interface Co { sym: string; name: string }
const SUFFIX = /\b(ltd|limited|inc|corp|corporation|company|co|industries|industry|enterprises|india|private|pvt|plc)\b\.?/gi;
export const shortName = (name: string) => name.replace(SUFFIX, ' ').replace(/[^A-Za-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Companies a story mentions, each with why: the ticker as a standalone capitalised word, or the company's name as a whole phrase. */
export function matchCompanies(text: string, cos: Co[]): { sym: string; basis: string }[] {
  const out: { sym: string; basis: string }[] = [];
  for (const c of cos) {
    const nm = shortName(c.name);
    if (c.sym.length >= 3 && new RegExp(`(^|[^A-Za-z0-9])${esc(c.sym)}([^A-Za-z0-9]|$)`).test(text)) out.push({ sym: c.sym, basis: `ticker ${c.sym} in the text` });
    else if (nm.length >= 5 && new RegExp(`(^|[^A-Za-z0-9])${esc(nm)}([^A-Za-z0-9]|$)`, 'i').test(text)) out.push({ sym: c.sym, basis: `name “${nm}” in the text` });
  }
  return out;
}
