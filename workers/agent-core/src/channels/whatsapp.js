import { VENUE_DATA } from "../data/venues.js";
import { configureAgentCore, generateAgentReply, detectLeadIntent } from "../agent.js";
import { checkRateLimit } from "../utils/rateLimit.js";

const WHATSAPP_WEBHOOK_URL = "https://graph.facebook.com";

function extractMetaMessage(payload) {
  const change = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  const contact = change?.contacts?.[0];

  if (!message?.text?.body) {
    return null;
  }

  return {
    userId: String(message.from || "whatsapp-user"),
    userName: contact?.profile?.name || "WhatsApp user",
    messageText: String(message.text.body),
    phoneNumber: message.from || "",
    rawMessage: message
  };
}

async function sendWhatsAppMessage(env, phoneNumber, text) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return { sent: false, reason: "WhatsApp credentials are not configured" };
  }

  const response = await fetch(`${WHATSAPP_WEBHOOK_URL}/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: {
        body: text
      }
    })
  });

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${response.status}`);
  }

  return response.json();
}

function buildRateLimitReply() {
  return [
    "Please wait a few minutes before sending more messages.",
    "For quick help, join: https://t.me/danangmassagebooking",
    "Booking support: https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3",
    "View website: https://danang-massage-guide.pages.dev/"
  ].join("\n");
}

export async function handleWhatsAppWebhook(request, env, storage, ctx) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && token === env.WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge || "", { status: 200 });
    }

    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await request.json();
  const parts = extractMetaMessage(payload);

  if (!parts) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const rateLimit = checkRateLimit(`whatsapp:${parts.userId}`, { limit: 10, windowMs: 300000 });
  if (!rateLimit.allowed) {
    const reply = buildRateLimitReply();
    await sendWhatsAppMessage(env, parts.phoneNumber, reply);
    return new Response(JSON.stringify({ ok: false, rateLimited: true, reply }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  const profile = (await storage.getCustomerProfile(parts.userId, "whatsapp")) || {
    userId: parts.userId,
    channel: "whatsapp",
    userName: parts.userName,
    areaPreference: "",
    language: "en",
    notes: "",
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  const [faq, promptRules] = await Promise.all([storage.getFAQ(), storage.getPromptRules()]);
  const venueData = (await storage.getVenueCatalog()) || VENUE_DATA;
  configureAgentCore(env, { faq, promptRules });

  const history = await storage.getConversationHistory("whatsapp", parts.userId, 12);
  const profilePromise = storage.saveCustomerProfile({
    ...profile,
    userName: parts.userName,
    lastSeenAt: new Date().toISOString()
  });

  const replyPayload = await generateAgentReply({
    channel: "whatsapp",
    userId: parts.userId,
    userName: parts.userName,
    messageText: parts.messageText,
    conversationHistory: history,
    venueData,
    customerProfile: profile
  });
  const detectedCategory = replyPayload.detectedCategory || "general";

  const userMessagePromise = storage.saveConversationMessage("whatsapp", parts.userId, "user", parts.messageText, detectedCategory);
  const assistantMessagePromise = storage.saveConversationMessage("whatsapp", parts.userId, "assistant", replyPayload.reply, detectedCategory);

  if (replyPayload.leadCaptured || detectLeadIntent(parts.messageText)) {
    ctx?.waitUntil(
      storage.saveLead({
        channel: "whatsapp",
        userId: parts.userId,
        userName: parts.userName,
        message: parts.messageText,
        detectedIntent: replyPayload.detectedIntent,
        category: detectedCategory,
        timestamp: new Date().toISOString()
      })
    );
  }

  ctx?.waitUntil(profilePromise);
  ctx?.waitUntil(userMessagePromise);
  ctx?.waitUntil(assistantMessagePromise);

  const sendResult = await sendWhatsAppMessage(env, parts.phoneNumber, replyPayload.reply);

  return new Response(
    JSON.stringify({
      ok: true,
      sent: Boolean(sendResult.sent !== false),
      reply: replyPayload.reply,
      configured: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID)
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}
