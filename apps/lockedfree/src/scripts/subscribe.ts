// Enhances the email form. Without JS the form posts normally and the Worker redirects back.
const f = document.querySelector<HTMLFormElement>('[data-subscribe]'); const msg = document.querySelector<HTMLElement>('[data-subscribe-msg]');
f?.addEventListener('submit', async (e) => { e.preventDefault(); if (msg) msg.textContent = 'Sending…';
  try { const r = await fetch('/api/subscribe', { method: 'POST', headers: { accept: 'application/json' }, body: new FormData(f) }); const j = await r.json().catch(() => ({}));
    if (msg) msg.textContent = r.ok ? 'You are on the list. Thank you.' : (j.error || 'That did not go through. Try again.'); if (r.ok) f.reset(); }
  catch { if (msg) msg.textContent = 'No connection. Nothing was saved. Try again.'; } });
