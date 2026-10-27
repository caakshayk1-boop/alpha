// A deterministic synthetic price panel in the Lab's own file format, served to the browser by route mocks. Test data only: it makes no claim about any real company.
import { gzipSync } from 'node:zlib';
export function labFiles(N = 80, T = 2400) {
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const dates = []; let d = Date.UTC(2016, 9, 3); while (dates.length < T) { const wd = new Date(d).getUTCDay(); if (wd !== 0 && wd !== 6) dates.push(new Date(d).toISOString().slice(0, 10)); d += 86400000; }
  const syms = Array.from({ length: N }, (_, j) => `LAB${String(j).padStart(2, '0')}`); const first = syms.map((_, j) => (j % 9 === 0 ? 300 : 0)); const parts = [];
  for (let j = 0; j < N; j++) { let px = 100 + j, drift = 0; const q = []; for (let i = first[j]; i < T; i++) { if (i % 120 === 0) drift = rnd() * 0.006; px *= 1 + drift + rnd() * 0.03; q.push(Math.max(1, Math.round(px * 100))); }
    const buf = Buffer.alloc(q.length * 4); let prev = 0; q.forEach((v, k) => { buf.writeInt32LE(v - prev, k * 4); prev = v; }); parts.push(buf); }
  return { meta: { built: 'test panel', dates, syms, first, scale: 100 }, bin: gzipSync(Buffer.concat(parts)) };
}
export async function mockLab(ctx) {
  const f = labFiles();
  await ctx.route('**/data/research/lab_panel.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(f.meta) }));
  await ctx.route('**/data/research/lab_panel.bin.gz', (r) => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: f.bin }));
  return f;
}
