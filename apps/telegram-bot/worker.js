// Telegram bot Worker: answers the owner's commands and sends three weekday briefs in Malaysia time (08:00 plan, 12:00 open check, 18:30 close scorecard).
// Secrets (wrangler secret put): BOT_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET. Nothing here places an order.
import { handle, digest } from './commands.js';
import { stockBrief } from './stock.js';
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
    const brief = /^\/(morning|open|close)(@\w+)?\s*$/i.exec(msg.text.trim());
    if (brief) { await runBrief(env, SLOTS.find((x) => x.id === brief[1].toLowerCase()), null); return new Response('ok'); }
    const reply = await handle(msg.text, { getJSON, notes: notesApi(env), stockBrief });
    if (reply) await send(env, msg.chat.id, reply);
    return new Response('ok');
  },

  // Cron fires at :00 and :30. dueSlot() says whether this tick starts a brief (Mon-Fri 08:00, 12:00, 18:30 in NEWS_TZ, default Asia/Kuala_Lumpur).
  async scheduled(event, env, ctx) {
    if (!env.BOT_TOKEN || !env.OWNER_CHAT_ID) return;
    const due = dueSlot(event.scheduledTime || Date.now(), env.NEWS_TZ || TZ);
    if (!due) return;
    ctx.waitUntil(runBrief(env, due.slot, due.key));
  },
};

/** One brief. key = the scheduled slot (claimed so it sends once, and the snapshot is saved); key null = on demand (no claim, snapshot untouched, news still marked sent so it never repeats). */
export async function runBrief(env, slot, key) {
  const store = storeApi(env);
  if (key && !(await store.claim(key))) return 'already sent';
  try {
    const { feeds, events } = await gather({ getJSON, newsUrl: NEWS_URL });
    const now = Date.now();
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
