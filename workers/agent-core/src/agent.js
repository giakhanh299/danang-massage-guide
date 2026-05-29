import { VENUE_DATA } from "./data/venues.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";

const TELEGRAM_GROUP_URL = "https://t.me/danangmassagebooking";
const WHATSAPP_SUPPORT_URL = "https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3";

const DEFAULT_SITE_URL = "https://danang-massage-guide.pages.dev/";

const CATEGORY_TO_LEAD_CATEGORY = {
  massage_spa: "massage",
  massage_at_home: "massage",
  seafood_beer: "seafood",
  karaoke: "karaoke",
  bars_clubs: "bars"
};

const TOURIST_INTENT_KEYWORDS = [
  "tourist",
  "tourists",
  "visitor",
  "visitors",
  "hotel",
  "apartments",
  "apartment",
  "villa",
  "airbnb",
  "couple",
  "couples",
  "family",
  "families",
  "beach",
  "near me",
  "city center",
  "nightlife",
  "night club",
  "disco",
  "karaoke",
  "seafood"
];

const POPULAR_AREA_KEYWORDS = [
  "my khe",
  "an thuong",
  "son tra",
  "hai chau",
  "han river",
  "city center",
  "ngu hanh son",
  "cam le",
  "bach dang"
];

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return !["false", "0", "no", "off"].includes(String(value).trim().toLowerCase());
}

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

function normalizeReviewCount(reviewCount) {
  const numeric = Number(String(reviewCount || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeIntentHint(intentHint) {
  const hint = normalizeText(intentHint);
  if (hint === "/start" || hint === "start") {
    return "start";
  }
  if (hint === "/help" || hint === "help") {
    return "help";
  }
  if (hint === "/massage" || hint === "massage") {
    return "massage";
  }
  if (hint === "massage at home" || hint === "/massage-at-home") {
    return "massage at home";
  }
  if (hint === "/seafood" || hint === "seafood") {
    return "seafood";
  }
  if (hint === "/karaoke" || hint === "karaoke") {
    return "karaoke";
  }
  if (hint === "/bars" || hint === "bars") {
    return "bars";
  }
  if (hint === "clubs" || hint === "nightlife") {
    return hint;
  }
  if (hint === "/book" || hint === "booking" || hint === "book") {
    return "booking";
  }
  return "";
}

function normalizeVenueCategory(venue = {}) {
  const value = normalizeText(venue.category || venue.type || "");
  if (value.includes("massage at home") || value.includes("home")) {
    return "massage_at_home";
  }
  if (value.includes("massage") || value.includes("spa")) {
    return "massage_spa";
  }
  if (value.includes("karaoke") || value.includes("music box")) {
    return "karaoke";
  }
  if (value.includes("seafood")) {
    return "seafood_beer";
  }
  if (value.includes("bar") || value.includes("club") || value.includes("night")) {
    return "bars_clubs";
  }
  return value || "general";
}

function getLeadCategory(intent, messageText) {
  const text = normalizeText(messageText);
  if (intent === "bars_clubs") {
    return text.includes("nightlife") || text.includes("night club") || text.includes("disco") ? "nightlife" : "bars";
  }

  return CATEGORY_TO_LEAD_CATEGORY[intent] || "general";
}

function detectSimpleIntent(messageText, intentHint = "") {
  const hint = normalizeIntentHint(intentHint);
  if (hint) {
    return hint;
  }

  const text = normalizeText(messageText);

  if (text.startsWith("/start")) {
    return "start";
  }

  if (text.startsWith("/help")) {
    return "help";
  }

  if (/(book|booking|reservation)/.test(text)) {
    return "booking";
  }

  if (text.includes("massage at home") || text.includes("hotel massage") || text.includes("apartment massage") || text.includes("villa massage") || text.includes("airbnb massage") || text.includes("home massage")) {
    return "massage at home";
  }

  if (text.includes("massage") || text.includes("spa") || text.includes("foot massage") || text.includes("body massage") || text.includes("deep tissue") || text.includes("hot stone")) {
    return "massage";
  }

  if (text.includes("seafood") || text.includes("fish") || text.includes("beer")) {
    return "seafood";
  }

  if (text.includes("karaoke") || text.includes("music box") || text.includes("singing room")) {
    return "karaoke";
  }

  if (text.includes("nightlife") || text.includes("night club") || text.includes("disco")) {
    return "nightlife";
  }

  if (text.includes("bars") || text.includes("bar") || text.includes("cocktail") || text.includes("drinks")) {
    return "bars";
  }

  if (text.includes("clubs") || text.includes("club")) {
    return "clubs";
  }

  return "";
}

function hasComparisonSignals(text) {
  const normalised = normalizeText(text);
  return [
    " compare ",
    "compare",
    " vs ",
    " vs.",
    " versus ",
    " between ",
    " which is better ",
    " better ",
    " choose between ",
    " compare with "
  ].some((token) => normalised.includes(token.trim()));
}

function hasDetailedPreferenceSignals(text) {
  const normalised = normalizeText(text);
  const signals = [
    "quiet",
    "private room",
    "private rooms",
    "cheap",
    "budget",
    "premium",
    "couples",
    "couple",
    "tourists",
    "tourist",
    "korean",
    "family",
    "families",
    "late night",
    "close to",
    "near",
    "best value",
    "luxury",
    "romantic"
  ];
  const matches = signals.filter((signal) => normalised.includes(signal));
  return matches.length >= 3;
}

function shouldUseOpenAIForMessage(messageText, simpleIntent) {
  const env = getAgentEnv();
  const useOpenAI = parseBoolean(env.USE_OPENAI, true);
  if (!useOpenAI) {
    return false;
  }

  const comparisonCue = hasComparisonSignals(messageText);
  const detailedCue = hasDetailedPreferenceSignals(messageText);
  const openAIComplexOnly = parseBoolean(env.OPENAI_COMPLEX_ONLY, true);

  if (comparisonCue) {
    return true;
  }

  if (simpleIntent) {
    return false;
  }

  if (openAIComplexOnly) {
    return detailedCue || !simpleIntent;
  }

  return true;
}

function leadCategoryMatchesVenue(leadCategory, venueCategory) {
  if (leadCategory === "nightlife" || leadCategory === "bars") {
    return venueCategory === "bars_clubs";
  }

  if (leadCategory === "massage") {
    return venueCategory === "massage_spa" || venueCategory === "massage_at_home";
  }

  if (leadCategory === "seafood") {
    return venueCategory === "seafood_beer";
  }

  if (leadCategory === "karaoke") {
    return venueCategory === "karaoke";
  }

  return false;
}

function getVenueCatalogEntries(venueData = VENUE_DATA) {
  const catalog = venueData || VENUE_DATA;
  const entries = [
    ...(Array.isArray(catalog.massageSpas) ? catalog.massageSpas : []),
    ...(Array.isArray(catalog.karaoke) ? catalog.karaoke : []),
    ...(Array.isArray(catalog.barsClubs) ? catalog.barsClubs : []),
    ...(Array.isArray(catalog.seafoodBeer) ? catalog.seafoodBeer : [])
  ];

  if (catalog.massageAtHome) {
    entries.push(catalog.massageAtHome);
  }

  return entries.map((venue) => ({
    ...venue,
    category: normalizeVenueCategory(venue)
  }));
}

function hasAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferAreaMatchScore(text, venueArea, customerProfileArea) {
  const venueAreaText = normalizeText(venueArea);
  const area = normalizeText(customerProfileArea);
  let score = 0;

  if (area && venueAreaText.includes(area)) {
    score += 5;
  }

  if (!venueAreaText) {
    return score;
  }

  const areaTokens = venueAreaText
    .split(/[\/,()-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (areaTokens.some((token) => token.length >= 3 && text.includes(token))) {
    score += 4;
  }

  if (POPULAR_AREA_KEYWORDS.some((keyword) => venueAreaText.includes(keyword) && text.includes(keyword))) {
    score += 3;
  }

  return score;
}

function inferTouristIntentScore(text, venue) {
  if (!hasAnyKeyword(text, TOURIST_INTENT_KEYWORDS)) {
    return 0;
  }

  let score = 0;
  const venueArea = normalizeText(venue.area || "");
  const description = normalizeText(venue.description || "");
  const notes = normalizeText(venue.notes || "");
  const areaSignals = ["my khe", "an thuong", "son tra", "hai chau", "han river", "city center"];

  if (areaSignals.some((signal) => venueArea.includes(signal))) {
    score += 2;
  }

  if (hasAnyKeyword(description, ["tourist", "visitor", "couple", "group", "beach", "easy booking", "calm"])) {
    score += 2;
  }

  if (hasAnyKeyword(notes, ["tourist", "visitor", "couple", "group", "beach"])) {
    score += 1;
  }

  if (venue.category === "massage_at_home" && hasAnyKeyword(text, ["hotel", "apartment", "villa", "airbnb"])) {
    score += 3;
  }

  if ((venue.category === "bars_clubs" || venue.category === "karaoke" || venue.category === "seafood_beer") && hasAnyKeyword(text, ["nightlife", "night", "tourist", "couple"])) {
    score += 2;
  }

  return score;
}

function buildRecommendationReason({ venue, intent, leadCategory, text, customerProfile }) {
  const reasons = [];
  const venueArea = normalizeText(venue.area || "");
  const customerArea = normalizeText(customerProfile?.areaPreference || "");

  if (customerArea && venueArea.includes(customerArea)) {
    reasons.push(`Matches your preferred area ${customerProfile.areaPreference}`);
  } else if (POPULAR_AREA_KEYWORDS.some((keyword) => venueArea.includes(keyword) && text.includes(keyword))) {
    reasons.push(`Area match for ${venue.area}`);
  } else if (venue.area) {
    reasons.push(`Located in ${venue.area}`);
  }

  const venueCategory = venue.category || normalizeVenueCategory(venue);
  if (intent === venueCategory || (intent === "booking" && venueCategory !== "general")) {
    reasons.push("Direct category match");
  } else if (leadCategory !== "general" && leadCategoryMatchesVenue(leadCategory, venueCategory)) {
    reasons.push(`Good fit for ${leadCategory} requests`);
  }

  if (hasAnyKeyword(text, TOURIST_INTENT_KEYWORDS)) {
    reasons.push("Suited to tourist plans");
  }

  if (venue.rating) {
    reasons.push(`Strong rating ${venue.rating}`);
  }

  return reasons.slice(0, 3).join("; ") || "Practical visitor option.";
}

function scoreVenue({ venue, text, intent, leadCategory, customerProfile }) {
  const venueCategory = venue.category || normalizeVenueCategory(venue);
  let score = 0;

  score += inferAreaMatchScore(text, venue.area, customerProfile?.areaPreference);
  score += inferTouristIntentScore(text, venue);

  if (intent === venueCategory) {
    score += 8;
  }

  if (leadCategory !== "general" && leadCategoryMatchesVenue(leadCategory, venueCategory)) {
    score += 4;
  }

  if (intent === "booking" && venueCategory !== "general") {
    score += 2;
  }

  score += Math.min(Number(venue.rating || 0), 5);
  score += Math.min(normalizeReviewCount(venue.reviewCount) / 1000, 5);

  return score;
}

function rankVenues({ venueData, messageText, customerProfile, limit = 3 }) {
  const intent = detectIntent(messageText);
  const leadCategory = getLeadCategory(intent, messageText);
  const text = normalizeText(messageText);
  const venues = getVenueCatalogEntries(venueData);

  return venues
    .map((venue) => ({
      ...venue,
      reason: buildRecommendationReason({
        venue,
        intent,
        leadCategory,
        text,
        customerProfile
      }),
      score: scoreVenue({
        venue,
        text,
        intent,
        leadCategory,
        customerProfile
      })
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const ratingDiff = (Number(b.rating || 0) || 0) - (Number(a.rating || 0) || 0);
      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      return normalizeReviewCount(b.reviewCount) - normalizeReviewCount(a.reviewCount);
    })
    .slice(0, limit);
}

export function configureAgentCore(env = {}, extras = {}) {
  globalThis.__AGENT_CORE_ENV = {
    OPENAI_API_KEY: env.OPENAI_API_KEY || "",
    OPENAI_MODEL: env.OPENAI_MODEL || "gpt-5.2",
    SITE_URL: env.SITE_URL || DEFAULT_SITE_URL,
    TELEGRAM_GROUP_URL: env.TELEGRAM_GROUP_URL || TELEGRAM_GROUP_URL,
    WHATSAPP_SUPPORT_URL: env.WHATSAPP_SUPPORT_URL || WHATSAPP_SUPPORT_URL,
    USE_OPENAI: parseBoolean(env.USE_OPENAI, true),
    OPENAI_COMPLEX_ONLY: parseBoolean(env.OPENAI_COMPLEX_ONLY, true),
    DEBUG_RESPONSES: parseBoolean(env.DEBUG_RESPONSES, false),
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
    USE_OPENAI: true,
    OPENAI_COMPLEX_ONLY: true,
    DEBUG_RESPONSES: false,
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

export function getVenueMatches(messageText, venueData = VENUE_DATA, limit = 3) {
  return rankVenues({ venueData, messageText, limit });
}

function venueToLine(venue) {
  if (!venue) {
    return "";
  }

  const reason = venue.reason || venue.description || venue.notes || "A practical visitor option.";
  const area = venue.area ? `Area: ${venue.area}` : "Area: Da Nang";
  return `${venue.name} | ${area} | ${reason}`;
}

function requiresWhatsAppSupport(messageText) {
  const text = normalizeText(messageText);
  return ["book", "booking", "reservation", "tonight", "hotel massage", "massage at home"].some((keyword) => text.includes(keyword));
}

function buildCtaLines(messageText) {
  const lines = [`Need help? Join Telegram: ${TELEGRAM_GROUP_URL}`];
  if (requiresWhatsAppSupport(messageText)) {
    lines.push(`Booking support: ${WHATSAPP_SUPPORT_URL}`);
  }
  return lines;
}

function buildStaticReply({ simpleIntent, venueMatches, messageText, customerProfile }) {
  const introMap = {
    start: "I help with massage, spa, massage at home, karaoke, bars, seafood, nightlife, and local tips in Da Nang.",
    help: "Ask for massage, spa, massage at home, seafood, karaoke, bars, nightlife, or local tips.",
    massage: "Here are massage options to start with:",
    "massage at home": "Here are mobile massage options to check:",
    seafood: "Here are seafood options to try tonight:",
    karaoke: "Here are karaoke options to compare:",
    bars: "Here are bars and clubs options to check:",
    clubs: "Here are clubs options to check:",
    nightlife: "Here are nightlife options to check:",
    booking: "I can help with booking support. Here are a few options to start with:",
    general: "Here are the best local options to start with:"
  };

  const intro = introMap[simpleIntent] || introMap.general;

  if (simpleIntent === "start" || simpleIntent === "help") {
    return [intro, ...buildCtaLines(messageText)].join("\n");
  }

  const lines = venueMatches.slice(0, 3).map((venue, index) => `${index + 1}. ${venueToLine(venue)}`);
  const profileHint = customerProfile?.areaPreference ? `Preferred area noted: ${customerProfile.areaPreference}.` : "";
  const extraLine = simpleIntent === "booking" ? "Send the area and time you prefer, and I will narrow it down." : "";

  return [
    intro,
    ...lines,
    profileHint,
    extraLine,
    ...buildCtaLines(messageText)
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

function appendCallToActionLines(reply, messageText) {
  const lines = [];

  if (!reply.includes(TELEGRAM_GROUP_URL)) {
    lines.push(`Need help? Join Telegram: ${TELEGRAM_GROUP_URL}`);
  }

  if (requiresWhatsAppSupport(messageText) && !reply.includes(WHATSAPP_SUPPORT_URL)) {
    lines.push(`Booking support: ${WHATSAPP_SUPPORT_URL}`);
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
  customerProfile = null,
  intentHint = ""
}) {
  const simpleIntent = detectSimpleIntent(messageText, intentHint);
  const venueMatches = getVenueMatches(messageText, venueData, 3);
  const shouldUseOpenAI = shouldUseOpenAIForMessage(messageText, simpleIntent);
  const categoryHint = detectIntent(messageText);
  const leadIntent = detectLeadIntent(messageText);
  const leadCategory = getLeadCategory(categoryHint, messageText);

  if (!shouldUseOpenAI) {
    const staticReply = buildStaticReply({
      simpleIntent: simpleIntent || (leadIntent ? "booking" : "general"),
      venueMatches,
      messageText,
      customerProfile
    });
    const reply = appendCallToActionLines(staticReply, messageText);
    const debugSuffix = getAgentEnv().DEBUG_RESPONSES ? `\n[static]` : "";

    return {
      reply: `${reply}${debugSuffix}`,
      suggestedActions: buildSuggestedActions(getAgentEnv().SITE_URL),
      detectedIntent: simpleIntent || (leadIntent ? "booking" : categoryHint),
      detectedCategory: leadCategory,
      leadCaptured: Boolean(leadIntent || categoryHint === "booking"),
      leadReason: leadIntent ? "keyword_match" : "",
      venueMatches,
      responseSource: "static"
    };
  }

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
  if (shouldUseOpenAI) {
    try {
      modelPayload = await callOpenAI({ systemPrompt, userPrompt });
    } catch (error) {
      modelPayload = null;
    }
  }

  const parsed = extractJsonPayload(extractOpenAIText(modelPayload));
  const responseSource = shouldUseOpenAI && parsed?.reply ? "ai" : "static";
  const staticReply = buildStaticReply({
    simpleIntent: simpleIntent || (leadIntent ? "booking" : "general"),
    venueMatches,
    messageText,
    customerProfile
  });
  const replyBase = responseSource === "ai" ? parsed.reply : staticReply;
  const reply = appendCallToActionLines(replyBase, messageText);
  const suggestedActions = Array.isArray(parsed?.suggestedActions) && parsed.suggestedActions.length
    ? parsed.suggestedActions.slice(0, 3)
    : buildSuggestedActions(getAgentEnv().SITE_URL);
  const debugSuffix = getAgentEnv().DEBUG_RESPONSES ? `\n[${responseSource}]` : "";

  return {
    reply: `${reply}${debugSuffix}`,
    suggestedActions,
    detectedIntent: parsed?.detectedIntent || simpleIntent || (leadIntent ? "booking" : categoryHint),
    detectedCategory: parsed?.detectedCategory || leadCategory,
    leadCaptured: Boolean(parsed?.leadCaptured || leadIntent || categoryHint === "booking"),
    leadReason: parsed?.leadReason || (leadIntent ? "keyword_match" : ""),
    venueMatches,
    responseSource
  };
}

export { getLeadCategory, rankVenues, detectSimpleIntent, shouldUseOpenAIForMessage };
