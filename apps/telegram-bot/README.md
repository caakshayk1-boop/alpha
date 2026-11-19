# Telegram bot (owner only)

One free Cloudflare Worker (`askakshay-telegram`). It answers only your chat, reads the feeds the four sites already publish, keeps your notes, the stories already sent and the last brief's snapshot in a Durable Object, and sends **three briefs a weekday in Malaysia time**. It places no orders.

## The three briefs (Mon-Fri, Malaysia time)

| Brief | Time | India | Job |
|---|---|---|---|
| Morning plan | 08:00 | 05:30, closed | What changed overnight, last close, gate, why hub alerts are on or off |
| Open check | 12:00 | 09:30, 15 min after the open | Nifty, Bank Nifty, VIX against yesterday's close, signals since the morning |
| Close scorecard | 18:30 | 16:00, 30 min after the 15:30 close | Close, Tripwire paper picks, Rulebook paper book, Alpha record |

Each brief starts with a one-line verdict (for example `Gate OFF · no signals · Nifty +0.50% · VIX 16.1`), then **what changed since the previous brief** per site. Sites with no change collapse into `No change: Rulebook, ApexPro`. Then up to 5 new stories, then link buttons to the four sites.

| Site | Read from | Shown |
|---|---|---|
| Alpha (hub) | `alpha.askakshay.com/signals.json` | gate, open signals, record, whether hub alerts are on |
| Tripwire | `tripwire.askakshay.com/api/pulse`, `/api/ledger`, `/api/news` | index quotes, ledger day, open paper picks and their average move |
| Rulebook (lockedfree) | `ledger.json` on `main` in GitHub | paper book: open, closed, equity |
| ApexPro | hub `data/pulse.json` (ApexPro has no feed of its own) | sector heat leader and laggard, breadth |

- **Holidays and quiet days:** the Tripwire feed carries the time of its last tick. If that is not today (India), the brief says there is no trading data yet. A quiet day with nothing changed is one line.
- **News:** from Tripwire's `/api/news`, at most 5 per brief, never a story twice (14-day memory). A story about a company in your Alpha signals or Tripwire's open picks is ranked up and marked ★. At most 2 stories per company. Links longer than 300 characters are dropped (the headline stays) so a message never breaks Telegram's limit.
- **A dead source** is named in the brief (`Source unavailable: Tripwire`) and the rest still sends.
- **Retry:** each slot is open for 60 minutes. If Telegram rejects the first send the slot is released and the next half-hour tick tries once more. A slot can never send twice.
- **Paper only.** Tripwire and Rulebook are paper books. Every figure carries its "as of" date; missing values are `n/a`, never zero.

## Commands

| Command | Reads |
|---|---|
| `/morning`, `/open`, `/close` | the same briefs on demand (does not move the "since last brief" comparison point) |
| `/news` | top 10 stories you have not been sent yet |
| `/pulse` | Tripwire `api/pulse` |
| `/signals` | Alpha `signals.json` |
| `/tripwire` | Tripwire `api/ledger` |
| `/rulebook` | lockedfree `ledger.json` from `main` on GitHub |
| `/stock SYMBOL` | Alpha `c/SYMBOL.json` |
| `/digest` | pulse + signals + tripwire + rulebook |
| `/note TEXT`, `/notes`, `/del N` | your notes |

Times come from `NEWS_TZ` in `wrangler.telegram.jsonc` (`Asia/Kuala_Lumpur`). The slots themselves (08:00, 12:00, 18:30) are in `briefs.js`.

## Step by step

**1. Make the bot** (Telegram app)
1. Search for **@BotFather**, send `/newbot`, choose a name and a username ending in `bot`.
2. Copy the token it gives you. Treat it like a password.

**2. Get your chat ID**
1. Open your new bot and send it any message.
2. In a browser open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the number at `message` → `chat` → `id`.

**3. Make a webhook secret**
```bash
openssl rand -hex 24
```
Keep the output; it is your `WEBHOOK_SECRET`.

**4. Log in to Cloudflare** (once; skip if `wrangler` is already logged in)
```bash
npx wrangler login
```

**5. Deploy** (run from the repo root, on the branch that has this bot)
```bash
npx wrangler deploy --config wrangler.telegram.jsonc
```
It prints an address like `https://askakshay-telegram.<your-subdomain>.workers.dev`. Copy it.

**6. Set the three secrets** (wrangler asks you to paste each value; nothing goes into a file)
```bash
npx wrangler secret put BOT_TOKEN --config wrangler.telegram.jsonc
```
```bash
npx wrangler secret put OWNER_CHAT_ID --config wrangler.telegram.jsonc
```
```bash
npx wrangler secret put WEBHOOK_SECRET --config wrangler.telegram.jsonc
```

**7. Connect Telegram to the Worker**
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" --data-urlencode "url=https://askakshay-telegram.<your-subdomain>.workers.dev/telegram" --data-urlencode "secret_token=<WEBHOOK_SECRET>"
```
You should see `"ok":true`.

**8. Test**
1. Send `/help` to the bot. You should get the command list.
2. Send `/news`. You should get up to 10 stories. Send `/news` again straight away: it must not repeat any of them.
3. If nothing comes back: `npx wrangler tail --config wrangler.telegram.jsonc` shows live errors; `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` shows Telegram's last delivery error.

**9. Check the schedule.** Send `/morning`, `/open` and `/close` now to see all three. The first automatic brief is the next weekday 08:00, 12:00 or 18:30 Malaysia time. The first one has nothing to compare with and says so.

## Safety

- Requests without the right `x-telegram-bot-api-secret-token` get 403.
- Messages from any chat other than `OWNER_CHAT_ID` get no reply.
- Missing data is shown as `n/a`, never as zero.
- Links are only added when they start with `http` or `https`.

## Test

```bash
node --test apps/telegram-bot/tests/*.test.mjs
```

## Not done on purpose

No CI or auto-deploy workflow: this deploys by hand with your own Cloudflare login, so it cannot disturb Alphavision, Tripwire, ApexPro or lockedfree.
