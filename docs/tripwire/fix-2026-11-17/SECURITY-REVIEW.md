# Pre-account security review — 17 November 2026

Scope: Tripwire static React application, public read-only Worker, local personal paper state, CSV/backup exports. This is an implementation review and automated-check record, not an independent penetration test or certification.

## Checked
- CSP limits scripts, fonts, connections, forms and workers to self. No added third-party scripts, auth, payments or external email endpoints. Frame embedding is denied, object sources disabled; nosniff, HSTS and restrictive Permissions-Policy retained.
- Worker public data routes reject non-GET methods. Symbols are normalised and bounded; upstream URLs are fixed rather than user-selected hosts. Existing request-class rate limits remain. These defences are covered by existing Worker/unit tests.
- React text escaping is retained on ledger reasons, diary content and source statistics. Crawlable summaries escape HTML. CSV escapes quotes and prefixes formula-like text; negative numeric data remains numeric. Tests cover formula and quote cases.
- Personal backups validate shape before import, reject conflicting book identities/results and preserve the automatic ledger. Conditions and visit baselines are additive fields; old backups remain valid. No secret enters the frontend.
- User research remains local and browser-readable: device access or script compromise can read it. Browser storage is not encrypted authoritative account storage. File backups contain personal research and should be handled accordingly.

## Findings and launch gate
`npm audit --omit=dev` reports **one high and one critical package finding** in the shared repository: Next.js and its PostCSS chain. Tripwire deploys an esbuild static bundle plus a plain Cloudflare Worker, not Next.js, and neither package is in that runtime. They remain repository findings; other applications require a separate dependency upgrade review. No broad dependency upgrade was applied to unrelated products.

Before accounts/payments: remediate reachable dependency findings, perform an independent deployment-specific review, add authenticated server access control, transactional quota enforcement, deletion/export and retention controls, CSRF/session protections and billing-webhook verification. No accounts or payments were added. This report does **not** clear the paid-account launch gate.
