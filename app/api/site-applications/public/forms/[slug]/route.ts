import { NextRequest, NextResponse } from 'next/server';
import { getSiteApplicationsSupabase } from '@/lib/supabaseSiteApplications';
import {
  SITE_APPLICATION_FORM_COLUMNS,
  SITE_APPLICATION_FORM_FIELD_COLUMNS,
  siteApplicationsDb,
} from '@/lib/siteApplications/config';
import { toPublicForm } from '@/lib/siteApplications/forms';
import type { SiteApplicationForm, SiteApplicationFormField } from '@/app/types/siteApplicationForms';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'tr';
    const slugColumn = locale === 'en' ? 'slug_en' : 'slug_tr';

    const supabase = getSiteApplicationsSupabase();
    const { data: form, error } = await supabase
      .from(siteApplicationsDb.forms)
      .select(SITE_APPLICATION_FORM_COLUMNS)
      .eq(slugColumn, slug)
      .eq('is_active', true)
      .eq('show_on_website', true)
      .maybeSingle();

    if (error || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const { data: fields, error: fieldsError } = await supabase
      .from(siteApplicationsDb.formFields)
      .select(SITE_APPLICATION_FORM_FIELD_COLUMNS)
      .eq('form_id', form.id)
      .order('order_index', { ascending: true });

    if (fieldsError) {
      return NextResponse.json({ error: fieldsError.message }, { status: 500 });
    }

    const publicForm = toPublicForm(
      form as SiteApplicationForm,
      (fields ?? []) as SiteApplicationFormField[],
      locale
    );

    return NextResponse.json({ form: publicForm, locale });
  } catch (err) {
    console.error('Public form fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
