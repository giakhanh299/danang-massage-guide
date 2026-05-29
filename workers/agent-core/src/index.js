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

function notFound() {
  return jsonResponse(
    {
      ok: false,
      error: "Not found"
    },
    404
  );
}

export default {
  async fetch(request, env, ctx) {
    configureAgentCore(env);
    const url = new URL(request.url);
    const storage = createStorage(env);

    if (request.method === "OPTIONS") {
      return jsonResponse(null, 204);
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse({
        ok: true,
        service: "agent-core",
        channels: ["telegram", "whatsapp", "webchat"],
        storage: storage.constructor?.name || "storage"
      });
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env, storage, ctx);
    }

    if (url.pathname === "/whatsapp/webhook") {
      return handleWhatsAppWebhook(request, env, storage, ctx);
    }

    if (url.pathname === "/webchat/message") {
      return handleWebChatMessage(request, env, storage, ctx);
    }

    return notFound();
  }
};
