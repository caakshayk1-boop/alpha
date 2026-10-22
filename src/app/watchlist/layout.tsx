import type { Metadata } from 'next';
import '../desk.css';      // My Desk's own layer, loaded after premium.css

export const metadata: Metadata = {
  title: 'Following · My Desk',
  description: 'The companies you follow and your research cards, on My Desk: kept in your browser, with one export and import and no account.',
  openGraph: { title: 'Following · My Desk', description: 'The companies you follow and your research cards, on My Desk: kept in your browser, with one export and import and no account.', url: '/watchlist/', type: 'website' },
  robots: { index: false, follow: true },      // personal, browser-local content: nothing to index
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
