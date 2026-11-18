import { loadFeed } from '../../lib/feed.ts';
export const GET = () => new Response(JSON.stringify(loadFeed().rows.map((r) => [r.sym, r.name, r.sector ?? ''])), { headers: { 'content-type': 'application/json' } });
