import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Method, sources and data dates',
  description: 'Where every dataset comes from, which session it describes and when it last refreshed, what the engines are and are not, and how missing data is handled.',
  openGraph: { title: 'Method, sources and data dates', description: 'Where every dataset comes from, which session it describes and when it last refreshed, what the engines are and are not, and how missing data is handled.', url: '/about/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
