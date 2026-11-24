/** Keep storage assets on the object-storage CDN instead of proxying bytes through Vercel. */
export function toProxiedMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  const isSupabaseStorage =
    url.includes('.supabase.co/storage/v1/object/') ||
    url.includes('supabase.co/storage/v1/object/');

  if (!isSupabaseStorage) return url;

  return url;
}

export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('.supabase.co/storage/v1/object/') ||
    url.includes('supabase.co/storage/v1/object/')
  );
}

export function toLearningPublicStorageUrl(
  path: string | null | undefined,
  bucket = 'myunilab'
): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_LEARNING_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  if (!baseUrl) return path;
  const normalizedPath = path.replace(/^\/+/, '');
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${normalizedPath}`;
}
