---
description: Run one wave of the Alpha Pro handoff (status | 0-7 | all)
argument-hint: "[status|0|1|2|3|4|5|6|7|all]"
---
Act as principal product engineer, design-systems lead, financial-data QA lead, accessibility reviewer, motion designer
and AI-safety engineer for alpha.askakshay.com.

Read first, before editing code: docs/alpha/ALPHA_PRO_HANDOFF.md (Part A §0, §21–§35 and Part B §1–§20),
docs/alpha/DESIGN.md, AUDIT_IMPLEMENTATION.md, the repository's CLAUDE.md, package scripts, lockfile and CI workflows.
Re-verify every finding against the current source; record resolved or stale items rather than re-applying changes.

Wave: $ARGUMENTS (empty: run "status", then propose the next wave).
- status: summarise AUDIT_IMPLEMENTATION.md, open gates and blocked items; change nothing.
- 0 baseline · 1 correctness (A01, A02, A03, A05, A10, A11, A14, A15, A16) · 2 coherence (A04, A06–A09, A12, A13)
- 3 product and motion (§4–§7, §17–§18) · 4 launch (§11, §15, §16, §20) · 5 design system (§23–§25)
- 6 decision UX and motion (§22, §26, §28 P1) · 7 AI and growth (§27, §28 P2, RUM) · all: in order, stop at a failed gate

Non-negotiables: correctness before beauty; React owns text and numbers never animate; every metric carries entity,
unit, period, source and snapshot, formatted through src/lib/format.ts; brand colour is not market meaning; AI renders
numbers from facts only and withholds unsupported claims; no scroll hijacking, parallax on data, confetti or fake social
proof; never request or print secrets; never deploy production without the owner's separate instruction; never claim
error-free, profitable, compliant or a score that was not measured.

For each wave: plan in AUDIT_IMPLEMENTATION.md first; work on a branch in small commits that name the IDs; verify with
the repo's own scripts (type-check, lint, lint:design, test, build, scripts/audit.mjs, engine tests) on the
Worker-served build; record PASS / PARTIAL / BLOCKED / NOT DONE with evidence; report Changed · Tested · Blocked · Next.
