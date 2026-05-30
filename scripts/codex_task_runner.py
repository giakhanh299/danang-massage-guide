from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import List

from telegram_codex_agent_store import (
    ROOT_DIR,
    STATUS_FILE,
    TASK_FILE,
    get_status,
    save_commit_info,
    update_status,
)


def run_command(command: List[str]) -> None:
    subprocess.run(command, cwd=str(ROOT_DIR), check=True)


def read_task_text() -> str:
    if TASK_FILE.exists():
        return TASK_FILE.read_text(encoding="utf-8")
    return "No Telegram task file found."


def run_safe_checks() -> None:
    run_command(["node", "--check", "assets/js/main.js"])
    run_command(["git", "diff", "--check"])


def main() -> int:
    parser = argparse.ArgumentParser(description="Process the latest Telegram Codex task.")
    parser.add_argument("--run-checks", action="store_true", help="Run safe validation checks")
    parser.add_argument("--commit", action="store_true", help="Create a git commit after checks pass")
    parser.add_argument("--push", action="store_true", help="Push after commit")
    parser.add_argument("--commit-message", default="", help="Commit message to use when committing")
    args = parser.parse_args()

    task_text = read_task_text()
    status = get_status()
    task_id = status.get("taskId") or "telegram-task"

    update_status(
        {
            "status": "running",
            "taskId": task_id,
            "updatedAt": status.get("updatedAt") or "",
            "notes": "Task runner started",
        }
    )

    try:
        if args.run_checks:
            run_safe_checks()

        if args.commit:
            commit_message = args.commit_message.strip() or f"Process Telegram task {task_id}"
            run_command(["git", "add", "."])
            run_command(["git", "commit", "-m", commit_message])
            commit_hash = subprocess.check_output(
                ["git", "rev-parse", "HEAD"],
                cwd=str(ROOT_DIR),
                text=True,
            ).strip()
            save_commit_info(commit_hash, commit_message, task_id=task_id)
            if args.push:
                run_command(["git", "push"])
        else:
            update_status(
                {
                    "status": "done" if args.run_checks else "pending",
                    "taskId": task_id,
                    "notes": "Checks completed" if args.run_checks else "Task prepared",
                }
            )

        return 0
    except subprocess.CalledProcessError as error:
        update_status(
            {
                "status": "error",
                "taskId": task_id,
                "notes": f"Command failed: {' '.join(error.cmd) if isinstance(error.cmd, list) else error.cmd}",
            }
        )
        return error.returncode or 1
    except Exception as error:
        update_status(
            {
                "status": "error",
                "taskId": task_id,
                "notes": str(error),
            }
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
