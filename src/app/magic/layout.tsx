import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Magic Formula: a Greenblatt-inspired ranking',
  description: 'Eligible Indian companies ranked on return on capital and earnings yield, with the exclusions and the places this implementation differs from the book.',
  openGraph: { title: 'Magic Formula: a Greenblatt-inspired ranking', description: 'Eligible Indian companies ranked on return on capital and earnings yield, with the exclusions and the places this implementation differs from the book.', url: '/magic/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
