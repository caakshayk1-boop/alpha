# Telegram bot (owner only)

One free Cloudflare Worker (`askakshay-telegram`). It answers only your chat, reads the feeds you already publish, keeps your notes and a "already sent" list in a Durable Object, and sends the **top 10 news at 08:00, 12:00, 16:00, 20:00 and 00:00** every day. It places no orders.

| Command | Reads |
|---|---|
| `/news` | top 10 stories you have not been sent yet (same as the scheduled send) |
| `/pulse` | Tripwire `api/pulse` |
| `/signals` | Alphavision `signals.json` |
| `/tripwire` | Tripwire `api/ledger` |
| `/rulebook` | lockedfree `ledger.json` from `main` on GitHub ("not published yet" until the lockedfree PR is merged) |
| `/stock SYMBOL` | Alphavision `c/SYMBOL.json` |
| `/digest` | pulse + signals + tripwire + rulebook |
| `/note TEXT`, `/notes`, `/del N` | your notes |

## How the news works

- Source: Tripwire's `/api/news`, which already merges duplicate stories into one event.
- Ranking: stories from the last 48 hours, most significant first; repeats inside a batch (same id, link or headline) are dropped.
- No repeats: each story id sent is remembered for 14 days. A story is never sent twice, even by `/news`.
- Fewer than 10 new stories: it sends what there is. None: it sends "No new stories since the last update."
- Times: the clock is `NEWS_TZ` in `wrangler.telegram.jsonc`, set to `Asia/Kolkata`. For another zone change that one line (for example `Asia/Dubai` or `Asia/Kuala_Lumpur`) and deploy again.
- GitHub or Cloudflare can run a tick a few minutes late; the send happens on the first tick inside the first half hour of each hour, and a slot can never send twice.

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

**9. Wait for the schedule.** The first automatic send is at the next 08:00, 12:00, 16:00, 20:00 or 00:00 in your zone.

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
