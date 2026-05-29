# Telegram Setup

## Set secrets

```bash
npx wrangler secret put OPENAI_API_KEY --name agent-core
npx wrangler secret put TELEGRAM_BOT_TOKEN --name agent-core
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON --name agent-core
npx wrangler secret put GOOGLE_SHEET_ID --name agent-core
```

## Deploy

```bash
npx wrangler deploy --name agent-core
```

## Register webhook

```bash
python scripts/register_telegram_webhook.py
```

## Verify webhook

```bash
python scripts/check_telegram_webhook.py
```

## Test commands

```bash
python scripts/test_telegram_message.py
```
