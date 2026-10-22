import type { Metadata } from 'next';
import '../discover.css';

export const metadata: Metadata = {
  title: 'Compare companies side by side',
  description: 'Up to four companies on the same measures, with missing values left out of the best-value marks.',
  openGraph: { title: 'Compare companies side by side', description: 'Up to four companies on the same measures, with missing values left out of the best-value marks.', url: '/compare/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
