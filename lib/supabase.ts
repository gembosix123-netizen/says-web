import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Public client (safe for client-side usage)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (server-side). Prefer service role key; fall back to anon key with warning.
let _supabaseAdmin: SupabaseClient | null = null;
if (typeof window === 'undefined') {
  const adminKey = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found — initializing admin client with ANON key. This is less secure; provide a service role key in production.');
  }
  _supabaseAdmin = createClient(supabaseUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export const supabaseAdmin: SupabaseClient | null = _supabaseAdmin;

// Database related types
export interface User {
  id: string;
  name?: string;
  username?: string;
  role?: string;
  branch?: string;
  created_at?: string;
}

export interface Sale {
  id: string;
  amount: number;
  branch?: string;
  items?: any[];
  customer_name?: string;
  created_at?: string;
}