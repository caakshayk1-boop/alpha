import type { Metadata } from 'next';
import '../discover.css';
import { companiesPhrase } from '@/lib/universe';

const N = companiesPhrase();

export const metadata: Metadata = {
  title: `Stock screen: ${N}`,
  description: `Screen ${N} listed on the NSE on 26 measures with presets, a plain-English query that shows what it understood and ignored, saved screens, export and comparison.`,
  openGraph: { title: `Stock screen: ${N}`, description: `Screen ${N} listed on the NSE on 26 measures with presets, a plain-English query that shows what it understood and ignored, saved screens, export and comparison.`, url: '/screen/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
