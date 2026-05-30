from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

ROOT_DIR = Path(__file__).resolve().parents[1]
RUNTIME_DIR = ROOT_DIR / "runtime"
TASKS_DIR = RUNTIME_DIR / "tasks"
TASK_FILE = ROOT_DIR / "CODEX_TASK_FROM_TELEGRAM.txt"
STATUS_FILE = RUNTIME_DIR / "telegram_task_status.json"
LAST_COMMIT_FILE = RUNTIME_DIR / "telegram_last_commit.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ensure_runtime_dirs() -> None:
    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if not path.exists():
        return dict(default or {})

    try:
      with path.open("r", encoding="utf-8") as handle:
          data = json.load(handle)
    except Exception:
        return dict(default or {})

    if isinstance(data, dict):
        return data

    return dict(default or {})


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def slugify(value: str, fallback: str = "task") -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return text[:60] or fallback


def build_task_id(prefix: str = "telegram") -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"


def build_task_record(payload: Dict[str, Any]) -> Dict[str, Any]:
    task_text = str(payload.get("messageText") or payload.get("taskText") or "").strip()
    task_id = str(payload.get("taskId") or build_task_id(payload.get("source") or "telegram"))
    source = str(payload.get("source") or "telegram")
    record = {
        "taskId": task_id,
        "source": source,
        "channel": payload.get("channel") or "telegram",
        "userId": str(payload.get("userId") or ""),
        "userName": str(payload.get("userName") or ""),
        "chatId": payload.get("chatId"),
        "taskText": task_text,
        "rawCommand": str(payload.get("rawCommand") or task_text),
        "status": "pending",
        "createdAt": utc_now(),
        "updatedAt": utc_now(),
        "notes": str(payload.get("notes") or ""),
    }
    if payload.get("requestedPath"):
        record["requestedPath"] = str(payload["requestedPath"])
    return record


def task_path_for(record: Dict[str, Any]) -> Path:
    slug = slugify(record.get("taskText") or record.get("taskId") or "telegram-task")
    return TASKS_DIR / f"{record.get('taskId', build_task_id('telegram'))}_{slug}.json"


def save_task(payload: Dict[str, Any]) -> Dict[str, Any]:
    ensure_runtime_dirs()
    record = build_task_record(payload)
    task_path = task_path_for(record)
    record["taskFile"] = str(task_path.relative_to(ROOT_DIR))
    write_json(task_path, record)
    TASK_FILE.write_text(
        "\n".join(
            [
                f"Task ID: {record['taskId']}",
                f"Source: {record['source']}",
                f"Channel: {record['channel']}",
                f"User: {record['userName']} ({record['userId']})",
                f"Status: {record['status']}",
                "",
                record["taskText"],
                "",
                f"Created At: {record['createdAt']}"
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    write_json(STATUS_FILE, record)
    return record


def get_status() -> Dict[str, Any]:
    ensure_runtime_dirs()
    status = read_json(STATUS_FILE, {"status": "idle"})
    last_commit = read_json(LAST_COMMIT_FILE, {})
    if last_commit:
        status.setdefault("lastCommitHash", last_commit.get("commitHash") or "")
        status.setdefault("lastCommitMessage", last_commit.get("commitMessage") or "")
    return status


def update_status(payload: Dict[str, Any]) -> Dict[str, Any]:
    ensure_runtime_dirs()
    current = read_json(STATUS_FILE, {"status": "idle"})
    current.update(payload)
    current.setdefault("updatedAt", utc_now())
    write_json(STATUS_FILE, current)
    return current


def save_commit_info(commit_hash: str, commit_message: str, task_id: str | None = None) -> Dict[str, Any]:
    ensure_runtime_dirs()
    record = {
        "commitHash": commit_hash,
        "commitMessage": commit_message,
        "taskId": task_id or "",
        "updatedAt": utc_now(),
    }
    write_json(LAST_COMMIT_FILE, record)
    current = read_json(STATUS_FILE, {"status": "idle"})
    current.update(
        {
            "status": "done",
            "commitHash": commit_hash,
            "commitMessage": commit_message,
            "taskId": task_id or current.get("taskId") or "",
            "updatedAt": record["updatedAt"],
        }
    )
    write_json(STATUS_FILE, current)
    return record
