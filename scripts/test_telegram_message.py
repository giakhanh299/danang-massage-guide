from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKER_URL = "https://agent-core.giakhanh299.workers.dev"
COMMANDS = [
    "/start",
    "/help",
    "/massage",
    "/bars",
    "/karaoke",
    "/seafood",
    "Need a massage tonight near My Khe",
]


def http_json(url: str, method: str = "GET", body: dict | None = None) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = Request(url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    with urlopen(request, timeout=60) as response:
        payload = response.read().decode("utf-8")
        return response.status, json.loads(payload) if payload else {}


def run_node(script: str, env: dict[str, str]) -> dict:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    return json.loads(result.stdout.strip())


def read_sheet_counts(env: dict[str, str]) -> dict:
    node_script = r"""
import { GoogleSheetsStorage } from './workers/agent-core/src/storage/googleSheets.js';

const storage = new GoogleSheetsStorage(process.env);
const counts = {};
for (const tab of ['customers', 'conversations', 'leads', 'booking_requests']) {
  counts[tab] = (await storage.readTab(tab)).length;
}

console.log(JSON.stringify(counts));
"""
    return run_node(node_script, env)


def build_update(index: int, text: str, chat_id: str, user_id: str, user_name: str) -> dict:
    return {
        "update_id": 1000 + index,
        "message": {
            "message_id": 2000 + index,
            "text": text,
            "chat": {"id": int(chat_id), "type": "private"},
            "from": {
                "id": int(user_id),
                "first_name": user_name,
                "username": user_name.lower().replace(" ", ""),
            },
        },
    }


def main() -> int:
    worker_url = os.environ.get("WORKER_URL", DEFAULT_WORKER_URL).rstrip("/")
    chat_id = os.environ.get("TELEGRAM_TEST_CHAT_ID", "").strip()
    user_id = os.environ.get("TELEGRAM_TEST_USER_ID", "987654321").strip()
    user_name = os.environ.get("TELEGRAM_TEST_USER_NAME", "Codex Test").strip()

    if not chat_id:
        print("TELEGRAM_TEST_CHAT_ID is required", file=sys.stderr)
        return 1

    health_status, health_json = http_json(f"{worker_url}/health")
    debug_status, debug_json = http_json(f"{worker_url}/debug/config")
    print(f"health: {health_status} {health_json}")
    print(f"debug: {debug_status} {debug_json}")

    admin_token = os.environ.get("ADMIN_DASHBOARD_TOKEN", "").strip()
    if admin_token:
        admin_status, admin_json = http_json(f"{worker_url}/admin/stats?token={admin_token}")
        print(f"admin stats: {admin_status} {admin_json}")

    sheet_env = {
        key: os.environ[key]
        for key in ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SHEET_ID"]
        if key in os.environ and os.environ[key].strip()
    }
    before_counts = None
    if len(sheet_env) == 2:
        before_counts = read_sheet_counts({**os.environ, **sheet_env})
        print(f"sheet counts before: {before_counts}")

    for index, text in enumerate(COMMANDS):
        status, payload = http_json(
            f"{worker_url}/telegram/webhook",
            method="POST",
            body=build_update(index, text, chat_id, user_id, user_name),
        )
        print(f"{text}: {status} {payload}")
        time.sleep(0.5)

    if len(sheet_env) == 2:
        time.sleep(3)
        after_counts = read_sheet_counts({**os.environ, **sheet_env})
        print(f"sheet counts after: {after_counts}")
        for tab in ["customers", "conversations", "leads", "booking_requests"]:
            before = before_counts.get(tab, 0) if before_counts else 0
            after = after_counts.get(tab, 0)
            print(f"{tab}: {before} -> {after}")

    print("telegram message test completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
