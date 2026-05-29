from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_node(script: str) -> str:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout.strip()


def main() -> None:
    node_script = r"""
import assert from 'node:assert/strict';
import worker from './workers/agent-core/src/index.js';
import { configureAgentCore, generateAgentReply } from './workers/agent-core/src/agent.js';
import { VENUE_DATA } from './workers/agent-core/src/data/venues.js';
import { createMemoryStorage } from './workers/agent-core/src/storage/memory.js';

const originalFetch = globalThis.fetch;
let openaiCalls = 0;
const telegramCalls = [];

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('api.openai.com')) {
    openaiCalls += 1;
    const mode = globalThis.__OPENAI_TEST_MODE || 'static';
    const payload = mode === 'ai'
      ? { output_text: JSON.stringify({ reply: 'OpenAI reply', suggestedActions: [], detectedIntent: 'booking', detectedCategory: 'massage', leadCaptured: true }) }
      : { output_text: 'not-json' };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (target.includes('api.telegram.org')) {
    telegramCalls.push({ url: target, body: options.body ? JSON.parse(options.body) : null });
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return originalFetch(url, options);
};

const envDebug = {
  TELEGRAM_BOT_TOKEN: 'dummy-telegram-token',
  OPENAI_API_KEY: 'dummy-openai-key',
  OPENAI_MODEL: 'gpt-5.2',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'bot@example.com', private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----' }),
  GOOGLE_SHEET_ID: 'sheet-123',
  USE_OPENAI: 'true',
  OPENAI_COMPLEX_ONLY: 'true',
  DEBUG_RESPONSES: 'true',
  SITE_URL: 'https://danang-massage-guide.pages.dev/',
  TELEGRAM_GROUP_URL: 'https://t.me/danangmassagebooking',
  WHATSAPP_SUPPORT_URL: 'https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3'
};

const healthResponse = await worker.fetch(new Request('https://example.com/health', { method: 'GET' }), envDebug, { waitUntil: () => {} });
assert.equal(healthResponse.status, 200);
assert.deepEqual(await healthResponse.json(), { status: 'ok' });

const debugResponse = await worker.fetch(new Request('https://example.com/debug/config', { method: 'GET' }), envDebug, { waitUntil: () => {} });
assert.equal(debugResponse.status, 200);
const debugJson = await debugResponse.json();
assert.equal(debugJson.telegramConfigured, true);
assert.equal(debugJson.openaiConfigured, true);
assert.equal(debugJson.sheetsConfigured, true);

configureAgentCore({
  OPENAI_API_KEY: 'dummy-openai-key',
  OPENAI_MODEL: 'gpt-5.2',
  USE_OPENAI: 'true',
  OPENAI_COMPLEX_ONLY: 'true',
  DEBUG_RESPONSES: 'true',
  TELEGRAM_GROUP_URL: 'https://t.me/danangmassagebooking',
  WHATSAPP_SUPPORT_URL: 'https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3',
  SITE_URL: 'https://danang-massage-guide.pages.dev/'
});

globalThis.__OPENAI_TEST_MODE = 'static';
openaiCalls = 0;
const seafoodReply = await generateAgentReply({
  channel: 'telegram',
  userId: 'u1',
  userName: 'Alex',
  messageText: 'Best seafood tonight',
  conversationHistory: [],
  venueData: VENUE_DATA,
  customerProfile: { userId: 'u1', channel: 'telegram', userName: 'Alex' }
});
assert.equal(seafoodReply.responseSource, 'static');
assert.equal(openaiCalls, 0);
assert.ok(seafoodReply.reply.includes('Need help? Join Telegram'));
assert.ok(seafoodReply.reply.includes('[static]'));

openaiCalls = 0;
const massageReply = await generateAgentReply({
  channel: 'telegram',
  userId: 'u2',
  userName: 'Bella',
  messageText: 'massage near My Khe',
  conversationHistory: [],
  venueData: VENUE_DATA,
  customerProfile: { userId: 'u2', channel: 'telegram', userName: 'Bella' }
});
assert.equal(massageReply.responseSource, 'static');
assert.equal(openaiCalls, 0);

openaiCalls = 0;
const karaokeReply = await generateAgentReply({
  channel: 'telegram',
  userId: 'u3',
  userName: 'Chris',
  messageText: 'Good karaoke for Korean tourists',
  conversationHistory: [],
  venueData: VENUE_DATA,
  customerProfile: { userId: 'u3', channel: 'telegram', userName: 'Chris' }
});
assert.equal(karaokeReply.responseSource, 'static');
assert.equal(openaiCalls, 0);

globalThis.__OPENAI_TEST_MODE = 'ai';
openaiCalls = 0;
const compareReply = await generateAgentReply({
  channel: 'telegram',
  userId: 'u4',
  userName: 'Dana',
  messageText: 'Compare quiet cocktail bar vs nightclub for couples',
  conversationHistory: [],
  venueData: VENUE_DATA,
  customerProfile: { userId: 'u4', channel: 'telegram', userName: 'Dana' }
});
assert.equal(compareReply.responseSource, 'ai');
assert.ok(openaiCalls >= 1);
assert.ok(compareReply.reply.includes('OpenAI reply'));
assert.ok(compareReply.reply.includes('[ai]'));

globalThis.__OPENAI_TEST_MODE = 'ai';
openaiCalls = 0;
configureAgentCore({
  OPENAI_API_KEY: 'dummy-openai-key',
  OPENAI_MODEL: 'gpt-5.2',
  USE_OPENAI: 'false',
  OPENAI_COMPLEX_ONLY: 'true',
  DEBUG_RESPONSES: 'true'
});
const noOpenAiReply = await generateAgentReply({
  channel: 'telegram',
  userId: 'u5',
  userName: 'Eve',
  messageText: 'Compare quiet cocktail bar vs nightclub for couples',
  conversationHistory: [],
  venueData: VENUE_DATA,
  customerProfile: { userId: 'u5', channel: 'telegram', userName: 'Eve' }
});
assert.equal(noOpenAiReply.responseSource, 'static');
assert.equal(openaiCalls, 0);

configureAgentCore({
  OPENAI_API_KEY: 'dummy-openai-key',
  OPENAI_MODEL: 'gpt-5.2',
  USE_OPENAI: 'true',
  OPENAI_COMPLEX_ONLY: 'true',
  DEBUG_RESPONSES: 'true',
  TELEGRAM_GROUP_URL: 'https://t.me/danangmassagebooking',
  WHATSAPP_SUPPORT_URL: 'https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3',
  SITE_URL: 'https://danang-massage-guide.pages.dev/'
});
globalThis.__OPENAI_TEST_MODE = 'static';
telegramCalls.length = 0;
const telegramWebhookBody = {
  update_id: 1,
  message: {
    message_id: 2,
    text: '/start',
    chat: { id: 99, type: 'private' },
    from: { id: 12345, first_name: 'Alex', username: 'alex' }
  }
};
const webhookResponse = await worker.fetch(new Request('https://example.com/telegram/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(telegramWebhookBody)
}), {
  TELEGRAM_BOT_TOKEN: 'dummy-token',
  OPENAI_API_KEY: 'dummy-openai-key',
  OPENAI_MODEL: 'gpt-5.2',
  USE_OPENAI: 'true',
  OPENAI_COMPLEX_ONLY: 'true',
  DEBUG_RESPONSES: 'true',
  SITE_URL: 'https://danang-massage-guide.pages.dev/',
  TELEGRAM_GROUP_URL: 'https://t.me/danangmassagebooking',
  WHATSAPP_SUPPORT_URL: 'https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3'
}, {
  waitUntil: () => {}
});

assert.equal(webhookResponse.status, 200);
assert.ok(telegramCalls.length >= 1);
assert.ok(String(telegramCalls[0].body.text).includes('Need help? Join Telegram'));

const memory = createMemoryStorage();
await memory.saveCustomerProfile({ userId: 'u1', channel: 'telegram', userName: 'Alex' });
await memory.saveConversationMessage('telegram', 'u1', 'user', 'Best seafood tonight', 'seafood');
await memory.saveLead({ channel: 'telegram', userId: 'u1', userName: 'Alex', message: 'Need massage tonight', detectedIntent: 'booking', category: 'massage' });
await memory.saveBookingRequest({ channel: 'telegram', userId: 'u1', userName: 'Alex', message: 'Need massage tonight', requestedService: 'massage', requestedArea: 'My Khe', category: 'massage' });
const stats = await memory.getAdminStats();
assert.equal(stats.total_customers, 1);
assert.equal(stats.total_leads, 1);
assert.equal(stats.total_bookings, 1);

console.log('agent core validation passed');
"""

    output = run_node(node_script)
    print(output)


if __name__ == "__main__":
    main()
