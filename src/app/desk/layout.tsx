import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Desk',
  description: 'Your watchlist, saved screens, research cards and journal in one place, with what needs review. Kept in this browser.',
  openGraph: { title: 'My Desk', description: 'Your watchlist, saved screens, research cards and journal in one place, with what needs review. Kept in this browser.', url: '/desk/', type: 'website' },
  robots: { index: false, follow: true },      // personal, browser-local content: nothing to index
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
