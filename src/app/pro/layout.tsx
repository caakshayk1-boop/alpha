import type { Metadata } from 'next';

const description = 'Alpha Pro is coming: same-session data, change alerts, full history and exports, research memos. Never buy or sell calls. Join the waitlist.';
export const metadata: Metadata = {
  title: 'Alpha Pro — coming soon',
  description,
  alternates: { canonical: '/pro/' },
  openGraph: { title: 'Alpha Pro — coming soon', description, url: '/pro/', type: 'website', siteName: 'alpha', images: [{ url: '/og/alpha.png', width: 1200, height: 630, alt: 'alpha' }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
