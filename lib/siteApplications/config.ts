export const siteApplicationsDb = {
  applications: 'myuni_site_applications',
  statusHistory: 'myuni_site_application_status_history',
  forms: 'myuni_site_application_forms',
  formFields: 'myuni_site_application_form_fields',
} as const;

export const SITE_APPLICATION_FORM_COLUMNS = `
  id, slug_tr, slug_en, title_tr, title_en, subtitle_tr, subtitle_en,
  success_message_tr, success_message_en, is_active, show_on_website,
  allows_attachment, created_by, created_by_email, created_at, updated_at,
  event_id, package_settings, form_type, course_id
`;

export const SITE_APPLICATION_FORM_FIELD_COLUMNS = `
  id, form_id, field_key, field_type, label_tr, label_en, placeholder_tr,
  placeholder_en, required, order_index, options, is_contact, created_at
`;

export type SiteApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'rejected';

export const SITE_APPLICATION_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const SITE_APPLICATION_FILE_RETENTION_DAYS = 30;

export const SITE_APPLICATION_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SITE_APPLICATIONS_BUCKET ||
  process.env.NEXT_PUBLIC_INTERNSHIP_CV_BUCKET ||
  'site-application-attachments';

export const SITE_APPLICATION_STORAGE_FOLDER = 'site-applications';

/** Ekip formları (event_id olmayan) */
export const TEAM_FORM_SLUGS = new Set(['ekip-basvuru', 'team-application']);

export function getEventApplicationPath(locale: string, eventSlug: string): string {
  const segment = locale === 'en' ? 'event' : 'etkinlik';
  return `/${locale}/${segment}/${eventSlug}/basvuru`;
}

export function getSiteApplicationPublicPath(locale: string, slug: string): string {
  return `/${locale}/${slug}`;
}
