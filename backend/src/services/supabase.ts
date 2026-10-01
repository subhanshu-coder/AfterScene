import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const authClient = env.SUPABASE_URL && publishableKey
  ? createClient(env.SUPABASE_URL, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export const getServiceClient = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error('Database writes are not configured.'), { statusCode: 503 });
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
};

export function getUserClient(token?: string) {
  if (!env.SUPABASE_URL || !publishableKey) {
    throw Object.assign(new Error('Supabase is not configured.'), { statusCode: 503 });
  }
  return createClient(env.SUPABASE_URL, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export async function getUserId(token: string): Promise<string | null> {
  if (!authClient) throw Object.assign(new Error('Authentication is not configured.'), { statusCode: 503 });
  const { data, error } = await authClient.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}
