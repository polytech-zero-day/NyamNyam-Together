import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

// service_role 클라이언트: RLS 자동 우회. 서버 내부에서만 사용.
// 이 클라이언트를 클라이언트 응답이나 외부에 노출하지 말 것.
export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
