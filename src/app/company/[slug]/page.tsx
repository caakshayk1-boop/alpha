// One company per URL (/company/INFY/), so each of the ~990 screened companies has its own title, description and
// canonical address and can be found by search. The figures baked in here are from the last build and dated as such;
// the page swaps in the live slice (/c/<SYM>.json) as soon as it loads.
import type { Metadata } from 'next';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CompanyView } from '@/components/CompanyView';
import type { Shard } from '@/lib/data';
import { slugToSym, symToSlug } from '@/lib/slug';
import { num } from '@/lib/format';

export const dynamicParams = false;
const DIR = join(process.cwd(), 'public', 'c');

function shardOf(sym: string): Shard | null {
  try { return JSON.parse(readFileSync(join(DIR, `${sym}.json`), 'utf8')) as Shard; } catch { return null; }
}

export function generateStaticParams(): { slug: string }[] {
  let files: string[] = [];
  try { files = readdirSync(DIR).filter((f) => f.endsWith('.json')); } catch { /* no shards: the build carries on with no company pages */ }
  return files.map((f) => ({ slug: symToSlug(f.slice(0, -'.json'.length)) }));
}

const fmt = (v: number | null | undefined, dp = 1, unit = '') => (typeof v === 'number' && Number.isFinite(v) ? `${num(v, dp)}${unit}` : null);

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const sym = slugToSym(params.slug);
  const r = shardOf(sym)?.row;
  const name = r?.name ?? sym;
  const facts = [fmt(r?.pe, 1, '× P/E'), fmt(r?.roce, 1, '% ROCE'), fmt(r?.de, 2, ' debt/equity'), typeof r?.q === 'number' ? `quality score ${Math.round(r.q)}/100` : null].filter(Boolean).join(', ');
  const description = `${name} (${sym})${r?.sector ? `, ${r.sector}` : ''}: ${facts || 'scores, financials and ownership'}. Chart, scorecard, financials, ownership and look-alikes, every figure dated and sourced. Not investment advice.`;
  const title = `${name} (${sym}) share analysis`;
  return { title: { absolute: `${title} · alpha` }, description, alternates: { canonical: `/company/${symToSlug(sym)}/` }, openGraph: { title: `${title} · alpha`, description, url: `/company/${symToSlug(sym)}/`, type: 'website' } };
}

export default function Page({ params }: { params: { slug: string } }) {
  const sym = slugToSym(params.slug);
  return <CompanyView sym={sym} initial={shardOf(sym)} />;
}
