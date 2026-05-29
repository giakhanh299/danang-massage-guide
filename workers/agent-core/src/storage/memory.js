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

  async saveConversationMessage(channel, userId, role, text) {
    const record = {
      timestamp: new Date().toISOString(),
      channel,
      userId,
      role,
      text
    };
    this.conversations.push(record);
    return record;
  }

  async getConversationHistory(channel, userId, limit = 12) {
    return this.conversations
      .filter((entry) => entry.channel === channel && entry.userId === userId)
      .slice(-limit)
      .map((entry) => ({ role: entry.role, text: entry.text, timestamp: entry.timestamp }));
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
}

export function createMemoryStorage() {
  return new MemoryStorage();
}

export { DEFAULT_FAQ, DEFAULT_PROMPT_RULES };
