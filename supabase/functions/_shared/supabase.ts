import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from './database.types.ts';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Edge Function runtime.
export const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
