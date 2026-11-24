import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getLearningAdminClient } from '@/lib/supabase/adminDatabases';

/**
 * GET /api/certificates/me — list user's course + event certificates
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const [courseResult, eventResult] = await Promise.all([
      supabaseAdmin
        .from('myuni_certificates')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('issue_date', { ascending: false }),
      supabaseAdmin
        .from('myuni_event_certificates')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('issue_date', { ascending: false }),
    ]);

    if (courseResult.error) {
      return NextResponse.json({ success: false, error: courseResult.error.message }, { status: 500 });
    }
    if (eventResult.error) {
      return NextResponse.json({ success: false, error: eventResult.error.message }, { status: 500 });
    }

    const courseCertificates = courseResult.data || [];
    const eventCertificates = eventResult.data || [];
    const learning = getLearningAdminClient();
    const courseIds = [...new Set(courseCertificates.map((row) => row.course_id).filter(Boolean))];
    const eventIds = [...new Set(eventCertificates.map((row) => row.event_id).filter(Boolean))];

    const [coursesResult, eventsResult] = await Promise.all([
      courseIds.length > 0
        ? learning.from('myuni_courses').select('*').in('id', courseIds)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length > 0
        ? learning.from('myuni_events').select('*').in('id', eventIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (coursesResult.error) {
      console.warn('Certificate course enrichment skipped:', coursesResult.error.message);
    }
    if (eventsResult.error) {
      console.warn('Certificate event enrichment skipped:', eventsResult.error.message);
    }

    const coursesById = new Map((coursesResult.data || []).map((course) => [course.id, course]));
    const eventsById = new Map((eventsResult.data || []).map((event) => [event.id, event]));

    return NextResponse.json({
      success: true,
      courseCertificates: courseCertificates.map((certificate) => ({
        ...certificate,
        course: coursesById.get(certificate.course_id) || null,
      })),
      eventCertificates: eventCertificates.map((certificate) => ({
        ...certificate,
        event: eventsById.get(certificate.event_id) || null,
      })),
    });
  } catch (error) {
    console.error('GET /api/certificates/me error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
