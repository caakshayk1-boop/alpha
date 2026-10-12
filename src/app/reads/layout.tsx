import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Weekly reads: company studies',
  description: 'Seven company studies each Saturday, written from the screen figures, checked for arithmetic and labelled as machine-written.',
  openGraph: { title: 'Weekly reads: company studies', description: 'Seven company studies each Saturday, written from the screen figures, checked for arithmetic and labelled as machine-written.', url: '/reads/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
