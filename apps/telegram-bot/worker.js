// Telegram bot Worker: answers the owner's commands and sends a twice-daily digest.
// Secrets (wrangler secret put): BOT_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET. Nothing here places an order.
import { handle, digest } from './commands.js';

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
    const reply = await handle(msg.text, { getJSON, notes: notesApi(env) });
    if (reply) await send(env, msg.chat.id, reply);
    return new Response('ok');
  },

  // Crons in wrangler.telegram.jsonc: 09:15 and 16:00 IST on weekdays.
  async scheduled(_event, env, ctx) {
    if (!env.BOT_TOKEN || !env.OWNER_CHAT_ID) return;
    ctx.waitUntil(digest({ getJSON, notes: null }).then((t) => send(env, env.OWNER_CHAT_ID, t)));
  },
};

/** One Durable Object holds the owner's notes. SQLite-backed, free plan; no namespace ID to create by hand. */
export class Notes {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const list = (await this.state.storage.get('notes')) || [];
    if (path === '/list') return Response.json({ notes: list });
    const body = await request.json();
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
