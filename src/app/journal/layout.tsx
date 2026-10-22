import type { Metadata } from 'next';
import '../desk.css';      // My Desk's own layer, loaded after premium.css

export const metadata: Metadata = {
  title: 'Journal · My Desk',
  description: 'Write down why you took, skipped or watched a stock, then see where the price is now. Private, kept in your browser, with export and import.',
  openGraph: { title: 'Journal · My Desk', description: 'Write down why you took, skipped or watched a stock, then see where the price is now. Private, kept in your browser.', url: '/journal/', type: 'website' },
  robots: { index: false, follow: true },      // personal, browser-local content: nothing to index
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
