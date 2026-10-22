import type { Metadata } from 'next';
import '../discover.css';

export const metadata: Metadata = {
  title: 'Stock screen: nearly 1,000 Indian companies',
  description: 'Screen nearly 1,000 listed Indian companies on 26 measures with presets, a plain-English query that shows what it understood and ignored, saved screens, export and comparison.',
  openGraph: { title: 'Stock screen: nearly 1,000 Indian companies', description: 'Screen nearly 1,000 listed Indian companies on 26 measures with presets, a plain-English query that shows what it understood and ignored, saved screens, export and comparison.', url: '/screen/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
