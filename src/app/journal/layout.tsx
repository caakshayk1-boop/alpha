import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decision journal',
  description: 'Write down why you took, skipped or watched a stock, then see where the price is now. Private, kept in your browser, with export and import.',
  openGraph: { title: 'Decision journal', description: 'Write down why you took, skipped or watched a stock, then see where the price is now. Private, kept in your browser.', url: '/journal/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
