from __future__ import annotations

import os
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen


TARGET_PATH = "/telegram/webhook"


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    worker_url = os.environ.get("WORKER_URL", "https://agent-core.giakhanh299.workers.dev").strip()

    if not token:
        print("TELEGRAM_BOT_TOKEN is required", file=sys.stderr)
        return 1

    webhook_url = f"{worker_url.rstrip('/')}{TARGET_PATH}"
    api_url = f"https://api.telegram.org/bot{token}/setWebhook"
    payload = urlencode({"url": webhook_url}).encode("utf-8")

    request = Request(api_url, data=payload, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urlopen(request, timeout=60) as response:
        print(response.read().decode("utf-8"))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
