import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getPublicMentorships } from '@/lib/mentorshipService';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';
import { parsePagination } from '@/lib/api/pagination';

const getCachedPublicMentorships = unstable_cache(
  (locale: string, featuredOnly: boolean, page: number, limit: number) =>
    getPublicMentorships(locale, {
      featuredOnly,
      limit: limit + 1,
      offset: (page - 1) * limit,
    }),
  ['public-mentorship-list-v2'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

/** Site — /tr/mentorluk listesi (dashboard mentorships tablosu, is_active=true) */
export async function GET(request: NextRequest) {
  try {
    const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'tr';
    const featuredOnly = request.nextUrl.searchParams.get('featured') === 'true';
    const { page, limit } = parsePagination(request.nextUrl.searchParams);
    const rows = await getCachedPublicMentorships(locale, featuredOnly, page, limit);
    const hasNextPage = rows.length > limit;
    const mentorships = rows.slice(0, limit);

    return NextResponse.json(
      {
        success: true,
        locale,
        mentorships,
        count: mentorships.length,
        pagination: {
          page,
          limit,
          hasNextPage,
          hasPreviousPage: page > 1,
        },
      },
      { headers: getPublicCacheHeaders() }
    );
  } catch (err) {
    console.error('Public mentorships list error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to load mentorships',
        mentorships: [],
      },
      { status: 500 }
    );
  }
}
