// worker/waitlist.js — the Alpha Pro waitlist (Lane A, Phase 0). One email list, nothing else.
//
// Stored server-side in a SQLite-backed Durable Object (free plan, the same mechanism as the explainer quota and the speed
// histograms): email, created_at, source page, referrer, status (pending, confirmed, unsubscribed) and the opaque token that
// confirms or unsubscribes. Double opt-in: an address is only "confirmed" after its owner opens the link in the confirmation
// mail; every mail carries a one-click unsubscribe. The owner exports the list as CSV with a bearer token; nobody else can read
// it. Deletion: the unsubscribe link in every mail deletes the address; the owner can also delete one on request.
//
// OFF until configured. With no MAIL_TOKEN / MAIL_FROM secret the join endpoint answers 503 and stores nothing, so the page can
// never claim a confirmation mail was sent when none was. Mail goes through Zoho ZeptoMail's HTTP API (Zoho's transactional
// mail, sent from the askakshay.com domain once the domain is verified there); the provider is the one function `sendMail`.

const MAX_EMAIL = 254;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const SOURCES = new Set(['pro', 'home', 'footer']);

/** A normalised address, or null: trimmed, lower-cased, a plausible mailbox, at most 254 characters. */
export function normaliseEmail(v) {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  if (!e || e.length > MAX_EMAIL || !EMAIL_RE.test(e)) return null;
  return e;
}
export const normaliseSource = (v) => (typeof v === 'string' && SOURCES.has(v) ? v : 'pro');
/** The referrer kept as an origin and path only (no query, no fragment), and only when it is a web address. */
export function normaliseReferrer(v) {
  if (typeof v !== 'string' || !v) return null;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? `${u.origin}${u.pathname}`.slice(0, 300) : null; } catch { return null; }
}

/** CSV with spreadsheet-formula protection: a cell that opens with = + - @ (or a tab/CR) is prefixed with a quote. */
export function toCsv(rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['email', 'status', 'created_at', 'confirmed_at', 'unsubscribed_at', 'source', 'referrer'];
  return [head.join(','), ...rows.map((r) => head.map((k) => cell(r[k])).join(','))].join('\r\n') + '\r\n';
}

/** Constant-time comparison for the owner's export token. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function confirmationMail(origin, token) {
  const confirm = `${origin}/api/waitlist/confirm?t=${encodeURIComponent(token)}`;
  const unsub = `${origin}/api/waitlist/unsubscribe?t=${encodeURIComponent(token)}`;
  const text = [
    'Confirm your place on the Alpha Pro waitlist.',
    '',
    `Confirm: ${confirm}`,
    '',
    'You will get one email when Pro opens, with launch pricing for founding members first. Nothing else.',
    'If you did not ask for this, ignore this mail and nothing is kept beyond a pending entry, or remove it now:',
    `Unsubscribe and delete: ${unsub}`,
    '',
    'Alpha · alpha.askakshay.com · information and education only, not investment advice.',
  ].join('\n');
  return { subject: 'Confirm your place on the Alpha Pro waitlist', text, unsub };
}

/** The one mail provider: Zoho ZeptoMail (HTTP). Returns true when the provider accepted the mail. */
export async function sendMail(env, to, mail, fetchFn = fetch) {
  const r = await fetchFn(env.MAIL_API || 'https://api.zeptomail.in/v1.1/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Zoho-enczapikey ${env.MAIL_TOKEN}` },
    body: JSON.stringify({
      from: { address: env.MAIL_FROM, name: 'Alpha' }, to: [{ email_address: { address: to } }],
      subject: mail.subject, textbody: mail.text,
      mime_headers: { 'List-Unsubscribe': `<${mail.unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  return !!r && r.ok;
}

export const waitlistOpen = (env) => !!(env.WAITLIST && env.MAIL_TOKEN && env.MAIL_FROM);

/** The list itself. One SQLite table; every write is a single statement, so a retried request cannot duplicate an address. */
export class Waitlist {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS entries (email TEXT PRIMARY KEY, status TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL, confirmed_at TEXT, unsubscribed_at TEXT, source TEXT, referrer TEXT)`);
  }
  async fetch(request) {
    const u = new URL(request.url);
    const now = new Date().toISOString();
    const one = (q, ...a) => [...this.sql.exec(q, ...a)][0] ?? null;
    if (u.pathname === '/join') {
      const { email, source, referrer } = await request.json();
      const was = one('SELECT status, token FROM entries WHERE email = ?', email);
      if (was && was.status === 'confirmed') return Response.json({ status: 'confirmed', token: was.token, send: false });
      if (was) {
        // pending or unsubscribed: a fresh request re-opens it as pending with a fresh token; the old link stops working
        const token = crypto.randomUUID();
        this.sql.exec('UPDATE entries SET status = ?, token = ?, unsubscribed_at = NULL WHERE email = ?', 'pending', token, email);
        return Response.json({ status: 'pending', token, send: true });
      }
      const token = crypto.randomUUID();
      this.sql.exec('INSERT INTO entries (email, status, token, created_at, source, referrer) VALUES (?, ?, ?, ?, ?, ?)', email, 'pending', token, now, source, referrer);
      return Response.json({ status: 'pending', token, send: true });
    }
    if (u.pathname === '/confirm' || u.pathname === '/unsubscribe') {
      const t = u.searchParams.get('t') || '';
      const row = one('SELECT email, status FROM entries WHERE token = ?', t);
      if (!row) return Response.json({ ok: false }, { status: 404 });
      if (u.pathname === '/confirm') { if (row.status === 'pending') this.sql.exec('UPDATE entries SET status = ?, confirmed_at = ? WHERE token = ?', 'confirmed', now, t); }
      else this.sql.exec('DELETE FROM entries WHERE token = ?', t);      // unsubscribing deletes the address, as the mail says
      return Response.json({ ok: true });
    }
    if (u.pathname === '/export') return Response.json([...this.sql.exec('SELECT email, status, created_at, confirmed_at, unsubscribed_at, source, referrer FROM entries ORDER BY created_at')]);
    if (u.pathname === '/count') return Response.json(one("SELECT COUNT(*) AS total, SUM(status = 'confirmed') AS confirmed, SUM(status = 'pending') AS pending FROM entries"));
    if (u.pathname === '/delete') { const e = u.searchParams.get('email') || ''; this.sql.exec('DELETE FROM entries WHERE email = ?', e); return Response.json({ ok: true }); }
    return new Response('not found', { status: 404 });
  }
}

/** /api/waitlist and its sub-paths. `json` and `limitKey` come from the main Worker so headers and rate keys stay one rule. */
export async function waitlist(request, env, url, { json, limitKey }) {
  const path = url.pathname.replace(/\/$/, '');
  const stub = env.WAITLIST ? env.WAITLIST.get(env.WAITLIST.idFromName('alpha-pro')) : null;
  if (path === '/api/waitlist' && request.method === 'GET') return json({ open: waitlistOpen(env) });
  if (path === '/api/waitlist' && request.method === 'POST') {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ ok: false, error: 'cross-site request' }, 403);
    if (!/application\/json/.test(request.headers.get('content-type') || '')) return json({ ok: false, error: 'json only' }, 415);
    if (!waitlistOpen(env)) return json({ ok: false, error: 'The waitlist is not open yet. Nothing was stored.' }, 503);
    if (env.WAITLIST_LIMIT && !(await env.WAITLIST_LIMIT.limit({ key: limitKey(request.headers.get('cf-connecting-ip')) })).success) return json({ ok: false, error: 'Too many requests. Try again in a minute.' }, 429);
    let body = null;
    try { const t = await request.text(); body = t.length <= 2048 ? JSON.parse(t) : null; } catch { body = null; }
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'not a waitlist request' }, 400);
    if (body.website) return json({ ok: true, message: 'Check your inbox for a confirmation link.' });      // honeypot: a bot filled the hidden field
    const email = normaliseEmail(body.email);
    if (!email) return json({ ok: false, error: 'That does not look like an email address.' }, 400);
    const r = await (await stub.fetch('https://waitlist/join', { method: 'POST', body: JSON.stringify({ email, source: normaliseSource(body.source), referrer: normaliseReferrer(body.referrer) }) })).json();
    if (r.send) {
      const sent = await sendMail(env, email, confirmationMail(url.origin, r.token));
      if (!sent) return json({ ok: false, error: 'The confirmation mail could not be sent. Try again later.' }, 502);
    }
    // the same answer whether or not the address was already on the list, so the form cannot be used to test addresses
    return json({ ok: true, message: 'Check your inbox for a confirmation link. Your place is held once you confirm.' });
  }
  if ((path === '/api/waitlist/confirm' || path === '/api/waitlist/unsubscribe') && stub) {
    const t = url.searchParams.get('t') || '';
    if (!/^[0-9a-f-]{36}$/.test(t)) return Response.redirect(`${url.origin}/pro/?waitlist=invalid`, 303);
    const which = path.endsWith('confirm') ? 'confirm' : 'unsubscribe';
    if (which === 'unsubscribe' && request.method !== 'GET' && request.method !== 'POST') return json({ ok: false }, 405);
    const r = await stub.fetch(`https://waitlist/${which}?t=${t}`);
    if (request.method === 'POST') return new Response(null, { status: r.ok ? 200 : 404 });      // RFC 8058 one-click
    return Response.redirect(`${url.origin}/pro/?waitlist=${r.ok ? (which === 'confirm' ? 'confirmed' : 'unsubscribed') : 'invalid'}`, 303);
  }
  if ((path === '/api/waitlist/export' || path === '/api/waitlist/delete' || path === '/api/waitlist/count') && stub) {
    const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.WAITLIST_ADMIN_TOKEN || !safeEqual(auth, env.WAITLIST_ADMIN_TOKEN)) return json({ ok: false, error: 'owner only' }, 401);
    if (path.endsWith('count')) return json(await (await stub.fetch('https://waitlist/count')).json());
    if (path.endsWith('delete')) {
      const e = normaliseEmail(url.searchParams.get('email'));
      if (!e || request.method !== 'POST') return json({ ok: false, error: 'POST with ?email=' }, 400);
      await stub.fetch(`https://waitlist/delete?email=${encodeURIComponent(e)}`);
      return json({ ok: true, deleted: e });
    }
    const rows = await (await stub.fetch('https://waitlist/export')).json();
    return new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="alpha-pro-waitlist.csv"', 'cache-control': 'no-store' } });
  }
  return json({ ok: false, error: 'not found' }, 404);
}
