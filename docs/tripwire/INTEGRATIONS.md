# Integrations: what is working, what is not set up, what is not built

Tripwire runs without an account. Three states and no others. **Working**: configured and used now. **Not set up**: the capability could exist but no key or provider is configured, so no control for it exists. **Not built**: there is no code for it. Nothing is "coming soon" and no control exists that looks like it works and does not. The Profile screen shows this same list, and `/api/health` probes the two live sources and lists the Worker's binding names (never a value; there are no secrets).

`apps/tripwire/src/services.ts` is the source; `services.test.ts` fails if this table and that list disagree.

| Capability | State | What it is, and what it would need |
|---|---|---|
| Live prices | Working | Yahoo Finance via the Worker. Unofficial: it can throttle or change; the app says so when it does not answer. |
| News headlines | Working | Google News and Bing News RSS via the Worker, filtered to what bears on a decision. |
| Published screen and the forward ledger | Working | Screen fetched at build time; ledger written by one nightly workflow, append-only. |
| Backup and restore | Working | Export, import, merge, journal CSV. Tested end to end. The only data-safety route until accounts exist. |
| Screen lock | Working | The phone's own unlock. It locks the screen; it does not encrypt storage. |
| Accounts and sign-in | Not set up | Needs a provider with client id, secret and callback URL as Worker secrets, and a privacy notice update. |
| Sync between devices | Not built | Needs accounts, then a per-user store and a conflict rule. |
| Notifications and alerts | Not built | Needs Web Push keys as Worker secrets, a subscription store tied to an account, a push handler; on iPhone the app on the Home Screen. |
| E-mail | Not set up | Needs a sender domain and a mail API key. The Pro waitlist is a different service. |
| Broker connection and orders | Not built | None, by design. Every position is paper. |
