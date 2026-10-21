'use client';

// The share image (Pro §28): one 1200 × 630 card of a company's own figures, drawn in the browser. It carries the same
// facts the page shows, with the date they describe and the words "research, not advice". No target, no verdict to act
// on, nothing about the reader. Colours and fonts come from the page's own tokens, so the card matches the theme.
import type { Row } from './types.ts';
import type { Point } from './decision.ts';
import { dash, num, pct } from './format.ts';

export interface CardData { r: Row; bull: Point[]; bear: Point[]; asOf: string }

const W = 1200, H = 630, PAD = 64;

/** The lines the card prints, in order: kept separate from drawing so they can be tested without a canvas. */
export function cardLines({ r, bull, bear, asOf }: CardData) {
  const score = (k: 'q' | 'g' | 'v' | 'tech', l: string) => `${l} ${typeof r[k] === 'number' && Number.isFinite(r[k]) ? num(r[k], 0) : dash}`;
  return {
    title: r.name,
    sub: `${r.sym}${r.sector ? ` · ${r.sector}` : ''}`,
    price: typeof r.price === 'number' && Number.isFinite(r.price) ? `₹${num(r.price, 2)}` : dash,
    move: typeof r.r1d === 'number' && Number.isFinite(r.r1d) ? `${pct(r.r1d, 2)} on the day` : '',
    comp: typeof r.comp === 'number' && Number.isFinite(r.comp) ? `Composite ${num(r.comp, 0)} of 100` : 'Composite: unranked',
    scores: [score('q', 'Quality'), score('g', 'Growth'), score('v', 'Valuation'), score('tech', 'Technical')].join('   ·   '),
    forPts: bull.slice(0, 2).map((p) => p.text),
    againstPts: bear.slice(0, 2).map((p) => p.text),
    foot: `Close of ${asOf}. Research, not advice.   alpha.askakshay.com`,
  };
}

/** Wrap text to a width; returns at most `max` lines, the last ending in an ellipsis if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/), out: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width <= width) { line = t; continue; }
    if (line) out.push(line);
    line = w;
    if (out.length === max) break;
  }
  if (out.length < max && line) out.push(line);
  if (out.length === max && out.join(' ').length < text.length) out[max - 1] = `${out[max - 1].replace(/\s*\S*$/, '')}…`;
  return out;
}

export async function drawCard(d: CardData): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const css = getComputedStyle(document.documentElement);
  const tok = (k: string) => css.getPropertyValue(k).trim();
  const ui = tok('--f-ui') || 'system-ui', disp = tok('--f-display') || 'Georgia';
  await document.fonts?.ready;
  const L = cardLines(d);
  ctx.fillStyle = tok('--bg'); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = tok('--accent'); ctx.fillRect(0, 0, W, 8);
  ctx.textBaseline = 'top';
  ctx.fillStyle = tok('--text'); ctx.font = `500 54px ${disp}`;
  const title = wrap(ctx, L.title, W - PAD * 2 - 300, 2);
  title.forEach((t, i) => ctx.fillText(t, PAD, PAD + i * 62));
  let y = PAD + title.length * 62 + 6;
  ctx.fillStyle = tok('--dim'); ctx.font = `500 24px ${ui}`; ctx.fillText(L.sub, PAD, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = tok('--text'); ctx.font = `500 46px ${ui}`; ctx.fillText(L.price, W - PAD, PAD + 4);
  if (L.move) { ctx.fillStyle = (d.r.r1d ?? 0) < 0 ? tok('--down') : (d.r.r1d ?? 0) > 0 ? tok('--up') : tok('--dim'); ctx.font = `500 22px ${ui}`; ctx.fillText(L.move, W - PAD, PAD + 60); }
  ctx.textAlign = 'left';
  y += 52;
  ctx.fillStyle = tok('--accent-2'); ctx.font = `600 28px ${ui}`; ctx.fillText(L.comp, PAD, y);
  y += 42;
  ctx.fillStyle = tok('--muted'); ctx.font = `400 22px ${ui}`; ctx.fillText(L.scores, PAD, y);
  y += 54;
  ctx.strokeStyle = tok('--line-2'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, y - 18); ctx.lineTo(W - PAD, y - 18); ctx.stroke();
  const colW = (W - PAD * 2 - 40) / 2;
  const col = (x: number, head: string, pts: string[]) => {
    let yy = y;
    ctx.fillStyle = tok('--dim'); ctx.font = `600 18px ${ui}`; ctx.fillText(head.toUpperCase(), x, yy); yy += 32;
    ctx.fillStyle = tok('--text'); ctx.font = `400 21px ${ui}`;
    if (!pts.length) { ctx.fillStyle = tok('--dim'); ctx.fillText('Nothing on file stands out.', x, yy); return; }
    for (const p of pts) { for (const l of wrap(ctx, p, colW, 3)) { ctx.fillText(l, x, yy); yy += 28; } yy += 10; }
  };
  col(PAD, 'The case', L.forPts);
  col(PAD + colW + 40, 'The countercase', L.againstPts);
  ctx.fillStyle = tok('--dim'); ctx.font = `400 18px ${ui}`; ctx.fillText(L.foot, PAD, H - PAD + 18);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
