# Agent Core

Shared Cloudflare Worker brain for Telegram, WhatsApp, and website chat.

## What this does

- Uses one `generateAgentReply(...)` function for every channel.
- Prioritizes Telegram first.
- Uses Google Sheets when configured.
- Falls back to in-memory storage when Sheets is unavailable.
- Recommends massage, spa, massage at home, karaoke, bars, seafood, nightlife, and local tips.
- Keeps replies short and tourist-friendly.

## Folder structure

```text
workers/agent-core/
  wrangler.toml
  package.json
  src/
    index.js
    agent.js
    channels/
      telegram.js
      whatsapp.js
      webchat.js
    storage/
      googleSheets.js
      memory.js
    data/
      venues.js
    prompts/
      systemPrompt.js
    utils/
      rateLimit.js
```

## Required secrets

Set these with Wrangler:

```bash
npx wrangler secret put OPENAI_API_KEY --name agent-core
npx wrangler secret put TELEGRAM_BOT_TOKEN --name agent-core
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON --name agent-core
npx wrangler secret put GOOGLE_SHEET_ID --name agent-core
```

Optional future WhatsApp credentials:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`

## Google Sheet tabs required

Create these tabs in the sheet named by `GOOGLE_SHEET_ID`:

- `customers`
- `conversations`
- `leads`
- `booking_requests`
- `faq`
- `venues`
- `prompt_rules`

Suggested columns:

- `customers`: `userId`, `channel`, `userName`, `areaPreference`, `language`, `notes`, `firstSeenAt`, `lastSeenAt`
- `conversations`: `timestamp`, `channel`, `userId`, `role`, `text`
- `leads`: `timestamp`, `channel`, `userId`, `userName`, `message`, `detectedIntent`, `page`, `status`
- `booking_requests`: `timestamp`, `channel`, `userId`, `userName`, `message`, `requestedService`, `requestedArea`, `requestedTime`, `notes`, `status`
- `faq`: `question`, `answer`, `category`, `sortOrder`
- `venues`: `category`, `name`, `area`, `address`, `rating`, `reviewCount`, `website`, `phone`, `description`
- `prompt_rules`: `key`, `value`, `enabled`

If a tab is empty or Sheets is unavailable, the worker falls back to built-in defaults and keeps responding.

## Telegram webhook setup

After deployment, set the webhook to:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<WORKER_URL>/telegram/webhook
```

Example:

```bash
https://api.telegram.org/bot123456:ABC/setWebhook?url=https://agent-core.example.workers.dev/telegram/webhook
```

Supported commands:

- `/start`
- `/help`
- `/massage`
- `/karaoke`
- `/bars`
- `/seafood`
- `/book`

## WhatsApp future setup

WhatsApp is prepared as an adapter interface. To enable message sending, add:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`

The webhook endpoint is:

```text
POST /whatsapp/webhook
```

If credentials are missing, the adapter returns a clean placeholder response and continues using the shared agent logic.

## Website chat future setup

The website adapter is ready for future front-end integration.

Endpoint:

```text
POST /webchat/message
```

Request body:

```json
{
  "userId": "abc123",
  "message": "Need a massage tonight near My Khe",
  "page": "/top-massage-danang.html"
}
```

Response:

```json
{
  "reply": "...",
  "suggestedActions": []
}
```

## Deploy

From this folder:

```bash
npx wrangler deploy
```

If your Wrangler version accepts a worker name flag, this is also fine:

```bash
npx wrangler deploy --name agent-core
```

## Testing

Run syntax checks:

```bash
node --check workers/agent-core/src/index.js
node --check workers/agent-core/src/agent.js
node --check workers/agent-core/src/channels/telegram.js
node --check workers/agent-core/src/storage/googleSheets.js
```

Start local dev:

```bash
npx wrangler dev
```

## Notes

- Do not commit secrets.
- Keep replies short.
- Always verify venue details with Google Maps or the venue directly.
- Use Telegram as the primary growth channel, WhatsApp as booking support, and web chat as a future adapter.
