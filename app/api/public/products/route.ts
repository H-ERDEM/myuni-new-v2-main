import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getIdentityAdminClient } from '@/lib/supabase/adminDatabases';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';
import { paginationMetadata, parsePagination } from '@/lib/api/pagination';

const PRODUCT_LIST_COLUMNS = `
  id, title, slug, description, short_description, product_type, price,
  original_price, is_free, thumbnail_url, is_active, created_at
`;

const loadProducts = unstable_cache(
  async (page: number, limit: number) => {
    const from = (page - 1) * limit;
    const { data, error, count } = await getIdentityAdminClient()
      .from('myuni_products')
      .select(PRODUCT_LIST_COLUMNS, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw error;
    return { products: data || [], total: count || 0 };
  },
  ['public-products-v1'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parsePagination(request.nextUrl.searchParams);
    const { products, total } = await loadProducts(page, limit);
    return NextResponse.json(
      { success: true, products, pagination: paginationMetadata(page, limit, total) },
      { headers: getPublicCacheHeaders() }
    );
  } catch (error) {
    console.error('[api/public/products] list failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Failed to load products', products: [] },
      { status: 500 }
    );
  }
}
