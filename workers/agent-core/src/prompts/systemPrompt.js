function formatVenueLines(venues) {
  return venues
    .map((venue) => {
      const parts = [
        venue.name,
        venue.area ? `area: ${venue.area}` : null,
        venue.type ? `type: ${venue.type}` : null,
        venue.priceRange ? `price: ${venue.priceRange}` : null,
        venue.rating ? `rating: ${venue.rating}` : null,
        venue.reviewCount ? `reviews: ${venue.reviewCount}` : null,
        venue.openingHours ? `hours: ${venue.openingHours}` : null,
        venue.website ? `website: ${venue.website}` : null,
        venue.phone ? `phone: ${venue.phone}` : null,
        venue.description ? `notes: ${venue.description}` : null
      ].filter(Boolean);

      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSystemPrompt({
  channel,
  customerProfile = null,
  faq = [],
  promptRules = [],
  venueMatches = [],
  categoryHint = "general"
}) {
  const profileLines = customerProfile
    ? formatList([
        `userId: ${customerProfile.userId || "unknown"}`,
        `channel: ${channel}`,
        `name: ${customerProfile.userName || "unknown"}`,
        `area preference: ${customerProfile.areaPreference || "unknown"}`
      ])
    : "- no saved customer profile";

  const faqLines = faq.length
    ? faq.map((item) => `- Q: ${item.question} A: ${item.answer}`).join("\n")
    : "- no FAQ rows loaded";

  const rulesLines = promptRules.length ? formatList(promptRules) : "- no extra prompt rules loaded";

  return [
    "You are Da Nang Insider AI Concierge.",
    "Tone: tourist-friendly, helpful, concise, and practical.",
    "Focus topics: massage, spa, massage at home, karaoke, bars, seafood, nightlife, and local tips in Da Nang.",
    "Use venue data first.",
    "Do not invent exact prices, availability, or opening hours.",
    "If you mention any venue details, advise the user to verify with the venue or Google Maps before visiting.",
    "Never use adult or sexual service wording.",
    "Keep replies short. Recommend at most 3 options.",
    "Each recommendation should include area and a clear reason.",
    "Always include a next step with Telegram, WhatsApp, and website options.",
    "Return only valid JSON with keys: reply, suggestedActions, detectedIntent, leadCaptured, leadReason.",
    "Suggested actions must be an array of objects with label and url.",
    `Conversation channel: ${channel}`,
    `Category hint: ${categoryHint}`,
    "Saved customer profile:",
    profileLines,
    "Loaded FAQ guidance:",
    faqLines,
    "Loaded prompt rules:",
    rulesLines,
    "Relevant venue data:",
    venueMatches.length ? formatVenueLines(venueMatches) : "- no venue matches found"
  ].join("\n");
}
