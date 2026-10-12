import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Results calendar',
  description: 'The next results date on file for each screened company, largest first, with the caveat that dates are provisional until the exchange shows them.',
  openGraph: { title: 'Results calendar', description: 'The next results date on file for each screened company, largest first, with the caveat that dates are provisional until the exchange shows them.', url: '/calendar/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
