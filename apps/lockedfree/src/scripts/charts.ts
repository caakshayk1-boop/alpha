// Draws equity cards (lightweight-charts) and sparklines (uPlot). Reads JSON from the page; never computes a figure.
type LW = typeof import('lightweight-charts');
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
async function init() {
  const { createChart, LineSeries, BaselineSeries, ColorType } = await import('lightweight-charts') as LW; type Time = import('lightweight-charts').Time;
for (const card of document.querySelectorAll<HTMLElement>('[data-equity]')) {
  const el = card.querySelector<HTMLElement>('[data-chart="equity"]'), raw = card.querySelector('script[data-series]')?.textContent; if (!el || !raw) continue;
  const pts = JSON.parse(raw) as { date: string; ret: number | null; bench: number | null; dd: number }[];
  const chart = createChart(el, { autoSize: true, layout: { attributionLogo: false, background: { type: ColorType.Solid, color: css('--card') }, textColor: css('--ink-muted'), fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: css('--hairline') } }, rightPriceScale: { borderColor: css('--hairline') }, timeScale: { borderColor: css('--hairline'), timeVisible: false }, handleScroll: false, handleScale: false, crosshair: { horzLine: { visible: true } } });
  const dd = chart.addSeries(BaselineSeries, { baseValue: { type: 'price', price: 0 }, topLineColor: 'transparent', topFillColor1: 'transparent', topFillColor2: 'transparent', bottomLineColor: css('--down'), bottomFillColor1: css('--down') + '66', bottomFillColor2: css('--down') + '22', priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'custom', formatter: (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' pts' } }, 1);
  dd.setData(pts.map((p) => ({ time: p.date as Time, value: p.dd })));
  const bench = chart.addSeries(LineSeries, { color: css('--ink-muted'), lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
  bench.setData(pts.filter((p) => p.bench != null).map((p) => ({ time: p.date as Time, value: p.bench as number })));
  const ret = chart.addSeries(LineSeries, { color: css('--ink'), lineWidth: 2, pointMarkersVisible: true, pointMarkersRadius: 4, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'custom', formatter: (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%' } });
  ret.setData(pts.filter((p) => p.ret != null).map((p) => ({ time: p.date as Time, value: p.ret as number })));
  chart.panes()[1]?.setStretchFactor(0.3);
  chart.timeScale().fitContent();
  // draw-in once per session, first view only; skipped under reduced motion
  let seen = false; try { seen = sessionStorage.getItem('rb-curve') === '1'; sessionStorage.setItem('rb-curve', '1'); } catch { /* storage unavailable: just draw */ }
  if (!reduce && !seen) { el.classList.add('draw-in'); setTimeout(() => el.classList.remove('draw-in'), 600); }
}
// Price chart on stock pages: one line, no indicators, no trade markers.
for (const el of document.querySelectorAll<HTMLElement>('[data-chart="price"]')) {
  const raw = el.parentElement?.parentElement?.querySelector('script[data-series]')?.textContent; if (!raw) continue; const pts = JSON.parse(raw) as { date: string; c: number }[];
  const chart = createChart(el, { autoSize: true, layout: { attributionLogo: false, background: { type: ColorType.Solid, color: css('--card') }, textColor: css('--ink-muted'), fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 11 }, grid: { vertLines: { visible: false }, horzLines: { color: css('--hairline') } }, rightPriceScale: { borderColor: css('--hairline') }, timeScale: { borderColor: css('--hairline') }, handleScroll: false, handleScale: false });
  chart.addSeries(LineSeries, { color: css('--ink'), lineWidth: 2, priceLineVisible: false }).setData(pts.map((p) => ({ time: p.date as Time, value: p.c }))); chart.timeScale().fitContent();
}
}
// the 160 KB charting library is fetched only when a chart scrolls near the viewport; a page without chart data never loads it
const hosts = [...document.querySelectorAll<HTMLElement>('[data-chart]')]; if (hosts.length) { const io = new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); init(); } }, { rootMargin: '300px' }); hosts.forEach((h) => io.observe(h)); }
