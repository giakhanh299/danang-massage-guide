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
import { generateAgentReply, detectLeadIntent, detectIntent } from './workers/agent-core/src/agent.js';
import { createMemoryStorage } from './workers/agent-core/src/storage/memory.js';
import { checkRateLimit } from './workers/agent-core/src/utils/rateLimit.js';

const originalFetch = globalThis.fetch;
const telegramCalls = [];

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('api.telegram.org')) {
    telegramCalls.push({ url: target, body: options.body ? JSON.parse(options.body) : null });
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return originalFetch(url, options);
};

const reply = await generateAgentReply({
  channel: 'telegram',
  userId: 'u1',
  userName: 'Alex',
  messageText: 'Need massage near My Khe tonight',
  conversationHistory: [],
  customerProfile: { userId: 'u1', channel: 'telegram', userName: 'Alex' }
});

assert.ok(reply.reply.includes('For quick help'));
assert.ok(reply.suggestedActions.length >= 3);
assert.equal(detectLeadIntent('Need a hotel massage tonight'), true);
assert.equal(detectIntent('Need seafood and beer'), 'seafood_beer');

for (let i = 0; i < 10; i += 1) {
  const result = checkRateLimit('telegram:u1', { limit: 10, windowMs: 300000 });
  assert.equal(result.allowed, true);
}
assert.equal(checkRateLimit('telegram:u1', { limit: 10, windowMs: 300000 }).allowed, false);

const healthResponse = await worker.fetch(new Request('https://example.com/health'), {
  method: 'GET'
}, {
  waitUntil: () => {}
});
assert.equal(healthResponse.status, 200);
const healthJson = await healthResponse.json();
assert.deepEqual(healthJson, { status: 'ok' });

const adminResponse = await worker.fetch(new Request('https://example.com/admin/stats?token=secret', {
  method: 'GET'
}), {
  ADMIN_DASHBOARD_TOKEN: 'secret'
}, {
  waitUntil: () => {}
});
assert.equal(adminResponse.status, 200);
const adminJson = await adminResponse.json();
assert.equal(adminJson.total_customers, 0);

const telegramWebhookBody = {
  update_id: 1,
  message: {
    message_id: 2,
    text: '/help',
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
  TELEGRAM_ADMIN_IDS: '99999',
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-5.2',
  SITE_URL: 'https://danang-massage-guide.pages.dev/',
  TELEGRAM_GROUP_URL: 'https://t.me/danangmassagebooking',
  WHATSAPP_SUPPORT_URL: 'https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3'
}, {
  waitUntil: () => {}
});

assert.equal(webhookResponse.status, 200);
assert.ok(telegramCalls.length >= 1);

const memory = createMemoryStorage();
await memory.saveCustomerProfile({ userId: 'u1', channel: 'telegram', userName: 'Alex' });
await memory.saveLead({ channel: 'telegram', userId: 'u1', userName: 'Alex', message: 'Need massage tonight', detectedIntent: 'booking' });
await memory.saveBookingRequest({ channel: 'telegram', userId: 'u1', userName: 'Alex', message: 'Need massage tonight', requestedService: 'massage', requestedArea: 'My Khe' });
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
