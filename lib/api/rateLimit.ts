import { Redis } from '@upstash/redis/cloudflare';
import { NextRequest, NextResponse } from 'next/server';

type RateLimitRule = {
  name: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  count: number;
  resetAt: number;
  backend: 'redis' | 'memory';
};

declare global {
  // Development fallback only. Production should configure Upstash Redis.
  // eslint-disable-next-line no-var
  var __myuniRateLimitBuckets: Map<string, Bucket> | undefined;
  // eslint-disable-next-line no-var
  var __myuniRateLimitLastSweep: number | undefined;
  // eslint-disable-next-line no-var
  var __myuniRateLimitRedisWarningShown: boolean | undefined;
}

const buckets = globalThis.__myuniRateLimitBuckets ?? new Map<string, Bucket>();
globalThis.__myuniRateLimitBuckets = buckets;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken, enableAutoPipelining: true })
  : null;
const REDIS_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX || 'myuni:ratelimit';
const MINUTE = 60_000;

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

function ruleFor(request: NextRequest): RateLimitRule | null {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Provider callbacks must be retryable. Signature and idempotency checks are
  // their protection layer.
  if (
    pathname.startsWith('/api/iyzico-callback') ||
    pathname.startsWith('/api/shopier-callback') ||
    pathname.startsWith('/api/shopier-webhook')
  ) {
    return null;
  }

  if (pathname === '/api/health' || pathname === '/api/health/details') {
    return { name: 'health', limit: 30, windowMs: MINUTE };
  }
  if (pathname === '/api/search' || pathname.startsWith('/api/ai-chat')) {
    return { name: 'expensive-read', limit: 20, windowMs: MINUTE };
  }
  if (pathname.startsWith('/api/public') || pathname === '/api/events') {
    return { name: 'public-read', limit: 120, windowMs: MINUTE };
  }
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    return { name: 'write', limit: 20, windowMs: MINUTE };
  }
  return { name: 'api-read', limit: 90, windowMs: MINUTE };
}

function clientIdentifier(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

async function hashIdentifier(identifier: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identifier),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function sweepExpired(now: number) {
  const lastSweep = globalThis.__myuniRateLimitLastSweep || 0;
  if (now - lastSweep < MINUTE || buckets.size < 500) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  globalThis.__myuniRateLimitLastSweep = now;
}

function incrementMemory(key: string, windowMs: number, now: number): RateLimitResult {
  sweepExpired(now);
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);
  return { count: bucket.count, resetAt: bucket.resetAt, backend: 'memory' };
}

async function incrementDistributed(
  key: string,
  windowMs: number,
  now: number,
): Promise<RateLimitResult> {
  if (!redis) {
    if (!globalThis.__myuniRateLimitRedisWarningShown) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN missing; using per-instance memory fallback.',
      );
      globalThis.__myuniRateLimitRedisWarningShown = true;
    }
    return incrementMemory(key, windowMs, now);
  }

  try {
    const result = await redis.eval(INCREMENT_SCRIPT, [key], [windowMs]) as [number, number];
    const count = Number(result[0]);
    const ttlMs = Math.max(1, Number(result[1]));
    return { count, resetAt: now + ttlMs, backend: 'redis' };
  } catch (error) {
    // Availability is preserved during a Redis outage, while the local limiter
    // still provides best-effort protection for the current instance.
    console.error('[rate-limit] Redis unavailable; using memory fallback.', error);
    return incrementMemory(key, windowMs, now);
  }
}

export async function enforceApiRateLimit(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/api/')) return null;

  const rule = ruleFor(request);
  if (!rule) return null;

  const now = Date.now();
  const identifierHash = await hashIdentifier(clientIdentifier(request));
  const key = `${REDIS_PREFIX}:${rule.name}:${identifierHash}`;
  const result = await incrementDistributed(key, rule.windowMs, now);

  if (result.count <= rule.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please try again shortly.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(rule.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'X-RateLimit-Backend': result.backend,
      },
    },
  );
}
