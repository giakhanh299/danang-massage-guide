import { createMemoryStorage, DEFAULT_FAQ, DEFAULT_PROMPT_RULES } from "./memory.js";

function hasGoogleSheetsConfig(env) {
  return Boolean(env?.GOOGLE_SERVICE_ACCOUNT_JSON && env?.GOOGLE_SHEET_ID);
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function encodeUtf8(value) {
  return new TextEncoder().encode(value);
}

function decodeUtf8(buffer) {
  return new TextDecoder().decode(buffer);
}

function parseServiceAccount(rawJson) {
  const account = JSON.parse(rawJson);
  if (account.private_key) {
    account.private_key = account.private_key.replaceAll("\\n", "\n");
  }
  return account;
}

function rowsToObjects(rows) {
  if (!rows.length) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => String(header || "").trim());

  return dataRows
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        if (!header) {
          return;
        }
        record[header] = row[index] ?? "";
      });
      return record;
    });
}

async function importPrivateKey(pem) {
  const keyBody = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(keyBody), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    raw.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
}

async function signJwt({ clientEmail, privateKey, scope }) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsignedToken = `${base64UrlEncode(encodeUtf8(JSON.stringify(header)))}.${base64UrlEncode(encodeUtf8(JSON.stringify(claimSet)))}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encodeUtf8(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getAccessToken(env) {
  const account = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const assertion = await signJwt({
    clientEmail: account.client_email,
    privateKey: account.private_key,
    scope: "https://www.googleapis.com/auth/spreadsheets"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

class GoogleSheetsStorage {
  constructor(env) {
    this.env = env;
    this.sheetId = env.GOOGLE_SHEET_ID;
    this.account = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    this.tokenCache = null;
  }

  async accessToken() {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - 60000 > now) {
      return this.tokenCache.token;
    }

    const token = await getAccessToken(this.env);
    this.tokenCache = {
      token,
      expiresAt: now + 55 * 60 * 1000
    };
    return token;
  }

  async sheetsFetch(path, options = {}) {
    const token = await this.accessToken();
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API error ${response.status} for ${path}`);
    }

    return response;
  }

  async readTab(tabName) {
    const response = await this.sheetsFetch(`/values/${encodeURIComponent(tabName)}!A:Z`);
    const payload = await response.json();
    return rowsToObjects(payload.values || []);
  }

  async appendTab(tabName, values) {
    const response = await this.sheetsFetch(`/values/${encodeURIComponent(tabName)}!A:Z:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({
        values: [values]
      })
    });

    return response.json();
  }

  async getCustomerProfile(userId, channel) {
    const rows = await this.readTab("customers");
    const matches = rows.filter((row) => String(row.userId || row.userid || "") === String(userId) && String(row.channel || "") === channel);
    if (!matches.length) {
      return null;
    }

    const latest = matches[matches.length - 1];
    return {
      userId,
      channel,
      userName: latest.userName || latest.username || "",
      areaPreference: latest.areaPreference || latest.area || "",
      language: latest.language || "en",
      notes: latest.notes || "",
      firstSeenAt: latest.firstSeenAt || "",
      lastSeenAt: latest.lastSeenAt || ""
    };
  }

  async saveCustomerProfile(profile) {
    const row = [
      profile.userId || "",
      profile.channel || "",
      profile.userName || "",
      profile.areaPreference || "",
      profile.language || "en",
      profile.notes || "",
      profile.firstSeenAt || new Date().toISOString(),
      profile.lastSeenAt || new Date().toISOString()
    ];
    await this.appendTab("customers", row);
    return profile;
  }

  async saveConversationMessage(channel, userId, role, text) {
    const record = {
      timestamp: new Date().toISOString(),
      channel,
      userId,
      role,
      text
    };
    await this.appendTab("conversations", [record.timestamp, channel, userId, role, text]);
    return record;
  }

  async getConversationHistory(channel, userId, limit = 12) {
    const rows = await this.readTab("conversations");
    return rows
      .filter((row) => String(row.channel || "") === channel && String(row.userId || "") === String(userId))
      .slice(-limit)
      .map((row) => ({
        role: row.role || "user",
        text: row.text || "",
        timestamp: row.timestamp || ""
      }));
  }

  async saveLead(lead) {
    const record = {
      ...lead,
      timestamp: lead.timestamp || new Date().toISOString()
    };
    await this.appendTab("leads", [
      record.timestamp,
      record.channel || "",
      record.userId || "",
      record.userName || "",
      record.message || "",
      record.detectedIntent || "",
      record.page || "",
      record.status || "new"
    ]);
    return record;
  }

  async saveBookingRequest(request) {
    const record = {
      ...request,
      timestamp: request.timestamp || new Date().toISOString()
    };
    await this.appendTab("booking_requests", [
      record.timestamp,
      record.channel || "",
      record.userId || "",
      record.userName || "",
      record.message || "",
      record.requestedService || "",
      record.requestedArea || "",
      record.requestedTime || "",
      record.notes || "",
      record.status || "new"
    ]);
    return record;
  }

  async getFAQ() {
    try {
      const rows = await this.readTab("faq");
      const parsed = rows
        .map((row) => ({
          question: row.question || row.Question || "",
          answer: row.answer || row.Answer || "",
          category: row.category || row.Category || "",
          sortOrder: Number(row.sortOrder || row.sortorder || 0)
        }))
        .filter((row) => row.question && row.answer);

      return parsed.length ? parsed : DEFAULT_FAQ;
    } catch (error) {
      return DEFAULT_FAQ;
    }
  }

  async getPromptRules() {
    try {
      const rows = await this.readTab("prompt_rules");
      const parsed = rows
        .map((row) => {
          const enabled = String(row.enabled || row.Enabled || "true").toLowerCase() !== "false";
          return {
            key: row.key || row.Key || "",
            value: row.value || row.Value || "",
            enabled
          };
        })
        .filter((row) => row.value && row.enabled)
        .map((row) => row.value);

      return parsed.length ? parsed : DEFAULT_PROMPT_RULES;
    } catch (error) {
      return DEFAULT_PROMPT_RULES;
    }
  }
}

class ResilientStorage {
  constructor(remote, fallback) {
    this.remote = remote;
    this.fallback = fallback;
  }

  async call(method, ...args) {
    try {
      return await this.remote[method](...args);
    } catch (error) {
      return this.fallback[method](...args);
    }
  }

  getCustomerProfile(...args) {
    return this.call("getCustomerProfile", ...args);
  }

  saveCustomerProfile(...args) {
    return this.call("saveCustomerProfile", ...args);
  }

  saveConversationMessage(...args) {
    return this.call("saveConversationMessage", ...args);
  }

  getConversationHistory(...args) {
    return this.call("getConversationHistory", ...args);
  }

  saveLead(...args) {
    return this.call("saveLead", ...args);
  }

  saveBookingRequest(...args) {
    return this.call("saveBookingRequest", ...args);
  }

  getFAQ(...args) {
    return this.call("getFAQ", ...args);
  }

  getPromptRules(...args) {
    return this.call("getPromptRules", ...args);
  }
}

export function createStorage(env) {
  if (!hasGoogleSheetsConfig(env)) {
    return createMemoryStorage();
  }

  return new ResilientStorage(new GoogleSheetsStorage(env), createMemoryStorage());
}

export { GoogleSheetsStorage, hasGoogleSheetsConfig };
