// Critical CSS: the rules the first viewport needs, taken out of the finished stylesheet IN ITS OWN ORDER (so the cascade is the one the full file has: later layers still override
// earlier ones), keeping a rule when every class it names is a class the first viewport actually renders (static/critical-classes.json, captured from the real Today view at phone and
// desktop widths by tools/critical-classes.mjs). Pure string work on esbuild's minified output; no dependency. The full stylesheet still loads (without blocking) and is a superset,
// so a class missing from the list costs a brief unstyled flash below the fold, never a wrong style.
const skipStr = (s, i) => { const q = s[i]; for (i++; i < s.length && s[i] !== q; i++) if (s[i] === '\\') i++; return i; };
/** Split CSS text into top-level pieces: [{ head, body }] where body is the text inside the braces (null for a statement such as @import). */
export function pieces(css) {
  const out = []; let i = 0;
  while (i < css.length) {
    let head = ''; let start = i; let depth = 0;
    for (; i < css.length; i++) {
      const c = css[i];
      if (c === '"' || c === "'") { i = skipStr(css, i); continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      else if (depth === 0 && (c === '{' || c === ';')) break;
    }
    head = css.slice(start, i).trim();
    if (i >= css.length) { if (head) out.push({ head, body: null }); break; }
    if (css[i] === ';') { out.push({ head, body: null }); i++; continue; }
    let d = 1; const b0 = ++i;
    for (; i < css.length && d > 0; i++) { const c = css[i]; if (c === '"' || c === "'") { i = skipStr(css, i); continue; } if (c === '{') d++; else if (c === '}') d--; }
    out.push({ head, body: css.slice(b0, i - 1) });
  }
  return out;
}
const splitSelectors = (h) => { const r = []; let d = 0, s = 0; for (let i = 0; i < h.length; i++) { const c = h[i]; if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; else if (c === ',' && d === 0) { r.push(h.slice(s, i)); s = i + 1; } } r.push(h.slice(s)); return r; };
export function criticalCss(css, classes) {
  const set = new Set(classes); const keptAnimations = new Set(); const keyframes = [];
  const qualifies = (sel) => { for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!set.has(m[1])) return false; return !/#[\w-]+/.test(sel.replace(/\[[^\]]*\]/g, '')) || /#root\b/.test(sel); };
  const walk = (list) => {
    let out = '';
    for (const p of list) {
      if (p.body === null) continue;
      if (/^@keyframes/.test(p.head)) { keyframes.push(p); continue; }
      if (/^@font-face|^@property/.test(p.head)) { out += `${p.head}{${p.body}}`; continue; }
      if (/^@(media|supports|layer)/.test(p.head)) { const inner = walk(pieces(p.body)); if (inner) out += `${p.head}{${inner}}`; continue; }
      if (p.head.startsWith('@')) continue;
      if (splitSelectors(p.head).some(qualifies)) { out += `${p.head}{${p.body}}`; for (const m of p.body.matchAll(/animation(?:-name)?:([^;}]*)/g)) for (const t of m[1].split(/[\s,]+/)) keptAnimations.add(t); }
    }
    return out;
  };
  let body = walk(pieces(css));
  for (const k of keyframes) { const name = k.head.replace(/^@keyframes\s+/, '').trim(); if (keptAnimations.has(name)) body += `${k.head}{${k.body}}`; }
  return body;
}
