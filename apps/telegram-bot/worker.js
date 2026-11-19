// Telegram bot Worker: answers the owner's commands and sends the top-10 news at 08:00, 12:00, 16:00, 20:00 and 00:00.
// Secrets (wrangler secret put): BOT_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET. Nothing here places an order.
import { handle, digest } from './commands.js';
import { NEWS_URL, rank, format, slotKey } from './news.js';

const UA = 'askakshay-telegram-bot';

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function send(env, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
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
    const reply = await handle(msg.text, { getJSON, notes: notesApi(env) });
    if (reply) await send(env, msg.chat.id, reply);
    return new Response('ok');
  },

  // Cron fires at :00 and :30 UTC; slotKey() decides whether this tick is a send hour in NEWS_TZ (default Asia/Kolkata).
  async scheduled(event, env, ctx) {
    if (!env.BOT_TOKEN || !env.OWNER_CHAT_ID) return;
    const key = slotKey(event.scheduledTime || Date.now(), env.NEWS_TZ || 'Asia/Kolkata');
    if (!key) return;
    ctx.waitUntil(runNews(env, key));
  },
};

/** Fetch, rank, drop what was already sent, send 10, then remember them. A failed send releases the slot so the next tick retries. */
export async function runNews(env, slot) {
  const store = storeApi(env);
  if (slot && !(await store.claim(slot))) return 'already sent';
  try {
    const d = await getJSON(NEWS_URL);
    const ranked = rank(d.events, Date.now());
    const ids = await store.pick(ranked.map((e) => e.eventClusterId), 10);
    const items = ranked.filter((e) => ids.includes(e.eventClusterId)).slice(0, 10);
    const label = new Intl.DateTimeFormat('en-GB', { timeZone: env.NEWS_TZ || 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
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
