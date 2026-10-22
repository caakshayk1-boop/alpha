import '../support.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Weekly quantitative case studies',
  description: 'Quantitative case studies of seven listed companies each Saturday, written from the screen figures, checked for arithmetic and labelled as machine-written.',
  openGraph: { title: 'Weekly quantitative case studies', description: 'Quantitative case studies of seven listed companies each Saturday, written from the screen figures, checked for arithmetic and labelled as machine-written.', url: '/reads/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
