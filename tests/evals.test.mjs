// Ask Alpha eval suite (Pro §27.4): the golden set in evals/ask-alpha/cases.json run through the claim validator.
// Blocking: an unsupported claim that reaches the page, or a claim citing a fact that does not exist, fails the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFact, validateClaims } from '../worker/explain.js';
import { validateEntities, validateFiling, validateThesis } from '../worker/askalpha.js';

const VALIDATORS = { entities: validateEntities, thesis: validateThesis, filing: validateFiling };

const golden = JSON.parse(readFileSync(new URL('../evals/ask-alpha/cases.json', import.meta.url), 'utf8'));

test(`ask-alpha golden set: ${golden.cases.length} cases`, () => {
  const fails = [];
  let rendered = 0, cited = 0, citedValid = 0;
  for (const k of golden.cases) {
    const facts = golden.sets[k.facts];
    const r = (VALIDATORS[k.validator] ?? validateClaims)(k.model, facts);
    const ids = new Set(facts.map((f) => f.id));
    rendered += r.claims.length;
    for (const c of r.claims) { cited += c.facts.length; citedValid += c.facts.filter((id) => ids.has(id)).length; }
    const problems = [];
    if (r.claims.length !== k.expect.shown) problems.push(`shown ${r.claims.length}, expected ${k.expect.shown}`);
    if (r.withheld.length !== k.expect.withheld) problems.push(`withheld ${r.withheld.length}, expected ${k.expect.withheld}`);
    if (k.expect.texts) for (const t of k.expect.texts) if (!r.claims.some((c) => c.text === t)) problems.push(`missing text "${t}"`);
    if (k.expect.unknowns) assert.deepEqual(r.unknowns, k.expect.unknowns, k.id);
    // no digit may reach the page except one rendered from a fact
    for (const c of r.claims) {
      let t = c.text;
      for (const id of c.facts) { const f = facts.find((x) => x.id === id); if (f) { t = t.split(renderFact(f)).join(''); t = t.split(renderFact({ ...f, value: String(f.value).replace(/^-/, '') })).join(''); } }
      if (/\d/.test(t.replace(/FY\d+|52-week|(14|20|50|200)-day|\bT[12]\b/g, ''))) problems.push(`unsupported digit in "${c.text}"`);
    }
    if (problems.length) fails.push(`${k.id}: ${problems.join('; ')}`);
  }
  assert.equal(citedValid, cited, 'citation validity must be 100%');
  assert.deepEqual(fails, [], `${fails.length} of ${golden.cases.length} cases failed (${rendered} claims rendered)`);
});
