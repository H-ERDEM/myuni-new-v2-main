import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getLearningAdminClient } from '@/lib/supabase/adminDatabases';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';

const PREVIEW_COLUMNS = `
  id, lesson_id, title, description, vimeo_id, video_url, thumbnail_url,
  duration_seconds, order_index, vimeo_hash
`;

const loadPreview = unstable_cache(
  async (slug: string) => {
    const client = getLearningAdminClient();
    const { data: course, error: courseError } = await client
      .from('myuni_courses').select('id').eq('slug', slug).eq('is_active', true).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return null;

    const { data: section, error: sectionError } = await client
      .from('myuni_course_sections').select('id').eq('course_id', course.id)
      .eq('is_active', true).order('order_index', { ascending: true }).limit(1).maybeSingle();
    if (sectionError) throw sectionError;
    if (!section) return null;

    const { data: lesson, error: lessonError } = await client
      .from('myuni_course_lessons').select('id').eq('section_id', section.id)
      .eq('is_active', true).order('order_index', { ascending: true }).limit(1).maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) return null;

    const { data: video, error: videoError } = await client
      .from('myuni_videos').select(PREVIEW_COLUMNS).eq('lesson_id', lesson.id)
      .order('order_index', { ascending: true }).limit(1).maybeSingle();
    if (videoError) throw videoError;
    return video;
  },
  ['public-course-preview-v1'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const video = await loadPreview(slug);
    return NextResponse.json({ success: true, video }, { headers: getPublicCacheHeaders() });
  } catch (error) {
    console.error('[api/public/courses] preview failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Failed to load course preview' }, { status: 500 });
  }
}
