import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recalculateEnrollmentProgress } from '@/lib/enrollmentProgress';

/**
 * POST /api/enrollments — enroll authenticated user in a course
 * Body: { courseId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', requiresAuth: true },
        { status: 401 }
      );
    }

    const body = await request.json();
    const courseId = String(body.courseId || '').trim();

    if (!courseId) {
      return NextResponse.json(
        { success: false, message: 'Missing course ID', error: 'MISSING_PARAMS' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('myuni_enrollments')
      .select('id, welcome_shown, is_active')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Already enrolled',
        enrollment: existing,
      });
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from('myuni_courses')
      .select('id, slug, title')
      .eq('id', courseId)
      .eq('is_active', true)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, message: 'Course not found or inactive', error: courseError },
        { status: 404 }
      );
    }

    const enrollmentData = {
      user_id: userId,
      course_id: courseId,
      enrolled_at: new Date().toISOString(),
      progress_percentage: 0,
      is_active: true,
      welcome_shown: false,
    };

    const { data: enrollment, error: enrollError } = await supabaseAdmin
      .from('myuni_enrollments')
      .insert(enrollmentData)
      .select('id, user_id, course_id, enrolled_at, progress_percentage, is_active, welcome_shown')
      .single();

    if (enrollError) {
      console.error('Enrollment insert error:', enrollError);
      return NextResponse.json(
        { success: false, message: 'Failed to create enrollment', error: enrollError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled',
      enrollment,
    });
  } catch (error) {
    console.error('POST /api/enrollments error:', error);
    return NextResponse.json(
      { success: false, message: 'Unexpected error occurred', error },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/enrollments — update welcome_shown and/or progress_percentage
 * Body: { courseId: string, welcomeShown?: boolean, progressPercentage?: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const courseId = String(body.courseId || '').trim();
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.welcomeShown === 'boolean') {
      updates.welcome_shown = body.welcomeShown;
    }
    const shouldRecalculateProgress = typeof body.progressPercentage === 'number';

    if (Object.keys(updates).length === 0 && !shouldRecalculateProgress) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 });
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin
        .from('myuni_enrollments')
        .update(updates)
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('is_active', true);

      if (error) {
        console.error('Enrollment patch error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    const progressSync = shouldRecalculateProgress
      ? await recalculateEnrollmentProgress(userId, courseId)
      : null;

    return NextResponse.json({ success: true, progressSync });
  } catch (error) {
    console.error('PATCH /api/enrollments error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
