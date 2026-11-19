// One view-transition name per tracked stock, for the screener row to stock header morph. Terminal pages only.
import { feedAvailable, loadFeed } from '../lib/feed.ts';
export const GET = () => new Response((feedAvailable() ? loadFeed().rows : []).map((r) => `[data-vt="stock-${r.sym}"]{view-transition-name:stock-${r.sym.replace(/[^A-Za-z0-9_-]/g, '_')}}`).join('\n') + '\n', { headers: { 'content-type': 'text/css' } });
