import { unstable_cache } from 'next/cache';
import {
  getFormsAdminClient,
  getIdentityAdminClient,
  getLearningAdminClient,
} from '@/lib/supabase/adminDatabases';

export const HEALTH_CACHE_SECONDS = 45;

export type HealthCheckResult = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export type HealthSnapshot = {
  ok: boolean;
  status: 'healthy' | 'degraded';
  checkedAt: string;
  checks: {
    databases: {
      identity: HealthCheckResult;
      learning: HealthCheckResult;
      forms: HealthCheckResult;
    };
    payment: { ok: boolean };
    rateLimit: {
      ok: boolean;
      backend: 'redis' | 'memory';
      required: boolean;
    };
  };
};

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 5000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs),
    ),
  ]);
}

async function databaseCheck(
  query: PromiseLike<{ error: { message?: string } | null }>,
): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  try {
    const result = await withTimeout(query);
    if (result.error) throw new Error(result.error.message || 'query failed');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

async function collectHealthSnapshot(): Promise<HealthSnapshot> {
  const [identity, learning, forms] = await Promise.all([
    databaseCheck(getIdentityAdminClient().from('myuni_products').select('id').limit(1)),
    databaseCheck(getLearningAdminClient().from('myuni_courses').select('id').limit(1)),
    databaseCheck(
      getFormsAdminClient().from('myuni_site_application_forms').select('id').limit(1),
    ),
  ]);

  const paymentConfigured = Boolean(
    process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY && process.env.IYZICO_BASE_URL,
  );
  const redisRateLimitConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  const redisRequired = process.env.VERCEL === '1';
  const rateLimit = {
    ok: redisRateLimitConfigured || !redisRequired,
    backend: (redisRateLimitConfigured ? 'redis' : 'memory') as 'redis' | 'memory',
    required: redisRequired,
  };
  const ok = identity.ok && learning.ok && forms.ok && paymentConfigured && rateLimit.ok;

  return {
    ok,
    status: ok ? 'healthy' : 'degraded',
    checkedAt: new Date().toISOString(),
    checks: {
      databases: { identity, learning, forms },
      payment: { ok: paymentConfigured },
      rateLimit,
    },
  };
}

export const getCachedHealthSnapshot = unstable_cache(
  collectHealthSnapshot,
  ['system-health-v2'],
  { revalidate: HEALTH_CACHE_SECONDS },
);
