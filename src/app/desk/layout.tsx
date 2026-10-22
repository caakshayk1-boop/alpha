import type { Metadata } from 'next';
import '../desk.css';      // My Desk's own layer, loaded after premium.css

export const metadata: Metadata = {
  title: 'My Desk',
  description: 'The companies you follow, your research cards, journal and conditions in one place, with what needs review. Kept in this browser.',
  openGraph: { title: 'My Desk', description: 'The companies you follow, your research cards, journal and conditions in one place, with what needs review. Kept in this browser.', url: '/desk/', type: 'website' },
  robots: { index: false, follow: true },      // personal, browser-local content: nothing to index
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
