// Telegram bot Worker: answers the owner's commands and sends three weekday briefs in Malaysia time (08:00 plan, 12:00 open check, 18:30 close scorecard).
// Secrets (wrangler secret put): BOT_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET. Nothing here places an order.
import { handle, digest, SOURCES, esc } from './commands.js';
import { stockBrief } from './stock.js';
import { handleExtra, dueReminders } from './extras.js';
import { composeWeekly } from './weekly.js';
import { isQuiet, isMarketHours, ledgerAlerts, gateAlerts, watchAlerts, alertMessage, MAX_ALERT_MSGS_PER_HOUR } from './alerts.js';
import { NEWS_URL, rank, format } from './news.js';
import { SLOTS, TZ, dueSlot, gather, digestFeeds, snapshot, pickCandidates, compose } from './briefs.js';

const UA = 'askakshay-telegram-bot';

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function send(env, chatId, text, buttons) {
  const reply_markup = buttons && buttons.length ? { inline_keyboard: [buttons.map(([label, url]) => ({ text: label, url }))] } : undefined;
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup }),
  });
  return r.ok;
}

function notesApi(env) {
  const call = async (path, body) => (await env.NOTES.get(env.NOTES.idFromName('owner')).fetch('https://notes' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {})).json();
  return {
    add: async (text) => (await call('/add', { text })).n,
    list: async () => (await call('/list')).notes,
    del: async (n) => (await call('/del', { n })).ok,
  };
}

function storeApi(env) {
  const call = async (path, body) => (await env.NOTES.get(env.NOTES.idFromName('owner')).fetch('https://notes' + path, { method: 'POST', body: JSON.stringify(body) })).json();
  return {
    claim: async (key) => (await call('/slot/claim', { key })).ok,
    release: async (key) => call('/slot/release', { key }),
    pick: async (ids, n) => (await call('/sent/pick', { ids, n })).ids,
    mark: async (ids) => call('/sent/mark', { ids }),
    snapGet: async () => (await call('/snap/get', {})).snap,
    snapPut: async (snap) => call('/snap/put', { snap }),
    kvGet: async (key) => (await call('/kv', { key })).value,
    kvPut: async (key, value) => call('/kv', { key, value }),
  };
}

const sameSecret = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    if (request.method !== 'POST' || url.pathname !== '/telegram') return new Response('not found', { status: 404 });
    // Telegram echoes the secret set at setWebhook time. Anything else is not Telegram.
    if (!sameSecret(request.headers.get('x-telegram-bot-api-secret-token'), env.WEBHOOK_SECRET)) return new Response('forbidden', { status: 403 });
    let update;
    try { update = await request.json(); } catch { return new Response('ok'); }
    const msg = update && update.message;
    // Only the owner is ever answered. Everyone else gets silence.
    if (!msg || !msg.chat || String(msg.chat.id) !== String(env.OWNER_CHAT_ID) || typeof msg.text !== 'string') return new Response('ok');
    if (/^\/news(@\w+)?\s*$/i.test(msg.text.trim())) { await runNews(env, null); return new Response('ok'); }
    const brief = /^\/(morning|open|close|weekly)(@\w+)?\s*$/i.exec(msg.text.trim());
    if (brief) { await runBrief(env, SLOTS.find((x) => x.id === brief[1].toLowerCase()), null); return new Response('ok'); }
    const st = storeApi(env);
    const extra = await handleExtra(msg.text, { getJSON, watch: { list: async () => (await st.kvGet('watch')) || [], set: (v) => st.kvPut('watch', v) }, remind: { list: async () => (await st.kvGet('remind')) || [], set: (v) => st.kvPut('remind', v) } });
    if (extra !== null) { await send(env, msg.chat.id, extra); return new Response('ok'); }
    const reply = await handle(msg.text, { getJSON, notes: notesApi(env), stockBrief });
    if (reply) await send(env, msg.chat.id, reply);
    return new Response('ok');
  },

  // The cron fires every 5 minutes. Each tick: a brief if one is due, any reminders that have come due, then the alert checks.
  async scheduled(event, env, ctx) {
    if (!env.BOT_TOKEN || !env.OWNER_CHAT_ID) return;
    ctx.waitUntil(runTick(env, event.scheduledTime || Date.now()));
  },
};

/** One cron tick. Each part is isolated: a failure in one never stops the others. */
export async function runTick(env, now) {
  const due = dueSlot(now, env.NEWS_TZ || TZ);
  if (due) await runBrief(env, due.slot, due.key).catch(() => 'failed');
  await runReminders(env, now).catch(() => 'failed');
  await runAlerts(env, now).catch(() => 'failed');
}

/** Send reminders whose time has come. A reminder stays queued if Telegram refuses it. */
export async function runReminders(env, now) {
  const store = storeApi(env);
  const list = (await store.kvGet('remind')) || [];
  const { due, rest } = dueReminders(list, now);
  if (!due.length) return 'none';
  const kept = [];
  for (const r of due) if (!(await send(env, env.OWNER_CHAT_ID, `<b>Reminder</b>\n${esc(r.text)}`))) kept.push(r);
  await store.kvPut('remind', [...kept, ...rest]);
  return `sent ${due.length - kept.length}`;
}

/** Alerts between briefs: Tripwire ledger events, Alpha gate flips and the watchlist. Quiet 23:00-07:30 MYT; at most 6 alert messages an hour, one message per check.
 *  The first run only records a baseline. Snapshots are saved only after the message went out, so a failed send is retried. */
export async function runAlerts(env, now) {
  if (isQuiet(now)) return 'quiet';
  const store = storeApi(env);
  const recent = ((await store.kvGet('alog')) || []).filter((t) => t > now - 36e5);
  if (recent.length >= MAX_ALERT_MSGS_PER_HOUR) return 'rate limit';
  const get = async (u) => { try { return await getJSON(u); } catch { return null; } };
  const watch = (await store.kvGet('watch')) || [];
  const market = isMarketHours(now);
  const fetchNews = watch.length && new Date(now).getUTCMinutes() % 15 === 0;
  const TW = 'https://tripwire.askakshay.com/api/';
  const syms = watch.map((w) => encodeURIComponent(w.sym)).join(',');
  const [ledger, signals, tick, rsi, news] = await Promise.all([
    get(SOURCES.ledger), get(SOURCES.signals),
    watch.length && market ? get(`${TW}tick?s=${syms}`) : null, watch.length && market ? get(`${TW}rsi`) : null, fetchNews ? get(NEWS_URL) : null,
  ]);
  const prevA = await store.kvGet('asnap');
  const prevG = await store.kvGet('gsnap');
  const L = ledgerAlerts(prevA, ledger);
  const G = gateAlerts(prevG, signals);
  const W = watch.length ? watchAlerts({ watch, tick, rsi, events: news && news.events, alerted: (await store.kvGet('alerted')) || {}, wrsi: (await store.kvGet('wrsi')) || {}, nowMs: now, market }) : null;
  const lines = [...L.lines, ...G.lines, ...(W ? W.lines : [])];
  if (lines.length) {
    if (!(await send(env, env.OWNER_CHAT_ID, alertMessage(lines, now)))) return 'send failed';
    await store.kvPut('alog', [...recent, now]);
    if (W && W.newsIds.length) await store.mark(W.newsIds);
  }
  if (L.snap && (!prevA || L.lines.length)) await store.kvPut('asnap', L.snap);
  if (G.snap && (!prevG || G.lines.length)) await store.kvPut('gsnap', G.snap);
  if (W && (W.lines.length || market)) { await store.kvPut('alerted', W.alerted); await store.kvPut('wrsi', W.wrsi); }
  return `alerts ${lines.length}`;
}

/** One brief. key = the scheduled slot (claimed so it sends once, and the snapshot is saved); key null = on demand (no claim, snapshot untouched, news still marked sent so it never repeats). */
export async function runBrief(env, slot, key) {
  const store = storeApi(env);
  if (key && !(await store.claim(key))) return 'already sent';
  try {
    const { feeds, events } = await gather({ getJSON, newsUrl: NEWS_URL }, slot.id);
    const now = Date.now();
    if (slot.id === 'weekly') {
      const w = composeWeekly(feeds, now);
      if (!(await send(env, env.OWNER_CHAT_ID, w.text, w.buttons))) throw new Error('send failed');
      return 'sent weekly';
    }
    const st = digestFeeds(feeds, now);
    const ranked = pickCandidates(events, now, st);
    const ids = await store.pick(ranked.map((e) => e.eventClusterId), 5);
    const items = ranked.filter((e) => ids.includes(e.eventClusterId)).slice(0, 5);
    const { text, buttons } = compose(slot, st, await store.snapGet(), items, now);
    if (!(await send(env, env.OWNER_CHAT_ID, text, buttons))) throw new Error('send failed');
    await store.mark(items.map((e) => e.eventClusterId));
    if (key) await store.snapPut(snapshot(st, now));
    return `sent ${items.length}`;
  } catch (e) {
    if (key) await store.release(key);
    return 'failed';
  }
}

/** /news on demand: fetch, rank, drop what was already sent, send 10, then remember them. */
export async function runNews(env, slot) {
  const store = storeApi(env);
  if (slot && !(await store.claim(slot))) return 'already sent';
  try {
    const d = await getJSON(NEWS_URL);
    const ranked = rank(d.events, Date.now());
    const ids = await store.pick(ranked.map((e) => e.eventClusterId), 10);
    const items = ranked.filter((e) => ids.includes(e.eventClusterId)).slice(0, 10);
    const label = new Intl.DateTimeFormat('en-GB', { timeZone: env.NEWS_TZ || TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    if (!(await send(env, env.OWNER_CHAT_ID, format(items, label)))) throw new Error('send failed');
    await store.mark(items.map((e) => e.eventClusterId));
    return `sent ${items.length}`;
  } catch (e) {
    if (slot) await store.release(slot);
    return 'failed';
  }
}

/** One Durable Object holds the owner's notes. SQLite-backed, free plan; no namespace ID to create by hand. */
export class Notes {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const list = (await this.state.storage.get('notes')) || [];
    if (path === '/list') return Response.json({ notes: list });
    const body = await request.json();
    if (path === '/kv') {
      const k = String(body.key);
      if (!['watch', 'remind', 'asnap', 'gsnap', 'alog', 'alerted', 'wrsi'].includes(k)) return new Response('bad key', { status: 400 });
      if ('value' in body) { await this.state.storage.put('kv:' + k, body.value); return Response.json({ ok: true }); }
      return Response.json({ value: (await this.state.storage.get('kv:' + k)) ?? null });
    }
    if (path === '/snap/get') return Response.json({ snap: (await this.state.storage.get('snap')) || null });
    if (path === '/snap/put') { await this.state.storage.put('snap', body.snap); return Response.json({ ok: true }); }
    if (path === '/sent/pick') {
      const sent = (await this.state.storage.get('sent')) || {};
      return Response.json({ ids: (body.ids || []).filter((id) => !(id in sent)).slice(0, Number(body.n) || 10) });
    }
    if (path === '/sent/mark') {
      const sent = (await this.state.storage.get('sent')) || {};
      const now = Date.now();
      for (const id of body.ids || []) sent[id] = now;
      const keep = Object.entries(sent).filter(([, t]) => t > now - 14 * 864e5).sort((a, b) => b[1] - a[1]).slice(0, 2000);
      await this.state.storage.put('sent', Object.fromEntries(keep));
      return Response.json({ ok: true });
    }
    if (path === '/slot/claim') {
      const slots = (await this.state.storage.get('slots')) || [];
      if (slots.includes(body.key)) return Response.json({ ok: false });
      await this.state.storage.put('slots', [...slots, body.key].slice(-20));
      return Response.json({ ok: true });
    }
    if (path === '/slot/release') {
      const slots = (await this.state.storage.get('slots')) || [];
      await this.state.storage.put('slots', slots.filter((k) => k !== body.key));
      return Response.json({ ok: true });
    }
    if (path === '/add') {
      list.push({ text: String(body.text).slice(0, 500), at: new Date().toISOString() });
      while (list.length > 200) list.shift();
      await this.state.storage.put('notes', list);
      return Response.json({ n: list.length });
    }
    if (path === '/del') {
      const i = Number(body.n) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= list.length) return Response.json({ ok: false });
      list.splice(i, 1);
      await this.state.storage.put('notes', list);
      return Response.json({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }
}
