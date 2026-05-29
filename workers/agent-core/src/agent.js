import { VENUE_DATA } from "./data/venues.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";

const TELEGRAM_GROUP_URL = "https://t.me/danangmassagebooking";
const WHATSAPP_SUPPORT_URL = "https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3";

const DEFAULT_SITE_URL = "https://danang-massage-guide.pages.dev/";

const CATEGORY_HINTS = [
  {
    key: "massage_at_home",
    patterns: ["massage at home", "hotel massage", "apartment massage", "villa massage", "airbnb massage", "home massage"]
  },
  {
    key: "massage_spa",
    patterns: ["massage", "spa", "foot massage", "body massage", "deep tissue", "hot stone", "near me", "price", "available now"]
  },
  {
    key: "karaoke",
    patterns: ["karaoke", "music box", "singing room"]
  },
  {
    key: "bars_clubs",
    patterns: ["bar", "bars", "club", "clubs", "nightlife", "cocktail", "drinks"]
  },
  {
    key: "seafood_beer",
    patterns: ["seafood", "beer", "dinner", "restaurant", "food"]
  }
];

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

export function configureAgentCore(env = {}, extras = {}) {
  globalThis.__AGENT_CORE_ENV = {
    OPENAI_API_KEY: env.OPENAI_API_KEY || "",
    OPENAI_MODEL: env.OPENAI_MODEL || "gpt-5.2",
    SITE_URL: env.SITE_URL || DEFAULT_SITE_URL,
    TELEGRAM_GROUP_URL: env.TELEGRAM_GROUP_URL || TELEGRAM_GROUP_URL,
    WHATSAPP_SUPPORT_URL: env.WHATSAPP_SUPPORT_URL || WHATSAPP_SUPPORT_URL,
    FAQ: Array.isArray(extras.faq) ? extras.faq : [],
    PROMPT_RULES: Array.isArray(extras.promptRules) ? extras.promptRules : []
  };
}

function getAgentEnv() {
  return globalThis.__AGENT_CORE_ENV || {
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "gpt-5.2",
    SITE_URL: DEFAULT_SITE_URL,
    TELEGRAM_GROUP_URL,
    WHATSAPP_SUPPORT_URL,
    FAQ: [],
    PROMPT_RULES: []
  };
}

export function detectIntent(messageText) {
  const text = normalizeText(messageText);
  const matched = CATEGORY_HINTS.find((entry) => entry.patterns.some((pattern) => text.includes(pattern)));
  if (!matched) {
    if (text.includes("book") || text.includes("reservation") || text.includes("massage tonight")) {
      return "booking";
    }
    return "general";
  }

  return matched.key;
}

export function detectLeadIntent(messageText) {
  const text = normalizeText(messageText);
  return /book|reservation|massage tonight|hotel massage|near me|price|available now/.test(text);
}

function getCategoryVenues(category, venueData = VENUE_DATA) {
  if (category === "massage_at_home") {
    return [venueData.massageAtHome];
  }

  if (category === "massage_spa") {
    return venueData.massageSpas;
  }

  if (category === "karaoke") {
    return venueData.karaoke;
  }

  if (category === "bars_clubs") {
    return venueData.barsClubs;
  }

  if (category === "seafood_beer") {
    return venueData.seafoodBeer;
  }

  return [
    ...venueData.massageSpas,
    ...venueData.karaoke,
    ...venueData.barsClubs,
    ...venueData.seafoodBeer
  ];
}

export function getVenueMatches(messageText, venueData = VENUE_DATA, limit = 3) {
  const category = detectIntent(messageText);
  const selected = getCategoryVenues(category, venueData);

  if (category === "massage_at_home") {
    return [venueData.massageAtHome];
  }

  return selected.slice(0, limit);
}

function venueToLine(venue) {
  if (!venue) {
    return "";
  }

  const reason = venue.description || venue.notes || "A practical visitor option.";
  const area = venue.area ? `Area: ${venue.area}` : "Area: Da Nang";
  return `${venue.name} | ${area} | ${reason}`;
}

function buildFallbackReply({ venueMatches, messageText, customerProfile }) {
  const intent = detectIntent(messageText);
  const introMap = {
    massage_at_home: "Here are mobile options to ask about:",
    karaoke: "Here are karaoke options to compare:",
    bars_clubs: "Here are nightlife options to check:",
    seafood_beer: "Here are seafood and beer options to try:",
    booking: "I can help with booking support. Start with these options:",
    general: "Here are the best local options to start with:",
    massage_spa: "Here are the best massage and spa options to start with:"
  };

  const lines = venueMatches.slice(0, 3).map((venue, index) => `${index + 1}. ${venueToLine(venue)}`);
  const profileHint = customerProfile?.areaPreference ? `\nPreferred area noted: ${customerProfile.areaPreference}.` : "";

  return [
    introMap[intent] || introMap.general,
    ...lines,
    profileHint,
    `For quick help, join: ${TELEGRAM_GROUP_URL}`,
    `Booking support: ${WHATSAPP_SUPPORT_URL}`,
    `View website: ${getAgentEnv().SITE_URL}`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSuggestedActions(siteUrl = DEFAULT_SITE_URL) {
  const env = getAgentEnv();
  return [
    { label: "Join Telegram Group", url: env.TELEGRAM_GROUP_URL },
    { label: "Book via WhatsApp", url: env.WHATSAPP_SUPPORT_URL },
    { label: "View Website", url: siteUrl || env.SITE_URL }
  ];
}

function appendCallToActionLines(reply, siteUrl = DEFAULT_SITE_URL) {
  const env = getAgentEnv();
  const lines = [];

  if (!reply.includes(env.TELEGRAM_GROUP_URL)) {
    lines.push(`For quick help, join: ${env.TELEGRAM_GROUP_URL}`);
  }

  if (!reply.includes(env.WHATSAPP_SUPPORT_URL)) {
    lines.push(`Booking support: ${env.WHATSAPP_SUPPORT_URL}`);
  }

  if (!reply.includes(env.SITE_URL)) {
    lines.push(`View website: ${siteUrl || env.SITE_URL}`);
  }

  return lines.length ? `${reply.trim()}\n\n${lines.join("\n")}` : reply.trim();
}

function extractJsonPayload(text) {
  if (!text) {
    return null;
  }

  const trimmed = String(text).trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    return null;
  }
}

async function callOpenAI({ systemPrompt, userPrompt }) {
  const env = getAgentEnv();
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      instructions: systemPrompt,
      input: userPrompt
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  return response.json();
}

function extractOpenAIText(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === "string") {
        return part.text;
      }
    }
  }

  return "";
}

function buildUserPrompt({
  channel,
  userId,
  userName,
  messageText,
  conversationHistory,
  customerProfile,
  venueMatches,
  categoryHint
}) {
  return JSON.stringify(
    {
      channel,
      userId,
      userName,
      messageText,
      categoryHint,
      customerProfile,
      conversationHistory,
      venueMatches,
      responseRequirements: {
        reply: "Short answer, max 3 recommendations, include area and reason, include next step CTA lines.",
        suggestedActions: [
          { label: "Join Telegram Group", url: TELEGRAM_GROUP_URL },
          { label: "Book via WhatsApp", url: WHATSAPP_SUPPORT_URL },
          { label: "View Website", url: getAgentEnv().SITE_URL }
        ]
      }
    },
    null,
    2
  );
}

export async function generateAgentReply({
  channel,
  userId,
  userName,
  messageText,
  conversationHistory = [],
  venueData = VENUE_DATA,
  customerProfile = null
}) {
  const categoryHint = detectIntent(messageText);
  const leadIntent = detectLeadIntent(messageText);
  const venueMatches = getVenueMatches(messageText, venueData, 3);

  const systemPrompt = buildSystemPrompt({
    channel,
    customerProfile,
    faq: getAgentEnv().FAQ || [],
    promptRules: getAgentEnv().PROMPT_RULES || [],
    venueMatches,
    categoryHint
  });

  const userPrompt = buildUserPrompt({
    channel,
    userId,
    userName,
    messageText,
    conversationHistory,
    customerProfile,
    venueMatches,
    categoryHint
  });

  let modelPayload = null;
  try {
    modelPayload = await callOpenAI({ systemPrompt, userPrompt });
  } catch (error) {
    modelPayload = null;
  }

  const parsed = extractJsonPayload(extractOpenAIText(modelPayload));
  const fallbackReply = buildFallbackReply({ venueMatches, messageText, customerProfile });

  const reply = appendCallToActionLines(parsed?.reply || fallbackReply, getAgentEnv().SITE_URL);
  const suggestedActions = Array.isArray(parsed?.suggestedActions) && parsed.suggestedActions.length
    ? parsed.suggestedActions.slice(0, 3)
    : buildSuggestedActions(getAgentEnv().SITE_URL);

  return {
    reply,
    suggestedActions,
    detectedIntent: parsed?.detectedIntent || (leadIntent ? "booking" : categoryHint),
    leadCaptured: Boolean(parsed?.leadCaptured || leadIntent || categoryHint === "booking"),
    leadReason: parsed?.leadReason || (leadIntent ? "keyword_match" : ""),
    venueMatches
  };
}
