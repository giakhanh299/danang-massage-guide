# Deployment Checklist

- Set secrets with Wrangler:
  - `OPENAI_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_SHEET_ID`
  - `ADMIN_DASHBOARD_TOKEN`
- Set Telegram admin IDs with `TELEGRAM_ADMIN_IDS` or `TELEGRAM_ADMIN_USER_IDS`.
- Confirm Google Sheets tabs and columns match `GOOGLE_SHEETS_SETUP.md`.
- Generate CSV templates if needed with `python scripts/generate_google_sheet_template.py`.
- Run `node --check` on the Worker files.
- Run `python scripts/test_agent_core.py`.
- Deploy the Worker with `npx wrangler deploy`.
- Set Telegram webhook to `/telegram/webhook`.
- Verify `GET /health` returns `{"status":"ok"}`.
- Verify `GET /admin/stats` with the admin token.
