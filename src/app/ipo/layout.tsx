import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IPOs: open books, upcoming issues and recent listings',
  description: 'Live NSE subscription books, issues about to open with what the score does and does not measure, and how recent listings traded.',
  openGraph: { title: 'IPOs: open books, upcoming issues and recent listings', description: 'Live NSE subscription books, issues about to open with what the score does and does not measure, and how recent listings traded.', url: '/ipo/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
