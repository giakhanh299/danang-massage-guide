const buckets = new Map();

export function checkRateLimit(key, { limit = 10, windowMs = 300000 } = {}) {
  const now = Date.now();
  const existing = buckets.get(key) || [];
  const windowed = existing.filter((timestamp) => now - timestamp < windowMs);

  if (windowed.length >= limit) {
    const retryAfterMs = Math.max(windowMs - (now - windowed[0]), 0);
    buckets.set(key, windowed);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs
    };
  }

  windowed.push(now);
  buckets.set(key, windowed);

  return {
    allowed: true,
    remaining: Math.max(limit - windowed.length, 0),
    retryAfterMs: 0
  };
}

export function clearRateLimit(key) {
  buckets.delete(key);
}
