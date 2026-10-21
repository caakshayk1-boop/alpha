# Launch scope: signup, sync, accounts (Pro §20): BLOCKED

Nothing in this section is built, and no button on the site pretends it is. Every personal feature works today without an
account and says it is "saved in this browser only".

## Why it is blocked

A real account system needs three services the owner must choose, create and pay for (or approve on a free tier), and
whose credentials only the owner can create:

1. an identity provider for email magic links (and optionally Google sign-in);
2. a durable database for watchlists, saved screens, research cards and journals, with per-user isolation;
3. an email sender with a verified domain (SPF/DKIM) for the magic links.

## Recommended stack (fits the current deployment)

The site is a static export plus one Cloudflare Worker, so the account layer belongs in the Worker:

| Need | Recommendation | Why |
|---|---|---|
| Database | Cloudflare D1 (SQLite), bound to the same Worker | Same platform, free tier covers this scale, no new vendor |
| Sessions | Signed, HttpOnly, Secure, SameSite=Lax cookies issued by the Worker; CSRF token on writes | No third-party script on the page; works with the static export |
| Magic links | Worker-generated single-use tokens (hashed in D1, 15-minute expiry) | Keeps auth logic small and auditable |
| Email | A transactional sender with a free tier (for example Resend or Postmark) | Needs an API key and a verified domain |
| Google sign-in | Optional, later | Only when configured; never a dead button |

## Smallest action to unblock

1. Choose the email sender and verify `askakshay.com` with it; put its API key in the Worker as a secret.
2. Create a D1 database (`npx wrangler d1 create alpha-accounts`) and give the binding name.
3. Confirm the privacy wording for accounts (what is stored, how to delete it).

With those, the build is: `/signup/`, `/login/`, `/auth/callback/`, `/onboarding/`, `/account/` (export, delete with
re-auth), server-side ownership checks on every read and write, a preview-before-import of browser-local data, rate
limits on auth, and an end-to-end test (signup → callback → save → sign out → sign in → data present; user A cannot read
user B).
