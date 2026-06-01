type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true as const, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false as const, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { allowed: true as const, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function getRequestRateLimitKey(ip: string | null, sessionId: string | null) {
  const normalizedIp = ip?.trim() || "unknown-ip";
  const normalizedSession = sessionId?.trim() || "";

  return normalizedSession ? `${normalizedIp}:${normalizedSession}` : normalizedIp;
}

