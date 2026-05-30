import { VENUE_DATA } from "../data/venues.js";
import { configureAgentCore, generateAgentReply, detectLeadIntent } from "../agent.js";
import { checkRateLimit } from "../utils/rateLimit.js";

function getMessageParts(update) {
  const message = update.message || update.edited_message || update.channel_post;
  if (!message || !message.text) {
    return null;
  }

  const from = message.from || {};
  return {
    chatId: message.chat?.id,
    userId: String(from.id || message.chat?.id || "telegram-user"),
    userName: [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "Telegram user",
    messageText: String(message.text),
    rawMessage: message
  };
}

async function sendTelegramMessage(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status}`);
  }

  return response.json();
}

function buildBookingRequestPayload(parts, reply, detectedIntent, detectedCategory = "general") {
  return {
    channel: "telegram",
    userId: parts.userId,
    userName: parts.userName,
    message: parts.messageText,
    detectedIntent,
    category: detectedCategory,
    page: "telegram/webhook",
    status: "new",
    requestedService: detectedIntent,
    requestedArea: "",
    requestedTime: "",
    notes: reply
  };
}

function buildRateLimitReply() {
  return [
    "Please wait a few minutes before sending more messages.",
    "For quick help, join: https://t.me/danangmassagebooking",
    "Booking support: https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3",
    "View website: https://danang-massage-guide.pages.dev/"
  ].join("\n");
}

function buildTaskHelpReply() {
  return [
    "Telegram task commands:",
    "/task <text> - send a new Codex task",
    "/status - check the latest task status",
    "/last - view the latest commit",
    "/help - show this message",
    "",
    "For quick help, join: https://t.me/danangmassagebooking"
  ].join("\n");
}

function buildTaskStatusReply(statusPayload) {
  const status = statusPayload?.status || "unknown";
  const taskId = statusPayload?.taskId || "unknown";
  const updatedAt = statusPayload?.updatedAt || "unknown";
  const lastCommit = statusPayload?.lastCommitHash || statusPayload?.commitHash || "";
  const lastMessage = statusPayload?.lastCommitMessage || statusPayload?.commitMessage || "";

  return [
    `Status: ${status}`,
    `Task ID: ${taskId}`,
    `Updated: ${updatedAt}`,
    lastCommit ? `Last commit: ${lastCommit}` : "Last commit: none",
    lastMessage ? `Message: ${lastMessage}` : "",
    "",
    "For quick help, join: https://t.me/danangmassagebooking"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTaskAcceptedReply(result, taskText) {
  const taskId = result?.taskId || result?.id || "pending";
  return [
    "Task accepted.",
    `Task ID: ${taskId}`,
    `Summary: ${taskText.slice(0, 160)}`,
    "",
    "Status will update in /status and /last.",
    "For quick help, join: https://t.me/danangmassagebooking"
  ].join("\n");
}

function buildLastReply(statusPayload) {
  const lastCommit = statusPayload?.lastCommitHash || statusPayload?.commitHash || "none";
  const lastMessage = statusPayload?.lastCommitMessage || statusPayload?.commitMessage || "none";
  const status = statusPayload?.status || "unknown";

  return [
    `Status: ${status}`,
    `Last commit: ${lastCommit}`,
    `Message: ${lastMessage}`,
    "",
    "For quick help, join: https://t.me/danangmassagebooking"
  ].join("\n");
}

function isTaskControlCommand(command) {
  return ["/task", "/status", "/last", "/help"].includes(command);
}

function isAllowedTaskUser(env, userId) {
  const allowed = String(env.TELEGRAM_ALLOWED_USER_ID || "").trim();
  if (!allowed) {
    return true;
  }

  return allowed === String(userId);
}

async function callLocalAgentApi(env, path, payload = null) {
  const baseUrl = String(env.LOCAL_AGENT_API_URL || "").trim();
  if (!baseUrl) {
    throw new Error("LOCAL_AGENT_API_URL is not configured");
  }

  const targetUrl = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const headers = {
    "Content-Type": "application/json",
    "X-Agent-Secret": String(env.AGENT_SHARED_SECRET || "")
  };

  const response = await fetch(targetUrl.toString(), {
    method: payload ? "POST" : "GET",
    headers,
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Local agent API ${path} failed: ${response.status} ${body}`);
  }

  return response.json();
}

function isAdminUser(env, userId) {
  const raw = String(env.TELEGRAM_ADMIN_IDS || env.TELEGRAM_ADMIN_USER_IDS || "");
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return ids.includes(String(userId));
}

function formatStatsText(stats) {
  const questions = Array.isArray(stats.top_questions) ? stats.top_questions.slice(0, 5) : [];
  const categories = Array.isArray(stats.top_categories) ? stats.top_categories.slice(0, 5) : [];

  return [
    `Customers: ${stats.total_customers || 0}`,
    `Leads: ${stats.total_leads || 0}`,
    `Bookings: ${stats.total_bookings || 0}`,
    "",
    "Top questions:",
    ...(questions.length ? questions.map((item, index) => `${index + 1}. ${item.question}`) : ["No FAQ data yet."]),
    "",
    "Top categories:",
    ...(categories.length ? categories.map((item, index) => `${index + 1}. ${item.category} (${item.count})`) : ["No lead data yet."]),
    "",
    "For quick help, join: https://t.me/danangmassagebooking",
    "Booking support: https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3",
    "View website: https://danang-massage-guide.pages.dev/"
  ].join("\n");
}

function formatRecentRows(title, rows, mapper) {
  const entries = Array.isArray(rows) ? rows.slice(0, 10) : [];
  const body = entries.length
    ? entries.map((row, index) => `${index + 1}. ${mapper(row)}`).join("\n")
    : "No rows yet.";

  return `${title}\n${body}\n\nFor quick help, join: https://t.me/danangmassagebooking\nBooking support: https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3`;
}

export async function handleTelegramWebhook(request, env, storage, ctx) {
  const update = await request.json();
  const parts = getMessageParts(update);

  if (!parts) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const command = String(parts.messageText || "").trim().split(/\s+/)[0].toLowerCase();
  if (isTaskControlCommand(command)) {
    if (!isAllowedTaskUser(env, parts.userId)) {
      const reply = "This command is restricted to the allowed Telegram user.";
      await sendTelegramMessage(env, parts.chatId, reply);
      return new Response(JSON.stringify({ ok: false, unauthorized: true }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (command === "/help") {
      const reply = buildTaskHelpReply();
      await sendTelegramMessage(env, parts.chatId, reply);
      return new Response(JSON.stringify({ ok: true, help: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (command === "/status") {
      try {
        const statusPayload = await callLocalAgentApi(env, "/status");
        const reply = buildTaskStatusReply(statusPayload);
        await sendTelegramMessage(env, parts.chatId, reply);
        return new Response(JSON.stringify({ ok: true, status: statusPayload }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        const reply = "Unable to read the latest task status right now.";
        await sendTelegramMessage(env, parts.chatId, reply);
        return new Response(JSON.stringify({ ok: false, error: "status unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (command === "/last") {
      try {
        const statusPayload = await callLocalAgentApi(env, "/last");
        const reply = buildLastReply(statusPayload);
        await sendTelegramMessage(env, parts.chatId, reply);
        return new Response(JSON.stringify({ ok: true, last: statusPayload }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        const reply = "Unable to read the latest commit right now.";
        await sendTelegramMessage(env, parts.chatId, reply);
        return new Response(JSON.stringify({ ok: false, error: "last unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const taskText = String(parts.messageText || "").replace(/^\/task(\s+)?/i, "").trim();
    if (!taskText) {
      const reply = [
        "Send a task with:",
        "/task <your request>",
        "",
        "For quick help, join: https://t.me/danangmassagebooking"
      ].join("\n");
      await sendTelegramMessage(env, parts.chatId, reply);
      return new Response(JSON.stringify({ ok: false, error: "task text required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const accepted = await callLocalAgentApi(env, "/task", {
        channel: "telegram",
        userId: parts.userId,
        userName: parts.userName,
        chatId: parts.chatId,
        messageText: taskText,
        rawCommand: parts.messageText,
        source: "telegram"
      });

      const reply = buildTaskAcceptedReply(accepted, taskText);
      await sendTelegramMessage(env, parts.chatId, reply);
      return new Response(JSON.stringify({ ok: true, accepted }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      const reply = "Task could not be forwarded to the local agent.";
      await sendTelegramMessage(env, parts.chatId, reply);
      return new Response(JSON.stringify({ ok: false, error: "task forwarding failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  const rateLimit = checkRateLimit(`telegram:${parts.userId}`, { limit: 10, windowMs: 300000 });
  if (!rateLimit.allowed) {
    const reply = buildRateLimitReply();
    await sendTelegramMessage(env, parts.chatId, reply);
    return new Response(JSON.stringify({ ok: false, rateLimited: true, reply }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  const [faq, promptRules] = await Promise.all([storage.getFAQ(), storage.getPromptRules()]);
  const venueData = (await storage.getVenueCatalog()) || VENUE_DATA;
  configureAgentCore(env, { faq, promptRules });
  const profile = (await storage.getCustomerProfile(parts.userId, "telegram")) || {
    userId: parts.userId,
    channel: "telegram",
    userName: parts.userName,
    areaPreference: "",
    language: "en",
    notes: "",
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  if (command === "/stats" || command === "/leads" || command === "/bookings") {
    if (!isAdminUser(env, parts.userId)) {
      const reply = "This command is admin-only.";
      await sendTelegramMessage(env, parts.chatId, reply);
      return new Response(JSON.stringify({ ok: false, unauthorized: true }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    let reply = "";

    if (command === "/stats") {
      const stats = await storage.getAdminStats();
      reply = formatStatsText(stats);
    } else if (command === "/leads") {
      const leads = await storage.getRecentLeads(10);
      reply = formatRecentRows(
        "Recent leads:",
        leads,
        (row) => `${row.timestamp || "unknown"} | ${row.channel || "unknown"} | ${row.userName || row.userId || "unknown"} | ${row.category || row.detectedIntent || "general"} | ${row.message || ""}`
      );
    } else {
      const bookings = await storage.getRecentBookings(10);
      reply = formatRecentRows(
        "Recent bookings:",
        bookings,
        (row) => `${row.timestamp || "unknown"} | ${row.channel || "unknown"} | ${row.userName || row.userId || "unknown"} | ${row.category || row.requestedService || row.detectedIntent || "booking"} | ${row.requestedArea || ""}`
      );
    }

    await sendTelegramMessage(env, parts.chatId, reply);
    return new Response(JSON.stringify({ ok: true, adminCommand: command }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const history = await storage.getConversationHistory("telegram", parts.userId, 12);
  const commandIntentMap = {
    "/start": "start",
    "/help": "help",
    "/massage": "massage",
    "/massage-at-home": "massage at home",
    "/karaoke": "karaoke",
    "/bars": "bars",
    "/seafood": "seafood",
    "/book": "booking"
  };
  const intentHint = commandIntentMap[command] || "";
  const profilePromise = storage.saveCustomerProfile({
    ...profile,
    userName: parts.userName,
    lastSeenAt: new Date().toISOString()
  });

  const replyPayload = await generateAgentReply({
    channel: "telegram",
    userId: parts.userId,
    userName: parts.userName,
    messageText: parts.messageText,
    conversationHistory: history,
    venueData,
    customerProfile: profile,
    intentHint
  });
  const detectedCategory = replyPayload.detectedCategory || "general";
  const userMessagePromise = storage.saveConversationMessage("telegram", parts.userId, "user", parts.messageText, detectedCategory);

  const assistantMessagePromise = storage.saveConversationMessage("telegram", parts.userId, "assistant", replyPayload.reply, detectedCategory);

  if (replyPayload.leadCaptured || detectLeadIntent(parts.messageText)) {
    const leadPromise = storage.saveLead({
      channel: "telegram",
      userId: parts.userId,
      userName: parts.userName,
      message: parts.messageText,
      detectedIntent: replyPayload.detectedIntent,
      category: detectedCategory,
      timestamp: new Date().toISOString()
    });
    ctx?.waitUntil(leadPromise);
  }

  if (replyPayload.detectedIntent === "booking" || command === "/book") {
    ctx?.waitUntil(storage.saveBookingRequest(buildBookingRequestPayload(parts, replyPayload.reply, replyPayload.detectedIntent, detectedCategory)));
  }

  ctx?.waitUntil(userMessagePromise);
  ctx?.waitUntil(profilePromise);
  ctx?.waitUntil(assistantMessagePromise);

  await sendTelegramMessage(env, parts.chatId, replyPayload.reply);

  return new Response(JSON.stringify({ ok: true, reply: replyPayload.reply }), {
    headers: { "Content-Type": "application/json" }
  });
}
