# Telegram bot (owner only)

One free Cloudflare Worker (`askakshay-telegram`). It answers only your chat, reads the feeds you already publish, keeps your notes in a Durable Object, and sends a digest at 09:15 and 16:00 IST on weekdays. It places no orders.

| Command | Reads |
|---|---|
| `/pulse` | Tripwire `api/pulse` |
| `/signals` | Alphavision `signals.json` |
| `/tripwire` | Tripwire `api/ledger` |
| `/rulebook` | lockedfree `ledger.json` from `main` on GitHub (says "not published yet" until the lockedfree PR is merged) |
| `/stock SYMBOL` | Alphavision `c/SYMBOL.json` |
| `/digest` | all four above |
| `/note TEXT`, `/notes`, `/del N` | your notes |

## Setup (about 5 minutes)

1. In Telegram, message **@BotFather**, send `/newbot`, copy the token.
2. Message your new bot once (anything), then open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy `message.chat.id`.
3. Pick a long random string for `WEBHOOK_SECRET` (for example `openssl rand -hex 24`).
4. Deploy and set the three secrets (wrangler asks for each value; nothing is stored in a file):

```bash
npx wrangler deploy --config wrangler.telegram.jsonc
npx wrangler secret put BOT_TOKEN --config wrangler.telegram.jsonc
npx wrangler secret put OWNER_CHAT_ID --config wrangler.telegram.jsonc
npx wrangler secret put WEBHOOK_SECRET --config wrangler.telegram.jsonc
```

5. Point Telegram at the Worker (use the workers.dev address that `deploy` printed):

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  --data-urlencode "url=https://askakshay-telegram.<your-subdomain>.workers.dev/telegram" \
  --data-urlencode "secret_token=<WEBHOOK_SECRET>"
```

6. Send `/help` to the bot.

## Safety

- Requests without the right `x-telegram-bot-api-secret-token` get 403.
- Messages from any chat other than `OWNER_CHAT_ID` get no reply.
- Missing data is shown as `n/a`, never as zero.

## Test

```bash
node --test apps/telegram-bot/tests/*.test.mjs
```

## Not done on purpose

No CI or auto-deploy workflow: this deploys by hand with your own Cloudflare login, so it cannot disturb Alphavision, Tripwire, ApexPro or lockedfree.
