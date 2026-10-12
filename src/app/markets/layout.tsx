import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Markets: indices, sectors, commodities and rates',
  description: 'Live quotes for Indian and world indices, commodities, currencies and rates, with a plain-language market stance and breadth tests from the screened universe.',
  openGraph: { title: 'Markets: indices, sectors, commodities and rates', description: 'Live quotes for Indian and world indices, commodities, currencies and rates, with a plain-language market stance and breadth tests from the screened universe.', url: '/markets/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
