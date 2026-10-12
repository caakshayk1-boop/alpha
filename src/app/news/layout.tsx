import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'News from Indian markets',
  description: 'Headlines from publishers, filtered by topic and source, with publication times.',
  openGraph: { title: 'News from Indian markets', description: 'Headlines from publishers, filtered by topic and source, with publication times.', url: '/news/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
