# AI features

**Status: no AI feature is switched on.** There is no Anthropic key, and the owner does not want to spend on one. Nothing in the product shows mock AI. Where AI would appear, the control is hidden (not disabled and not faked), and everything else works without it.

## What exists today (Observed in code)

| Feature | Where | AI? | State |
|---|---|---|---|
| Ask about this company | `AskCompany` in `src/components/Explain.tsx`, `POST /api/explain` in `worker/index.js` | Yes (`claude-haiku-5-5`, `max_tokens` 400) | **Off**: returns 503 until `ANTHROPIC_API_KEY` exists; the page asks `GET /api/explain` and renders nothing when `configured` is false |
| Plain-English screen search | `AskScreen`, `src/lib/nl.ts` | **No**: fixed language rules turn clauses into filter chips; every ignored word is listed | Real, always on |
| Command palette (⌘K, `/`) | `Shell.tsx` | No: prefix/substring match over pages and the company list | Real |
| News desk (themes, named stocks) | `src/lib/newsdesk.ts` | **No**: regular expressions over the story text, the basis shown on each match | Real. Deliberately not labelled "AI" |
| Metric definitions ("What this means") | `MetricPanel`, `src/lib/glossary.ts` | No: fixed text | Real |

## The one AI feature, specified

**User problem:** "What does this company's ROCE or debt actually say?" for someone who does not read ratios.
**Required data:** the company's own screen row (built by the Worker, never sent by the browser).
**Interaction:** four preset questions or one free question (3–300 characters), then "Ask".
**Output:** a short answer that cites figure ids, the list of figures the model was given, a "Check these figures" notice for any number the checker cannot match, a data date, and the label "AI-written, not reviewed by a person. Information only, not investment advice."
**Failure behaviour:** not configured → control hidden; over limit → 429 "too many requests, try again in a minute" or "reached its limit for today"; upstream failure → 502 "could not answer right now"; unmatched figures → shown to the reader, not hidden.
**Success measure (to set once enabled):** share of answers with zero unverified numbers; questions asked per company page view; cost per 100 answers against the workspace limit. There is no baseline because it has never run.

## Safeguards already in the code (Observed, not load-tested)
- Server-side only; the key is a Worker secret. A grep of the built client bundle (`out/_next`) for `ANTHROPIC` and `sk-ant` found nothing (Measured, this pass).
- Input validated (`validateQuestion`), request body capped at 2,048 bytes even when chunked.
- The model receives only facts the Worker builds from that company's row; answers are checked against those facts (`checkAnswer`).
- Rate limits, strongest first: the spend limit on the Anthropic workspace (the only real cap, set outside this code); the `EXPLAIN_LIMIT` rate-limit binding (5 requests / 60 s per IPv4 or IPv6 /64); an in-memory limiter of 6 per minute per isolate (a speed bump, not a global cap); a soft ceiling of 800 calls per day per isolate.
- Same-origin and JSON-only checks so another site cannot drive visitors' browsers at it.
- Output rendered as text, not HTML.

## Not built, and why
The brief asks for 2–3 AI features. Without a key and without budget approval, building more model calls would mean either shipping something untestable or faking it, so none were added. If a key is added later, in this order of value:
1. **Explain this** on Engines and Screen results (grounded in the same row/engine facts, labelled "AI interpretation").
2. **A grounded assistant** limited to the site's own feeds with sources shown.
Both need: a spend cap on the Anthropic workspace first, then `wrangler secret put ANTHROPIC_API_KEY`, then a test against real answers before announcing.

## Setup when ready (owner steps)
1. Create an Anthropic workspace with a monthly spend limit.
2. `npx wrangler secret put ANTHROPIC_API_KEY` in this repo.
3. Confirm `GET /api/explain` returns `{"configured": true}`; ask three questions; read the "Check these figures" notices.
4. Only then link to it from marketing copy.
