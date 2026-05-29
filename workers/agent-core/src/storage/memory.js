const DEFAULT_FAQ = [
  {
    question: "Which area is best for massage in Da Nang?",
    answer: "My Khe Beach and An Thuong are popular for beach stays, while Han River and Hai Chau work well for city plans."
  },
  {
    question: "Can tourists book by WhatsApp or Telegram?",
    answer: "Yes. The guide is designed around Telegram and WhatsApp booking support."
  },
  {
    question: "Should I verify prices before visiting?",
    answer: "Yes. Always confirm the latest price, hours, and availability with the venue or Google Maps."
  }
];

const DEFAULT_PROMPT_RULES = [
  "Use venue data first.",
  "Keep replies short and tourist-friendly.",
  "Never invent exact prices, availability, or opening hours.",
  "No adult or sexual wording.",
  "Always include Telegram, WhatsApp, and website next steps."
];

function buildTopQuestions(faqRows, limit = 5) {
  return faqRows
    .slice(0, limit)
    .map((row) => ({
      question: row.question,
      answer: row.answer,
      category: row.category || "general"
    }));
}

function buildTopCategories(leads, limit = 5) {
  const counts = new Map();

  for (const lead of leads) {
    const key = String(lead.category || lead.detectedIntent || "general");
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, count]) => ({ category, count }));
}

function buildAdminStats(customers, leads, bookingRequests, faq) {
  const customerCount = typeof customers?.size === "number"
    ? customers.size
    : Array.isArray(customers)
      ? customers.length
      : Number(customers || 0);
  const leadCount = Array.isArray(leads) ? leads.length : Number(leads || 0);
  const bookingCount = Array.isArray(bookingRequests) ? bookingRequests.length : Number(bookingRequests || 0);

  return {
    total_customers: customerCount,
    total_leads: leadCount,
    total_bookings: bookingCount,
    top_questions: buildTopQuestions(faq),
    top_categories: buildTopCategories(leads)
  };
}

export class MemoryStorage {
  constructor() {
    this.customers = new Map();
    this.conversations = [];
    this.leads = [];
    this.bookingRequests = [];
    this.faq = [...DEFAULT_FAQ];
    this.promptRules = [...DEFAULT_PROMPT_RULES];
  }

  customerKey(userId, channel) {
    return `${channel}:${userId}`;
  }

  async getCustomerProfile(userId, channel) {
    return this.customers.get(this.customerKey(userId, channel)) || null;
  }

  async saveCustomerProfile(profile) {
    const key = this.customerKey(profile.userId, profile.channel);
    const previous = this.customers.get(key) || {};
    const next = {
      ...previous,
      ...profile,
      lastSeenAt: profile.lastSeenAt || new Date().toISOString()
    };
    this.customers.set(key, next);
    return next;
  }

  async saveConversationMessage(channel, userId, role, text, category = "") {
    const record = {
      timestamp: new Date().toISOString(),
      channel,
      userId,
      role,
      text,
      category
    };
    this.conversations.push(record);
    return record;
  }

  async getConversationHistory(channel, userId, limit = 12) {
    return this.conversations
      .filter((entry) => entry.channel === channel && entry.userId === userId)
      .slice(-limit)
      .map((entry) => ({ role: entry.role, text: entry.text, timestamp: entry.timestamp, category: entry.category || "" }));
  }

  async saveLead(lead) {
    const record = { ...lead, timestamp: lead.timestamp || new Date().toISOString() };
    this.leads.push(record);
    return record;
  }

  async saveBookingRequest(request) {
    const record = { ...request, timestamp: request.timestamp || new Date().toISOString() };
    this.bookingRequests.push(record);
    return record;
  }

  async getFAQ() {
    return [...this.faq];
  }

  async getPromptRules() {
    return [...this.promptRules];
  }

  async getVenueCatalog() {
    return null;
  }

  async getRecentLeads(limit = 10) {
    return [...this.leads].slice(-limit).reverse();
  }

  async getRecentBookings(limit = 10) {
    return [...this.bookingRequests].slice(-limit).reverse();
  }

  async getAdminStats() {
    return buildAdminStats(this.customers, this.leads, this.bookingRequests, this.faq);
  }
}

export function createMemoryStorage() {
  return new MemoryStorage();
}

export { DEFAULT_FAQ, DEFAULT_PROMPT_RULES, buildAdminStats };
