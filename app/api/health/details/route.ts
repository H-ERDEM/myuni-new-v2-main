import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCachedHealthSnapshot, HEALTH_CACHE_SECONDS } from '@/lib/api/healthChecks';
import { enforceApiRateLimit } from '@/lib/api/rateLimit';

export const dynamic = 'force-dynamic';

function secretsMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'Unauthorized' },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Bearer',
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const expectedSecret = process.env.HEALTHCHECK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Detailed healthcheck is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const authorization = request.headers.get('authorization') || '';
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return unauthorized();
  }

  const snapshot = await getCachedHealthSnapshot();
  return NextResponse.json(
    {
      ...snapshot,
      cache: { ttlSeconds: HEALTH_CACHE_SECONDS },
    },
    {
      status: snapshot.ok ? 200 : 503,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
