import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy and terms',
  description: 'What alpha keeps, where it keeps it, and what is ever sent anywhere.',
  openGraph: { title: 'Privacy and terms', description: 'What alpha keeps, where it keeps it, and what is ever sent anywhere.', url: '/privacy/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
