// Rulebook Worker: static assets plus two routes. POST /api/subscribe stores an email and consent in a SQLite Durable Object; GET /api/health.
// No prices, no accounts, no tracking. Nothing is sent by email from here. Admin export needs the ADMIN_TOKEN secret and is off without it.
import { DurableObject } from 'cloudflare:workers';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/, CONSENT = 'weekly-note-v1';
const SEC = { 'x-content-type-options': 'nosniff', 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'cross-origin-opener-policy': 'same-origin', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEC } });
export class Subscribers extends DurableObject {
  constructor(ctx, env) { super(ctx, env); ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS subs (email TEXT PRIMARY KEY, consent TEXT NOT NULL, at TEXT NOT NULL)'); }
  add(email, consent, at) { this.ctx.storage.sql.exec('INSERT OR IGNORE INTO subs (email, consent, at) VALUES (?, ?, ?)', email, consent, at); return true; }
  all() { return this.ctx.storage.sql.exec('SELECT email, consent, at FROM subs ORDER BY at').toArray(); }
  remove(email) { this.ctx.storage.sql.exec('DELETE FROM subs WHERE email = ?', email); return true; }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true, at: new Date().toISOString() });
    if (url.pathname === '/api/subscribe' && req.method === 'POST') {
      const origin = req.headers.get('origin'); if (origin && new URL(origin).host !== url.host) return json({ error: 'Not allowed.' }, 403);
      if (env.SUBSCRIBE_LIMIT) { const ip = req.headers.get('cf-connecting-ip') || 'x'; const { success } = await env.SUBSCRIBE_LIMIT.limit({ key: ip }); if (!success) return json({ error: 'Too many tries. Wait a minute.' }, 429); }
      let form; try { form = await req.formData(); } catch { return json({ error: 'That did not look like a form.' }, 400); }
      const wantsHtml = (req.headers.get('accept') || '').includes('text/html'); const done = () => (wantsHtml ? new Response(null, { status: 303, headers: { location: '/?subscribed=1#join', ...SEC } }) : json({ ok: true }));
      if (String(form.get('website') || '')) return done();                                  // honeypot: look successful, store nothing
      const email = String(form.get('email') || '').trim().toLowerCase();
      if (!EMAIL.test(email) || email.length > 254) return json({ error: 'That email address does not look right.' }, 400);
      if (form.get('consent') !== CONSENT) return json({ error: 'Consent is needed to join the list.' }, 400);
      await env.SUBSCRIBERS.get(env.SUBSCRIBERS.idFromName('main')).add(email, CONSENT, new Date().toISOString()); return done();
    }
    if (url.pathname === '/api/subscribers' && env.ADMIN_TOKEN) {                           // owner export and deletion on request; off unless the secret is set
      const given = req.headers.get('authorization') || ''; if (given.length !== env.ADMIN_TOKEN.length + 7 || given !== 'Bearer ' + env.ADMIN_TOKEN) return json({ error: 'No.' }, 401);
      const stub = env.SUBSCRIBERS.get(env.SUBSCRIBERS.idFromName('main')); if (req.method === 'DELETE') { await stub.remove(url.searchParams.get('email') || ''); return json({ ok: true }); } return json({ rows: await stub.all() });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(req);
  },
};
