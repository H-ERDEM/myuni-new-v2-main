import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getLearningAdminClient } from '@/lib/supabase/adminDatabases';
import { getPublicCacheHeaders, PUBLIC_CACHE_SECONDS } from '@/lib/publicCache';

const loadLessonPreview = unstable_cache(
  async (lessonId: string) => {
    const { data, error } = await getLearningAdminClient()
      .from('myuni_videos')
      .select('id, lesson_id, title, description, vimeo_id, video_url, thumbnail_url, duration_seconds, order_index, vimeo_hash')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  ['public-lesson-preview-v1'],
  { revalidate: PUBLIC_CACHE_SECONDS }
);

export async function GET(_request: NextRequest, context: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await context.params;
    const video = await loadLessonPreview(lessonId);
    return NextResponse.json({ success: true, video }, { headers: getPublicCacheHeaders() });
  } catch (error) {
    console.error('[api/public/lessons] preview failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Failed to load lesson preview' }, { status: 500 });
  }
}
