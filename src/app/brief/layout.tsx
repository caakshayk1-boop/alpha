import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The brief in five minutes',
  description: 'Where the Indian market stands, what moved, what changed in the screen, which results are due and what the engines say, each figure stamped with the session it describes.',
  openGraph: { title: 'The brief in five minutes', description: 'Where the Indian market stands, what moved, what changed in the screen, which results are due and what the engines say, each figure stamped with the session it describes.', url: '/brief/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
