/** The daily edition and the Saturday note as an email: subject, HTML and text, plus the one rule about whether anything may be sent (24 Nov 2026).
 *  Nothing here sends. tools/send-edition.mjs does, and only when sendPlan() says every switch is on. */
import { editionBlocks, weeklyBlocks, weeksOf, buildWeekly, blocksToHtml, blocksToText, DISCLAIMER, type Edition } from './edition.ts';
import { dmy } from './view.ts';

export interface Campaign { kind: 'daily' | 'weekly'; date: string; subject: string; html: string; text: string }
/** Brevo fills this placeholder with each recipient's own unsubscribe link; a campaign without one is not sent. */
export const UNSUBSCRIBE_HTML = '<p style="font-size:12px;color:#555;margin-top:24px">You asked for these notes on the Rulebook site. <a href="{{ unsubscribe }}">Unsubscribe</a>. ' + DISCLAIMER + '</p>';
const withFooter = (html: string) => html.replace('</div></body></html>', `${UNSUBSCRIBE_HTML}</div></body></html>`);
const withTextFooter = (text: string) => `${text}\n\nYou asked for these notes on the Rulebook site. To stop them, use the unsubscribe link in the email.\n`;

export function dailyCampaign(e: Edition): Campaign {
  const n = e.breakouts.listed.length, title = `Rulebook edition, ${dmy(e.date)}`;
  const subject = n ? `${title}: ${n} breakout observation${n === 1 ? '' : 's'}` : `${title}: no stock passed all eight checks`;
  const blocks = editionBlocks(e);
  return { kind: 'daily', date: e.date, subject, html: withFooter(blocksToHtml(title, blocks)), text: withTextFooter(blocksToText(title, blocks)) };
}
export function weeklyCampaign(all: Edition[]): Campaign | null {
  const w = weeksOf(all).at(-1); if (!w) return null; const k = buildWeekly(w); if (!k) return null;
  const title = `Rulebook weekly note, week to ${dmy(k.week_ending)}`, blocks = weeklyBlocks(k);
  return { kind: 'weekly', date: k.week_ending, subject: title, html: withFooter(blocksToHtml(title, blocks)), text: withTextFooter(blocksToText(title, blocks)) };
}

/** Sending is off unless ALL of these are present. Anything missing is named, so a dry run says what to set. */
export function sendPlan(env: Record<string, string | undefined>): { live: boolean; missing: string[] } {
  const need = ['EDITION_SEND', 'BREVO_API_KEY', 'BREVO_LIST_ID', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME'];
  const missing = need.filter((k) => !env[k] || (k === 'EDITION_SEND' && env[k] !== '1') || (k === 'BREVO_LIST_ID' && !(Number(env[k]) > 0)));
  return { live: missing.length === 0, missing };
}
