'use client';
/** /journal/ is My Desk's Journal tab. Pre-filled links (?s=&p=&sl=&t=) keep working. Same records, no copy. */
import Desk from '@/components/desk/Desk';

export default function Journal() {
  return <Desk start="journal" />;
}
