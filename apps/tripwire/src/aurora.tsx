import { useEffect, useRef } from 'react';

/** The live water behind the market-mood card: a few slow waves drawn on a small canvas, tinted by how the Nifty is moving (greens and aqua
 *  when it rises, coral and violet when it falls) and choppier when the VIX is rising. Drawn at half resolution and 30 frames a second. It
 *  stops when the page is hidden or scrolled away, when motion is off or reduced, and it steps itself down if the device cannot keep up. */
export function Aurora({ ch, vix, still = false }: { ch: number | null; vix: number | null; /** true when the figures are not printing now (market shut, or no recent print): one still frame, so the water never moves for prices that are not */ still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null); const live = useRef({ ch, vix, still }); live.current = { ch, vix, still }; const kickRef = useRef<() => void>(() => {});
  useEffect(() => { kickRef.current(); }, [still]);      // prices start or stop printing: start or stop the water with them
  useEffect(() => {
    const cv = ref.current; const g = cv?.getContext('2d'); if (!cv || !g) return;
    const cs = getComputedStyle(document.documentElement);
    const motion = () => !live.current.still && document.documentElement.classList.contains('fx') && !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    let raf = 0, last = 0, seen = true, slow = 0, fps = 30; let hue = 80, amp = 0.08, chop = 0.3; let frames = 0;
    const size = () => { cv.width = Math.max(2, Math.round(cv.clientWidth * 0.5)); cv.height = Math.max(2, Math.round(cv.clientHeight * 0.5)); };
    size(); const ro = new ResizeObserver(() => { size(); paint(performance.now()); }); ro.observe(cv);
    const target = () => { const c = live.current.ch ?? 0; const v = live.current.vix ?? 0; return { hue: c > 0.15 ? 150 + Math.min(c, 2) * 12 : c < -0.15 ? 14 - Math.min(-c, 2) * 8 : 78, amp: 0.07 + Math.min(Math.abs(c) / 2, 1) * 0.11, chop: 0.25 + Math.min(Math.max(v, 0) / 8, 1) * 0.6 }; };
    function paint(t: number) {
      const w = cv!.width, h = cv!.height; g!.clearRect(0, 0, w, h);
      const T = target(); hue += (T.hue - hue) * 0.04; amp += (T.amp - amp) * 0.04; chop += (T.chop - chop) * 0.04;
      for (let L = 0; L < 4; L++) {
        const hh = (hue + L * 26 + 360) % 360; const base = h * (0.4 + L * 0.15);
        const grad = g!.createLinearGradient(0, base - h * 0.2, 0, h); grad.addColorStop(0, `hsla(${hh},95%,60%,${0.62 - L * 0.1})`); grad.addColorStop(1, `hsla(${hh},90%,38%,0.04)`);
        g!.beginPath(); g!.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) { const u = x / w; const y = base + Math.sin(u * (5 + L * 1.7) + t * (0.00045 + L * 0.00018) * (0.6 + chop) + L * 1.3) * h * amp + Math.sin(u * (11 + L * 3) - t * 0.0007 * chop + L) * h * amp * 0.35 * chop; g!.lineTo(x, y); }
        g!.lineTo(w, h); g!.closePath(); g!.fillStyle = grad; g!.fill();
      }
    }
    const loop = (t: number) => {
      raf = 0; if (!seen || document.hidden || !motion()) { cv.dataset.running = 'false'; return; }
      cv.dataset.running = 'true';
      if (t - last >= 1000 / fps) {
        const dt = t - last; last = t; const a = performance.now(); paint(t); const cost = performance.now() - a; frames++;
        // keep up or step down: a slow device drops to 15 frames a second, then to one still frame
        if (cost > 14 || dt > 70) slow++; else slow = Math.max(0, slow - 1);
        if (slow > 40 && fps === 30) { fps = 15; slow = 0; } else if (slow > 40 && fps === 15) { cv.dataset.running = 'false'; return; }
      }
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) { if (seen && !document.hidden && motion()) raf = requestAnimationFrame(loop); else { cv.dataset.running = 'false'; paint(performance.now()); } } };
    const io = new IntersectionObserver((e) => { seen = e[0]?.isIntersecting ?? true; kick(); }); io.observe(cv);
    const vis = () => kick(); document.addEventListener('visibilitychange', vis);
    const mq = matchMedia('(prefers-reduced-motion: reduce)'); mq.addEventListener?.('change', vis);
    const cls = new MutationObserver(vis); cls.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    kickRef.current = kick; kick(); void cs;
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); cls.disconnect(); document.removeEventListener('visibilitychange', vis); mq.removeEventListener?.('change', vis); };
  }, []);
  return <canvas ref={ref} className="aurora" aria-hidden="true" data-running="false" />;
}
