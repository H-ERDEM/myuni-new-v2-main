import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getPackageBySlug } from '@/lib/courseService';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';

const loadPackageDetail = unstable_cache(
  (slug: string, locale: string) => getPackageBySlug(slug, locale),
  ['public-package-detail-v1'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'tr';
    const packageDetail = await loadPackageDetail(slug, locale);
    if (!packageDetail) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }
    return NextResponse.json(
      { success: true, package: packageDetail },
      { headers: getPublicCacheHeaders() }
    );
  } catch (error) {
    console.error('[api/public/packages] detail failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Failed to load package' },
      { status: 500 }
    );
  }
}
