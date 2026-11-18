// Build-time share cards. Always labelled paper-only / simulated. Plain system fonts: the SVG rasteriser cannot load web fonts.
import sharp from 'sharp'; import { SCREENS } from '../../lib/screens.ts'; import { details } from '../../lib/data.ts';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = (kicker: string, title: string, line: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FAF7F0"/><rect x="48" y="48" width="1104" height="534" rx="10" fill="#FFFDF8" stroke="#E4DED0" stroke-width="2"/>
<g stroke="#E4DED0" stroke-width="2"><path d="M96 150H1104M96 240H1104M96 330H1104M96 420H1104"/></g><text x="96" y="120" font-family="monospace" font-size="26" fill="#5C665E" letter-spacing="2">${esc(kicker.toUpperCase())}</text>
<text x="96" y="300" font-family="Georgia, serif" font-size="84" font-weight="600" fill="#16211B">${esc(title)}</text><text x="96" y="392" font-family="Georgia, serif" font-size="44" fill="#0E5E42">${esc(line)}</text>
<text x="96" y="520" font-family="monospace" font-size="26" fill="#5C665E">Rulebook · lockedfree.askakshay.com</text><text x="96" y="556" font-family="monospace" font-size="22" fill="#5C665E">Paper-only · simulated, not real returns · not advice</text></svg>`;
export function getStaticPaths() {
  const out = [{ params: { name: 'default' }, props: { svg: card('Rulebook', 'Rules first.', 'Results in public, with every loss.') } }];
  for (const s of SCREENS) { out.push({ params: { name: `screen-${s.id}` }, props: { svg: card('Screen', s.name, 'Fixed rules. A short list, or none.') } }); const d = details(s.id).pop(); if (!d) continue;
    for (const [sym, st] of Object.entries(d.stocks)) { const n = st.rules.filter((r) => r.pass).length; out.push({ params: { name: `stock-${s.id}-${sym}` }, props: { svg: card(s.name, sym, st.passes ? `Passed ${n} of ${st.rules.length} rules` : st.scorable ? `Failed ${st.rules.length - n} of ${st.rules.length} rules` : 'Not scorable: input missing') } }); } }
  return out;
}
export const GET = async ({ props }: { props: { svg: string } }) => new Response(await sharp(Buffer.from(props.svg)).png().toBuffer(), { headers: { 'content-type': 'image/png' } });
