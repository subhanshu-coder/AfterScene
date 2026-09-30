import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const authClient = env.SUPABASE_URL && env.SUPABASE_ANON_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export const getServiceClient = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error('Database writes are not configured.'), { statusCode: 503 });
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
};

export async function getUserId(token: string): Promise<string | null> {
  if (!authClient) throw Object.assign(new Error('Authentication is not configured.'), { statusCode: 503 });
  const { data, error } = await authClient.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}
