// One mock for the live feed. The app asks /api/tick for everything on screen; tests set `h.stock` to decide which stock quotes exist.
export async function mockTick(ctx, { pulse, macro, stock = null, breadth = null }) {
  const h = { pulse, macro, stock, breadth };
  await ctx.route('**/api/tick*', (route) => {
    const u = new URL(route.request().url()); const syms = (u.searchParams.get('s') || '').split(',').filter(Boolean); const quotes = {}; const missing = [];
    for (const s of syms) { const q = h.stock ? h.stock(s) : null; if (q) quotes[s] = q; else missing.push(s); }
    const body = { ok: true, fetched_at: 'x', quotes, missing }; if (u.searchParams.get('i') === '1') body.pulse = h.pulse; if (u.searchParams.get('m') === '1') body.macro = h.macro;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route('**/api/breadth*', (route) => (h.breadth ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(h.breadth) }) : route.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' })));
  return h;
}
