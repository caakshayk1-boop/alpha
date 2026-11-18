import { SCREENS } from '../lib/screens.ts'; import { details, DEMO } from '../lib/data.ts';
export const GET = () => {
  const base = 'https://lockedfree.askakshay.com', paths = ['/', '/screens/', '/gate/', '/gate/journal/', '/gate/rules/', '/plan/', '/ledger/', '/ledger/voids/', '/ledger/refusals/', '/about/', '/methodology/'];
  for (const s of SCREENS) { paths.push(`/screens/${s.id}/`, `/screens/${s.id}/methodology/`, `/screens/${s.id}/archive/`); const d = details(s.id).pop(); if (d) for (const sym of Object.keys(d.stocks)) paths.push(`/screens/${s.id}/${sym}/`); }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${(DEMO ? [] : paths).map((p) => `<url><loc>${base}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
};
