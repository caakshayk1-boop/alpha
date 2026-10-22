'use client';
/** /watchlist/ is My Desk's Following tab (bookmarks keep working; #cards opens Research cards). Same records, no copy. */
import Desk from '@/components/desk/Desk';

export default function Watchlist() {
  return <Desk start="following" />;
}
