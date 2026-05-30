# Telegram Codex Agent

This connects Telegram task messages to a local Codex task workflow.

## Environment variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_ID`
- `LOCAL_AGENT_API_URL`
- `AGENT_SHARED_SECRET`
- Optional: `TELEGRAM_WEBHOOK_SECRET`

## Local API

Run from the repo root:

```bash
python -m uvicorn scripts.telegram_codex_agent_api:app --host 0.0.0.0 --port 8765
```

The API exposes:

- `GET /health`
- `GET /status`
- `GET /last`
- `POST /task`
- `POST /complete`

## Worker webhook

Set the Telegram webhook to the Cloudflare Worker endpoint:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<WORKER_URL>/telegram/webhook
```

If you use `TELEGRAM_WEBHOOK_SECRET`, register it with Telegram so the Worker can verify incoming webhooks.

## Telegram commands

- `/task <text>` forwards a task to the local API.
- `/status` shows the latest task status.
- `/last` shows the latest commit details.
- `/help` shows the task command help.

## Local runner

Run safe checks only:

```bash
python scripts/codex_task_runner.py --run-checks
```

Commit after checks pass:

```bash
python scripts/codex_task_runner.py --run-checks --commit --commit-message "Your message"
```

Push after commit:

```bash
python scripts/codex_task_runner.py --run-checks --commit --push --commit-message "Your message"
```
