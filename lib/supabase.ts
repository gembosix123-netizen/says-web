import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when both public URL and anon key are set (e.g. in `.env.local`). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to `.env.local` (project root) and restart `next dev`. API routes will not throw at import; admin DB calls stay disabled until configured.'
  );
}

// Public client: never throw at module load (that breaks `/api/*` with HTML 500 + confusing login errors).
// Use placeholder URL/key only when unset so `createClient` still initializes; real calls fail until env is fixed.
const publicUrl = supabaseUrl ?? 'https://placeholder.supabase.co';
const publicAnon = supabaseAnonKey ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase: SupabaseClient = createClient(publicUrl, publicAnon);

// Admin client (server-side). Prefer service role key; fall back to anon key with warning.
let _supabaseAdmin: SupabaseClient | null = null;
if (typeof window === 'undefined' && isSupabaseConfigured) {
  const adminKey = supabaseServiceKey || supabaseAnonKey!;
  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found — initializing admin client with ANON key. This is less secure; provide a service role key in production.');
  }
  _supabaseAdmin = createClient(supabaseUrl!, adminKey, {
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