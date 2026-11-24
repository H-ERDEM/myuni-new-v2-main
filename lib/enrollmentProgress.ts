import 'server-only';

import { supabaseAdmin } from './supabaseAdmin';

export type EnrollmentProgressSyncResult =
  | { status: 'updated'; progressPercentage: number; completedLessons: number; totalLessons: number }
  | { status: 'skipped'; reason: 'no-enrollment' | 'partial-tier' | 'missing-tier' | 'no-active-lessons' };

/**
 * Recomputes the Identity enrollment summary from Learning lesson progress.
 * Partial tiers are intentionally skipped until lesson-level tier entitlements
 * have an exact mapping; title/label heuristics must not mutate user data.
 */
export async function recalculateEnrollmentProgress(
  userId: string,
  courseId: string
): Promise<EnrollmentProgressSyncResult> {
  const { data: enrollment, error: enrollmentError } = await supabaseAdmin
    .from('myuni_enrollments')
    .select('id,tier_id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment) return { status: 'skipped', reason: 'no-enrollment' };

  const { data: courseTiers, error: tiersError } = await supabaseAdmin
    .from('myuni_course_tiers')
    .select('id,slug,is_full_course')
    .eq('course_id', courseId)
    .eq('is_active', true);
  if (tiersError) throw tiersError;

  if (enrollment.tier_id) {
    const tier = (courseTiers || []).find((row) => row.id === enrollment.tier_id);
    if (!tier) return { status: 'skipped', reason: 'missing-tier' };
    if (tier.is_full_course !== true && tier.slug !== 'tam-egitim') {
      return { status: 'skipped', reason: 'partial-tier' };
    }
  }

  const { data: lessons, error: lessonsError } = await supabaseAdmin
    .from('myuni_course_lessons')
    .select('id,myuni_course_sections!inner(course_id,is_active)')
    .eq('myuni_course_sections.course_id', courseId)
    .eq('myuni_course_sections.is_active', true)
    .eq('is_active', true);
  if (lessonsError) throw lessonsError;

  const lessonIds = (lessons || []).map((lesson) => lesson.id);
  if (lessonIds.length === 0) {
    return { status: 'skipped', reason: 'no-active-lessons' };
  }

  let completedLessons = 0;
  for (let index = 0; index < lessonIds.length; index += 500) {
    const chunk = lessonIds.slice(index, index + 500);
    const { count, error: progressError } = await supabaseAdmin
      .from('myuni_user_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_completed', true)
      .in('lesson_id', chunk);
    if (progressError) throw progressError;
    completedLessons += count || 0;
  }

  const progressPercentage = Math.min(
    100,
    Math.round((completedLessons / lessonIds.length) * 100)
  );
  const { error: updateError } = await supabaseAdmin
    .from('myuni_enrollments')
    .update({ progress_percentage: progressPercentage })
    .eq('id', enrollment.id);
  if (updateError) throw updateError;

  return {
    status: 'updated',
    progressPercentage,
    completedLessons,
    totalLessons: lessonIds.length,
  };
}
