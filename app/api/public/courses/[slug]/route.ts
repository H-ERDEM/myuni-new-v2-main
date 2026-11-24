import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCourseBySlug } from '@/lib/courseService';
import { getLearningAdminClient } from '@/lib/supabase/adminDatabases';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';

const loadCourseDetail = unstable_cache(
  async (slug: string, locale: string) => {
    const course = await getCourseBySlug(slug, locale);
    if (!course) return null;

    const [objectivesResult, requirementsResult] = await Promise.all([
      getLearningAdminClient()
        .from('myuni_course_objectives')
        .select('id, objective_text, order_index')
        .eq('course_id', course.id)
        .order('order_index', { ascending: true }),
      getLearningAdminClient()
        .from('myuni_course_requirements')
        .select('id, requirement_text, order_index')
        .eq('course_id', course.id)
        .order('order_index', { ascending: true }),
    ]);

    if (objectivesResult.error) throw objectivesResult.error;
    if (requirementsResult.error) throw requirementsResult.error;

    return {
      ...course,
      objectives: objectivesResult.data || [],
      requirements: requirementsResult.data || [],
    };
  },
  ['public-course-detail-v1'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'tr';
    const course = await loadCourseDetail(slug, locale);
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }
    return NextResponse.json(
      { success: true, course },
      { headers: getPublicCacheHeaders() }
    );
  } catch (error) {
    console.error('[api/public/courses] detail failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Failed to load course' },
      { status: 500 }
    );
  }
}
