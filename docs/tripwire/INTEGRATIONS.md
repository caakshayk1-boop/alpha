# Integrations: what is real, what is not, and what each needs

Tripwire runs without an account. Nothing in the app pretends otherwise: Profile says "Sign-in is not available yet" and "Notifications: not available yet", and no control exists that looks like it works and does not.

| Capability | State | What it needs to be real |
|---|---|---|
| Accounts and sign-in | Not built. No identity provider is configured. | A provider (for example Cloudflare Access, Clerk or Auth0) with its client id, secret and callback URLs set as Worker secrets; a decision on which sign-in methods; a privacy notice update. |
| Sync between devices | Not built. State lives in this browser's storage. | Accounts first, then a store (Cloudflare D1 or KV) with per-user rows, conflict rules (the app already merges by id, longer history wins) and an export-before-first-sync step. |
| Notifications | Not built. Review dates appear on Today when the app is opened; nothing is sent. | Web Push needs VAPID keys (public and private) as Worker secrets, a push-subscription store tied to an account, a service-worker push handler, and on iPhone the app must be added to the Home Screen first. Email alerts need a sender domain and a mail API key. |
| Waitlist e-mail | Owner-dependent. | Mail API secrets (see OPEN_ITEMS). |
| Backup and restore | Real. Export, import, merge and journal CSV, tested end to end (`backup.test.ts`, `beta.mjs`). | Nothing. This is the only data-safety route until accounts exist. |
| Screen lock | Real, and honest: it locks the screen with the phone's own unlock; it does not encrypt storage. | Nothing. |

When a credential is supplied, build the feature behind a capability check (configured or not), so a missing secret shows the same honest "not available" line instead of a broken button.
