import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Engines: five models tested on data they never saw',
  description: 'Five machine-learning models that rank Indian stocks, shown with ranking skill, net trading result after costs, holdout tests against random picks, and their limits.',
  openGraph: { title: 'Engines: five models tested on data they never saw', description: 'Five machine-learning models that rank Indian stocks, shown with ranking skill, net trading result after costs, holdout tests against random picks, and their limits.', url: '/engines/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
