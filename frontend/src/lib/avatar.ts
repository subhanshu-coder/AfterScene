import { supabase } from './supabase';

export function avatarUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return supabase?.storage.from('avatars').getPublicUrl(value).data.publicUrl ?? null;
}

