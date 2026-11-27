import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data status',
  description: 'Is each dataset current? For every feed Alpha reads: the session it describes, when it last refreshed, and whether it is current, delayed or stale.',
  openGraph: { title: 'Data status', description: 'Is each dataset current? For every feed Alpha reads: the session it describes, when it last refreshed, and whether it is current, delayed or stale.', url: '/status/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
