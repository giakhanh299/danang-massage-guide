from __future__ import annotations

import os
import sys
from urllib.request import ProxyHandler, Request, build_opener


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("TELEGRAM_BOT_TOKEN is required", file=sys.stderr)
        return 1

    api_url = f"https://api.telegram.org/bot{token}/getWebhookInfo"
    request = Request(api_url, method="GET")

    opener = build_opener(ProxyHandler({}))
    with opener.open(request, timeout=60) as response:
        payload = response.read().decode("utf-8")

    import json

    data = json.loads(payload)
    result = data.get("result", {}) if isinstance(data, dict) else {}
    print(f"current webhook URL: {result.get('url', '')}")
    print(f"pending update count: {result.get('pending_update_count', 0)}")
    print(f"last error message: {result.get('last_error_message', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
