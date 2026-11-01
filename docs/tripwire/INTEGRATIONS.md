# Integrations: what is working, what is not set up, what is not built

Tripwire runs without an account. Three kinds and no others. **Checked at runtime**: there is code and a real check behind it (a probe, a last-success time, a data date or a device test); the status page prints the evidence, or says "Not verified" when it has none, and never "Working" merely because something is configured. **Not set up**: the capability could exist but no key or provider is configured, so no control for it exists. **Not built**: there is no code for it. Nothing is "coming soon" and no control exists that looks like it works and does not. The Operations page (#/ops) shows this same list with its live evidence; the consumer Settings screen does not carry it, and `/api/health` probes the two live sources and lists the Worker's binding names (never a value; there are no secrets).

`apps/tripwire/src/services.ts` is the source; `services.test.ts` fails if this table and that list disagree.

| Capability | Kind | Evidence the status page uses, and what it would need |
|---|---|---|
| Live prices | Checked at runtime | Yahoo Finance via the Worker (unofficial; it can throttle or change). Status: the Worker asks Yahoo for the Nifty and reads the time of the last print. |
| News headlines | Checked at runtime | Google News and Bing News search feeds plus RBI and SEBI release feeds, read by a scheduled GitHub Actions job. Status: the time of the last SUCCESSFUL scheduled check, from the published status file; the Worker may refresh market stories on demand when it is late, labelled as such. |
| Published screen | Checked at runtime | Built nightly in the research repository, fetched at build time. Status: the data date inside the screen against the exchange calendar. |
| Forward ledger | Checked at runtime | Written by one workflow, append-only. Status: the time the ledger file says it was last written. |
| Saving on this device | Checked at runtime | Notes, plans and paper trades are kept in this browser; export and import as a file. Status: a test value is written to and read back from storage. |
| Screen lock | Checked at runtime | The phone's own unlock; it locks the screen and does not encrypt storage. Status: whether this device offers a platform authenticator. |
| Scheduler nudge | Not set up | Cloudflare cron to GitHub, to start the news job on time (GitHub's scheduler starts hours late). Built and inert: needs a fine-grained token limited to this repository with Actions read and write, set as the Worker secret GITHUB_DISPATCH_TOKEN. |
| Accounts and sign-in | Not set up | Needs a provider with client id, secret and callback URL as Worker secrets, and a privacy notice update. |
| Sync between devices | Not built | Needs accounts, then a per-user store and a conflict rule. |
| Notifications and alerts | Not built | Needs Web Push keys as Worker secrets, a subscription store tied to an account, a push handler; on iPhone the app on the Home Screen. |
| E-mail | Not set up | Needs a sender domain and a mail API key. The Pro waitlist is a different service. |
| Broker connection and orders | Not built | None, by design. Every position is paper. |
