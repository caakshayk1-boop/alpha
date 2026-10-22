import '../support.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research',
  description: 'Look up a company, compare up to four, read the weekly studies, and see the experimental signal book and its paper trades.',
  openGraph: { title: 'Research', description: 'Look up a company, compare up to four, read the weekly studies, and see the experimental signal book and its paper trades.', url: '/research/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
