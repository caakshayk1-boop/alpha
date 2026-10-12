import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Watchlist and research cards',
  description: 'A private watchlist and portable research cards kept in your browser, with export and import and no account.',
  openGraph: { title: 'Watchlist and research cards', description: 'A private watchlist and portable research cards kept in your browser, with export and import and no account.', url: '/watchlist/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
