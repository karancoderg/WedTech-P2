import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("⚠️ WARNING: NEXT_PUBLIC_SUPABASE_URL is missing in your .env file! Database queries will fail.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
