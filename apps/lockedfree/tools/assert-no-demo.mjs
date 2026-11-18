// A production build must contain no demo marker. Usage: node tools/assert-no-demo.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs'; import { join } from 'node:path'; const dist = process.argv[2] || 'dist'; let hit = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(html|css|js|json|xml)$/.test(f) && /DEMO DATA|DEMOA\b|synthetic, for layout/.test(readFileSync(p, 'utf8'))) { console.log('demo marker in', p); hit++; } } };
walk(dist); if (hit) process.exit(1); console.log(`no demo markers in ${dist}`);
