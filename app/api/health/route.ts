import { NextRequest, NextResponse } from 'next/server';
import { getCachedHealthSnapshot, HEALTH_CACHE_SECONDS } from '@/lib/api/healthChecks';
import { enforceApiRateLimit } from '@/lib/api/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const snapshot = await getCachedHealthSnapshot();

  return NextResponse.json(
    {
      ok: snapshot.ok,
      status: snapshot.status,
      checkedAt: snapshot.checkedAt,
    },
    {
      status: snapshot.ok ? 200 : 503,
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${HEALTH_CACHE_SECONDS}, stale-while-revalidate=${HEALTH_CACHE_SECONDS}`,
      },
    },
  );
}
