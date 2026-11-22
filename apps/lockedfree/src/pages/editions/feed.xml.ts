import { create } from 'xmlbuilder2';
import { editions } from '../../lib/data.ts'; import { editionBlocks, weeksOf, buildWeekly, weeklyBlocks, blocksToText } from '../../lib/edition.ts'; import { dmy } from '../../lib/view.ts';
const BASE = 'https://lockedfree.askakshay.com';
export function GET() {
  const eds = editions(), items = [
    ...eds.map((e) => ({ date: e.date, title: `Edition, ${dmy(e.date)}`, link: `${BASE}/editions/${e.date}/`, body: blocksToText(`Rulebook edition, ${dmy(e.date)}`, editionBlocks(e)) })),
    ...weeksOf(eds).map((w) => { const k = buildWeekly(w)!; return { date: k.week_ending, title: `Weekly note, week to ${dmy(k.week_ending)}`, link: `${BASE}/editions/week/${k.week_ending}/`, body: blocksToText(`Rulebook weekly note, week to ${dmy(k.week_ending)}`, weeklyBlocks(k)) }; }),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.title.localeCompare(a.title)).slice(0, 40);
  const ch = create({ version: '1.0', encoding: 'UTF-8' }).ele('rss', { version: '2.0' }).ele('channel');
  ch.ele('title').txt('Rulebook editions'); ch.ele('link').txt(`${BASE}/editions/`); ch.ele('description').txt('Daily breakout observations and a weekly note from Rulebook. Educational and paper-only; not investment advice.'); ch.ele('language').txt('en-IN');
  for (const i of items) { const it = ch.ele('item'); it.ele('title').txt(i.title); it.ele('link').txt(i.link); it.ele('guid', { isPermaLink: 'true' }).txt(i.link); it.ele('pubDate').txt(new Date(i.date + 'T12:00:00Z').toUTCString()); it.ele('description').txt(i.body); }
  return new Response(ch.end({ prettyPrint: true }), { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
