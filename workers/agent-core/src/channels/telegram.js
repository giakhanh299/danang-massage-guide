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

  const command = String(parts.messageText || "").trim().split(/\s+/)[0].toLowerCase();
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
