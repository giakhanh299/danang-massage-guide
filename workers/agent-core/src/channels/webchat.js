import { VENUE_DATA } from "../data/venues.js";
import { configureAgentCore, generateAgentReply, detectLeadIntent } from "../agent.js";
import { checkRateLimit } from "../utils/rateLimit.js";

function jsonResponse(payload, status = 200) {
  if (status === 204 || payload === null || payload === undefined) {
    return new Response(null, {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

function buildRateLimitReply() {
  return [
    "Please wait a few minutes before sending more messages.",
    "For quick help, join: https://t.me/danangmassagebooking",
    "Booking support: https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3",
    "View website: https://danang-massage-guide.pages.dev/"
  ].join("\n");
}

export async function handleWebChatMessage(request, env, storage, ctx) {
  if (request.method === "OPTIONS") {
    return jsonResponse(null, 204);
  }

  const payload = await request.json();
  const userId = String(payload.userId || crypto.randomUUID());
  const userName = String(payload.userName || "Website visitor");
  const messageText = String(payload.message || "");
  const page = String(payload.page || "website");
  const rateLimit = checkRateLimit(`webchat:${userId}`, { limit: 10, windowMs: 300000 });

  if (!rateLimit.allowed) {
    const reply = buildRateLimitReply();
    return jsonResponse(
      {
        reply,
        suggestedActions: [
          { label: "Join Telegram Group", url: "https://t.me/danangmassagebooking" },
          { label: "Book via WhatsApp", url: "https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3" },
          { label: "View Website", url: "https://danang-massage-guide.pages.dev/" }
        ],
        rateLimited: true
      },
      429
    );
  }

  const profile = (await storage.getCustomerProfile(userId, "webchat")) || {
    userId,
    channel: "webchat",
    userName,
    areaPreference: "",
    language: "en",
    notes: "",
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  const [faq, promptRules] = await Promise.all([storage.getFAQ(), storage.getPromptRules()]);
  const venueData = (await storage.getVenueCatalog()) || VENUE_DATA;
  configureAgentCore(env, { faq, promptRules });

  const history = await storage.getConversationHistory("webchat", userId, 12);
  const profilePromise = storage.saveCustomerProfile({
    ...profile,
    userName,
    lastSeenAt: new Date().toISOString()
  });

  const replyPayload = await generateAgentReply({
    channel: "webchat",
    userId,
    userName,
    messageText,
    conversationHistory: history,
    venueData,
    customerProfile: profile
  });
  const detectedCategory = replyPayload.detectedCategory || "general";

  const userMessagePromise = storage.saveConversationMessage("webchat", userId, "user", messageText, detectedCategory);
  const assistantMessagePromise = storage.saveConversationMessage("webchat", userId, "assistant", replyPayload.reply, detectedCategory);

  if (replyPayload.leadCaptured || detectLeadIntent(messageText)) {
    ctx?.waitUntil(
      storage.saveLead({
        channel: "webchat",
        userId,
        userName,
        message: messageText,
        detectedIntent: replyPayload.detectedIntent,
        category: detectedCategory,
        page,
        timestamp: new Date().toISOString()
      })
    );
  }

  ctx?.waitUntil(profilePromise);
  ctx?.waitUntil(userMessagePromise);
  ctx?.waitUntil(assistantMessagePromise);

  return jsonResponse({
    reply: replyPayload.reply,
    suggestedActions: replyPayload.suggestedActions,
    detectedIntent: replyPayload.detectedIntent
  });
}
