import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Heat map of every screened stock',
  description: 'Colour almost any measure, size by market cap or turnover, group by sector or industry, and zoom into a sector. Includes a list view of leaders and laggards.',
  openGraph: { title: 'Heat map of every screened stock', description: 'Colour almost any measure, size by market cap or turnover, group by sector or industry, and zoom into a sector. Includes a list view of leaders and laggards.', url: '/map/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
