import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getIdentityAdminClient } from '@/lib/supabase/adminDatabases';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';

const PRODUCT_DETAIL_COLUMNS = `
  id, title, slug, description, short_description, product_type, price,
  original_price, is_free, thumbnail_url, shopier_link, product_content,
  brand_name, brand_logo_url, is_active, created_at
`;

const loadProduct = unstable_cache(
  async (slug: string) => {
    const { data, error } = await getIdentityAdminClient()
      .from('myuni_products')
      .select(PRODUCT_DETAIL_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  ['public-product-detail-v1'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const product = await loadProduct(slug);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(
      { success: true, product },
      { headers: getPublicCacheHeaders() }
    );
  } catch (error) {
    console.error('[api/public/products] detail failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Failed to load product' },
      { status: 500 }
    );
  }
}
