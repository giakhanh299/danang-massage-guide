import { configureAgentCore } from "./agent.js";
import { createStorage } from "./storage/googleSheets.js";
import { handleTelegramWebhook } from "./channels/telegram.js";
import { handleWhatsAppWebhook } from "./channels/whatsapp.js";
import { handleWebChatMessage } from "./channels/webchat.js";

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  if (status === 204 || payload === null || payload === undefined) {
    return new Response(null, {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        ...extraHeaders
      }
    });
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...extraHeaders
    }
  });
}

function isAuthorizedAdminRequest(request, env) {
  const token = String(env.ADMIN_DASHBOARD_TOKEN || "");
  if (!token) {
    return false;
  }

  const url = new URL(request.url);
  const bearer = request.headers.get("authorization") || "";
  const headerToken = request.headers.get("x-admin-token") || "";
  const queryToken = url.searchParams.get("token") || "";

  const provided = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : headerToken.trim() || queryToken.trim();
  return Boolean(provided && provided === token);
}

function notFound() {
  return jsonResponse(
    {
      ok: false,
      error: "Not found"
    },
    404
  );
}

function logWorkerError(error, context = "") {
  const stack = error instanceof Error ? error.stack || error.message : String(error);
  console.error(context ? `${context}: ${stack}` : stack);
}

function getRuntimeConfigFlags(env) {
  return {
    telegramConfigured: Boolean(env?.TELEGRAM_BOT_TOKEN),
    openaiConfigured: Boolean(env?.OPENAI_API_KEY),
    sheetsConfigured: Boolean(env?.GOOGLE_SERVICE_ACCOUNT_JSON && env?.GOOGLE_SHEET_ID)
  };
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const runtimeFlags = getRuntimeConfigFlags(env);

      if (!globalThis.__AGENT_CORE_DIAGNOSTICS_LOGGED) {
        console.log("agent-core diagnostics", runtimeFlags);
        globalThis.__AGENT_CORE_DIAGNOSTICS_LOGGED = true;
      }

      if (request.method === "OPTIONS") {
        return jsonResponse(null, 204);
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ status: "ok" });
      }

      if (request.method === "GET" && url.pathname === "/debug/config") {
        return jsonResponse(runtimeFlags);
      }

      if (request.method === "GET" && url.pathname === "/") {
        return jsonResponse({
          ok: true,
          service: "agent-core",
          channels: ["telegram", "whatsapp", "webchat"],
          storage: "lazy"
        });
      }

      if (request.method === "GET" && url.pathname === "/admin/stats") {
        if (!isAuthorizedAdminRequest(request, env)) {
          return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
        }

        configureAgentCore(env);
        const storage = createStorage(env);
        const stats = await storage.getAdminStats();
        return jsonResponse(stats);
      }

      if (url.pathname === "/telegram/webhook" && request.method === "POST") {
        configureAgentCore(env);
        const storage = createStorage(env);
        return await handleTelegramWebhook(request, env, storage, ctx);
      }

      if (url.pathname === "/whatsapp/webhook") {
        configureAgentCore(env);
        const storage = createStorage(env);
        return await handleWhatsAppWebhook(request, env, storage, ctx);
      }

      if (url.pathname === "/webchat/message") {
        configureAgentCore(env);
        const storage = createStorage(env);
        return await handleWebChatMessage(request, env, storage, ctx);
      }

      return notFound();
    } catch (error) {
      logWorkerError(error, "agent-core request failed");
      return jsonResponse(
        {
          ok: false,
          error: "Internal Server Error"
        },
        500
      );
    }
  }
};
