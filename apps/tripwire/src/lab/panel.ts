/** The Lab's price panel: adjusted daily closes, symbol-major, decoded from lab_panel.json + lab_panel.bin.gz (format in research/lab_panel.py).
 *  A name is NaN before it listed, never zero. */
export interface PanelMeta { built: string; dates: string[]; syms: string[]; first: number[]; scale: number }
export interface LabPanel { built: string; dates: string[]; syms: string[]; T: number; N: number; first: number[]; /** N rows of T closes, row j starts at j*T */ C: Float64Array }

export function decodePanel(meta: PanelMeta, raw: Uint8Array): LabPanel {
  const T = meta.dates.length, N = meta.syms.length; const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const C = new Float64Array(N * T).fill(NaN); let at = 0;
  for (let j = 0; j < N; j++) {
    const f = meta.first[j]; if (f >= T) continue; let acc = 0;
    for (let i = f; i < T; i++, at += 4) { acc += dv.getInt32(at, true); C[j * T + i] = acc / meta.scale; }
  }
  if (at !== raw.byteLength) throw new Error(`the price panel is the wrong size: read ${at} bytes of ${raw.byteLength}`);
  return { built: meta.built, dates: meta.dates, syms: meta.syms, T, N, first: meta.first, C };
}

export async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function loadPanel(signal?: AbortSignal): Promise<LabPanel> {
  const [m, b] = await Promise.all([fetch('/data/research/lab_panel.json', { signal }), fetch('/data/research/lab_panel.bin.gz', { signal })]);
  if (!m.ok || !b.ok) throw new Error('the price history has not been built yet');
  return decodePanel((await m.json()) as PanelMeta, await gunzip(await b.arrayBuffer()));
}
