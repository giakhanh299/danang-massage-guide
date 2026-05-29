import { VENUE_DATA } from "../data/venues.js";
import { configureAgentCore, generateAgentReply, detectLeadIntent } from "../agent.js";
import { checkRateLimit } from "../utils/rateLimit.js";

function getCommandMessage(text) {
  const command = String(text || "").trim().split(/\s+/)[0].toLowerCase();

  switch (command) {
    case "/start":
      return "Welcome the user and explain that you help with massage, spa, massage at home, karaoke, bars, seafood, nightlife, and local tips in Da Nang. Keep it short and friendly.";
    case "/help":
      return "Explain how to ask for recommendations and list the supported topics. Keep it concise.";
    case "/massage":
      return "Recommend up to 3 massage and spa options in Da Nang. Use area and reason. Remind the user to verify on Google Maps.";
    case "/karaoke":
      return "Recommend up to 3 karaoke venues in Da Nang. Use area and reason. Remind the user to verify on Google Maps.";
    case "/bars":
      return "Recommend up to 3 bars and clubs in Da Nang. Use area and reason. Remind the user to verify on Google Maps.";
    case "/seafood":
      return "Recommend up to 3 seafood and beer spots in Da Nang. Use area and reason. Remind the user to verify on Google Maps.";
    case "/book":
      return "The user wants booking support now. Ask for service, area, and preferred time in one short reply.";
    default:
      return text;
  }
}

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

function buildBookingRequestPayload(parts, reply, detectedIntent) {
  return {
    channel: "telegram",
    userId: parts.userId,
    userName: parts.userName,
    message: parts.messageText,
    detectedIntent,
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
  configureAgentCore(env, { faq, promptRules });

  const commandMessage = getCommandMessage(parts.messageText);
  const history = await storage.getConversationHistory("telegram", parts.userId, 12);

  const userMessagePromise = storage.saveConversationMessage("telegram", parts.userId, "user", parts.messageText);
  const profilePromise = storage.saveCustomerProfile({
    ...profile,
    userName: parts.userName,
    lastSeenAt: new Date().toISOString()
  });

  const replyPayload = await generateAgentReply({
    channel: "telegram",
    userId: parts.userId,
    userName: parts.userName,
    messageText: commandMessage,
    conversationHistory: history,
    venueData: VENUE_DATA,
    customerProfile: profile
  });

  const assistantMessagePromise = storage.saveConversationMessage("telegram", parts.userId, "assistant", replyPayload.reply);

  if (replyPayload.leadCaptured || detectLeadIntent(parts.messageText)) {
    const leadPromise = storage.saveLead({
      channel: "telegram",
      userId: parts.userId,
      userName: parts.userName,
      message: parts.messageText,
      detectedIntent: replyPayload.detectedIntent,
      timestamp: new Date().toISOString()
    });
    ctx?.waitUntil(leadPromise);
  }

  if (replyPayload.detectedIntent === "booking" || command === "/book") {
    ctx?.waitUntil(storage.saveBookingRequest(buildBookingRequestPayload(parts, replyPayload.reply, replyPayload.detectedIntent)));
  }

  ctx?.waitUntil(userMessagePromise);
  ctx?.waitUntil(profilePromise);
  ctx?.waitUntil(assistantMessagePromise);

  await sendTelegramMessage(env, parts.chatId, replyPayload.reply);

  return new Response(JSON.stringify({ ok: true, reply: replyPayload.reply }), {
    headers: { "Content-Type": "application/json" }
  });
}
