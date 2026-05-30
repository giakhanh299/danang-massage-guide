from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from telegram_codex_agent_store import (
    get_status,
    save_commit_info,
    save_task,
    update_status,
)

app = FastAPI(title="Telegram Codex Agent API")


def get_shared_secret() -> str:
    return str(os.getenv("AGENT_SHARED_SECRET", "")).strip()


def require_shared_secret(x_agent_secret: str | None) -> None:
    configured = get_shared_secret()
    if not configured:
      raise HTTPException(status_code=503, detail="AGENT_SHARED_SECRET is not configured")

    provided = str(x_agent_secret or "").strip()
    if provided != configured:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/status")
async def status(x_agent_secret: str | None = Header(default=None)) -> Dict[str, Any]:
    require_shared_secret(x_agent_secret)
    return get_status()


@app.get("/last")
async def last(x_agent_secret: str | None = Header(default=None)) -> Dict[str, Any]:
    require_shared_secret(x_agent_secret)
    current = get_status()
    return {
        "status": current.get("status", "idle"),
        "taskId": current.get("taskId", ""),
        "updatedAt": current.get("updatedAt", ""),
        "lastCommitHash": current.get("lastCommitHash", ""),
        "lastCommitMessage": current.get("lastCommitMessage", ""),
    }


@app.post("/task")
async def task(request: Request, x_agent_secret: str | None = Header(default=None)) -> Dict[str, Any]:
    require_shared_secret(x_agent_secret)
    payload = await request.json()
    record = save_task(payload if isinstance(payload, dict) else {})
    return {
        "ok": True,
        "status": "pending",
        "taskId": record["taskId"],
        "taskFile": record["taskFile"],
        "updatedAt": record["updatedAt"],
    }


@app.post("/complete")
async def complete(request: Request, x_agent_secret: str | None = Header(default=None)) -> Dict[str, Any]:
    require_shared_secret(x_agent_secret)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON body required")

    status_value = str(payload.get("status") or "done").strip().lower()
    task_id = str(payload.get("taskId") or "").strip()
    commit_hash = str(payload.get("commitHash") or payload.get("commit") or "").strip()
    commit_message = str(payload.get("commitMessage") or payload.get("message") or "").strip()
    notes = str(payload.get("notes") or "").strip()

    updated = update_status(
        {
            "status": status_value,
            "taskId": task_id,
            "notes": notes,
        }
    )

    if commit_hash or commit_message:
        save_commit_info(commit_hash, commit_message, task_id=task_id or updated.get("taskId"))

    return {
        "ok": True,
        "status": updated.get("status", status_value),
        "taskId": updated.get("taskId", task_id),
        "updatedAt": updated.get("updatedAt"),
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"ok": False, "error": "Internal Server Error"})

