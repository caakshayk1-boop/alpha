// Emails the latest daily edition (or, with --weekly, the latest weekly note) to the Brevo list. DRY RUN BY DEFAULT: it renders the email and prints what it would do.
// It sends only when sendPlan() finds every switch on: EDITION_SEND=1 plus BREVO_API_KEY, BREVO_LIST_ID, BREVO_SENDER_EMAIL and BREVO_SENDER_NAME. A sent edition is recorded in
// ledger/sent.json so the same one is never sent twice. UNTESTED against the live Brevo API: try it with a one-address list first. (24 Nov 2026)
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
import { dailyCampaign, weeklyCampaign, sendPlan } from '../src/lib/mail.ts';
const dir = join(process.cwd(), 'ledger'), eds = readdirSync(join(dir, 'editions')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(dir, 'editions', f), 'utf8')));
if (!eds.length) { console.log('no editions yet; nothing to send'); process.exit(0); }
const weekly = process.argv.includes('--weekly'), c = weekly ? weeklyCampaign(eds) : dailyCampaign(eds.at(-1));
if (!c) { console.log('no weekly note yet'); process.exit(0); }
const sentFile = join(dir, 'sent.json'), sent = existsSync(sentFile) ? JSON.parse(readFileSync(sentFile, 'utf8')) : {}, key = `${c.kind}:${c.date}`;
console.log(`${c.kind} ${c.date}: "${c.subject}" (${c.html.length} bytes html, ${c.text.length} bytes text)`);
if (sent[key]) { console.log(`already sent on ${sent[key]}; not sending again`); process.exit(0); }
const plan = sendPlan(process.env);
if (!plan.live) { console.log(`DRY RUN: not sending. Missing or off: ${plan.missing.join(', ')}`); process.exit(0); }
const H = { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' };
const make = await fetch('https://api.brevo.com/v3/emailCampaigns', { method: 'POST', headers: H, body: JSON.stringify({ name: `${key}`, subject: c.subject, sender: { name: process.env.BREVO_SENDER_NAME, email: process.env.BREVO_SENDER_EMAIL }, type: 'classic', htmlContent: c.html, recipients: { listIds: [Number(process.env.BREVO_LIST_ID)] } }) });
if (!make.ok) { console.error(`Brevo refused the campaign: ${make.status} ${(await make.text()).slice(0, 300)}`); process.exit(1); }
const { id } = await make.json();
const go = await fetch(`https://api.brevo.com/v3/emailCampaigns/${id}/sendNow`, { method: 'POST', headers: H });
if (!go.ok) { console.error(`Brevo created campaign ${id} but would not send it: ${go.status} ${(await go.text()).slice(0, 300)}`); process.exit(1); }
mkdirSync(dir, { recursive: true }); sent[key] = new Date().toISOString(); writeFileSync(sentFile, JSON.stringify(sent, null, 1) + '\n'); console.log(`sent campaign ${id}`);
