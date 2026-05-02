import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { rateLimiters, getClientIp } from '@/lib/rateLimit';
import { loginSchema } from '@/lib/validations';
import { normalizeRole } from '@/lib/roles';

const SALT_ROUNDS = 10;

type AuthUser = {
  id: string;
  username?: string;
  role?: string;
  branch?: string;
  name?: string;
  full_name?: string;
  password?: string;
  password_hash?: string;
};

function findLocalUserByLoginIdentifier(
  localUsers: readonly unknown[],
  login: string
): AuthUser | undefined {
  const q = login.trim().toLowerCase();
  const row = localUsers.find((raw) => {
    const u = raw as Record<string, unknown>;
    const uname = String(u.username ?? '').toLowerCase();
    const uid = String(u.id ?? u.userId ?? '').toLowerCase();
    return uname === q || uid === q;
  });
  if (!row) return undefined;
  const u = row as Record<string, unknown>;
  const id = String(u.id ?? u.userId ?? '');
  if (!id) return undefined;
  const pw = (u.password ?? u.password_hash ?? u.passwordHash) as string | undefined;
  return {
    id,
    username: u.username as string | undefined,
    role: u.role as string | undefined,
    branch: u.branch as string | undefined,
    name: u.name as string | undefined,
    full_name: u.full_name as string | undefined,
    password: pw,
    password_hash: u.password_hash as string | undefined,
  };
}

/** Avoid mixing non-UUID login strings with `id.eq` in PostgREST `.or()` (can yield no rows / odd parsing). */
function isProbablyUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

/** Map Supabase row to AuthUser (supports password or password_hash column names). */
function rowToAuthUser(row: Record<string, unknown>): AuthUser {
  const id = String(row.id ?? '');
  const pw = (row.password ?? row.password_hash) as string | undefined;
  return {
    ...row,
    id,
    username: row.username as string | undefined,
    role: row.role as string | undefined,
    branch: row.branch as string | undefined,
    name: row.name as string | undefined,
    full_name: row.full_name as string | undefined,
    password: pw,
    password_hash: row.password_hash as string | undefined,
  };
}

async function loadUserFromSupabase(
  admin: NonNullable<typeof supabaseAdmin>,
  loginInput: string
): Promise<{ user?: AuthUser; queryError?: { message?: string } }> {
  const raw = loginInput.trim();
  const lower = raw.toLowerCase();

  /**
   * Beberapa deployment / PostgREST: `ilike` sahaja kadang tidak padan seperti `eq`.
   * Cuba beberapa penapis untuk username (ikut screenshot Dashboard: semua huruf kecil).
   */
  const usernameAttempts = [
    () => admin.from('users').select('*').eq('username', raw).limit(1),
    () => admin.from('users').select('*').eq('username', lower).limit(1),
    () => admin.from('users').select('*').ilike('username', raw).limit(1),
    () => admin.from('users').select('*').ilike('username', lower).limit(1),
  ];

  for (const run of usernameAttempts) {
    const { data, error } = await run();
    if (error) {
      return { queryError: error };
    }
    const row = (data as Array<Record<string, unknown>> | null)?.[0];
    if (row) {
      return { user: rowToAuthUser(row) };
    }
  }

  if (isProbablyUuid(raw)) {
    const { data, error } = await admin.from('users').select('*').eq('id', raw).limit(1);
    if (error) {
      return { queryError: error };
    }
    const row = (data as Array<Record<string, unknown>> | null)?.[0];
    if (row) {
      return { user: rowToAuthUser(row) };
    }
  }

  return {};
}

/**
 * Check if password hash is bcrypt format
 */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

/**
 * Legacy SHA-256 password hashing (for migration only)
 */
function hashPasswordSHA256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify password with automatic migration from old format to bcrypt
 * Returns { valid: boolean, needsMigration: boolean, newHash?: string }
 */
async function verifyPasswordWithMigration(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsMigration: boolean; newHash?: string }> {
  
  // If already bcrypt, verify normally
  if (isBcryptHash(storedHash)) {
    try {
      const valid = await bcrypt.compare(password, storedHash);
      return { valid, needsMigration: false };
    } catch {
      return { valid: false, needsMigration: false };
    }
  }

  // Legacy format detected - try SHA-256 comparison
  const sha256Hash = hashPasswordSHA256(password);
  const isValidSHA256 = storedHash === sha256Hash;

  // Also try plain text comparison (for very old accounts)
  const isValidPlainText = storedHash === password;

  const isValid = isValidSHA256 || isValidPlainText;

  if (isValid) {
    // Password is correct but in old format - create new bcrypt hash
    const newHash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log('[LOGIN] Password verified - migrating from legacy format');
    return { valid: true, needsMigration: true, newHash };
  }

  return { valid: false, needsMigration: false };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err: { message: string }) => err.message);
      return NextResponse.json({ error: errors[0] || 'Invalid input' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const username = validation.data.username.trim();
    const password = validation.data.password;
    const rateLimitKey = `${clientIp}:${username.toLowerCase()}`;

    // Rate limit per IP + username so one user's failed attempts do not lock everyone on the same network.
    const rateLimitResult = await rateLimiters.login.check(rateLimitKey, 'login');

    if (!rateLimitResult.success) {
      const resetTime = rateLimitResult.resetAt.toLocaleTimeString('ms-MY', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return NextResponse.json(
        {
          error: rateLimitResult.blocked
            ? `Too many login attempts. Account temporarily locked. Try again at ${resetTime}`
            : 'Too many attempts. Please try again in a few minutes.',
          resetAt: rateLimitResult.resetAt.toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      );
    }


    let user: AuthUser | undefined;

    if (isSupabaseConfigured && supabaseAdmin) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn(
          '[LOGIN] Tiada SUPABASE_SERVICE_ROLE_KEY — klien guna anon key. RLS pada jadual users selalunya menghalang bacaan; log masuk akan dapat “Invalid credentials”. Tambah service role key dalam .env.local dan mulakan semula dev server.'
        );
      }

      const loginInput = username.trim();
      const { user: sbUser, queryError } = await loadUserFromSupabase(supabaseAdmin, loginInput);
      user = sbUser;

      if (queryError && !user) {
        console.error('[LOGIN] Supabase:', queryError);
        return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
      }

      if (!user) {
        console.warn(`[LOGIN] Tiada baris dalam public.users untuk identifier: "${loginInput}" (semak RLS & SUPABASE_SERVICE_ROLE_KEY)`);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      console.warn('[LOGIN] Supabase tidak dikonfigurasi — sandaran data/users.json (hanya untuk dev tanpa env).');
      try {
        const localUsers = await db.users.getAll();
        user = findLocalUserByLoginIdentifier(localUsers, username);
      } catch (fallbackError) {
        console.error('[LOGIN] Sandaran tempatan gagal:', fallbackError);
        return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
      }

      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

    const storedPassword = user.password || user.password_hash;
    if (!storedPassword) {
      console.warn('[LOGIN] Pengguna dijumpai tetapi tiada password / password_hash dalam baris — semak skema Supabase');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const verificationResult = await verifyPasswordWithMigration(password, storedPassword);

    if (!verificationResult.valid) {
      console.warn(
        `[LOGIN] Kata laluan tidak sepadan untuk username/id "${username}" (baris Supabase dijumpai — semak kata laluan atau reset dalam Supabase)`
      );
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // If password needs migration, upgrade it now
    if (verificationResult.needsMigration && verificationResult.newHash && supabaseAdmin) {
      console.log('[LOGIN] Auto-migrating password to bcrypt for user:', username);
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ password: verificationResult.newHash })
        .eq('id', user.id);

      if (updateError) {
        // Legacy fallback: try password_hash column if password column update fails
        const { error: legacyUpdateError } = await supabaseAdmin
          .from('users')
          .update({ password_hash: verificationResult.newHash })
          .eq('id', user.id);

        if (legacyUpdateError) {
          console.error('[LOGIN] Failed to migrate password:', legacyUpdateError);
          // Don't fail login - password will migrate next time
        } else {
          console.log('[LOGIN] Password successfully migrated to legacy password_hash');
        }
      } else {
        console.log('[LOGIN] Password successfully migrated to bcrypt');
      }
    }

    console.log('[LOGIN] Successful login for user:', username);

    // Reset rate limit on successful login
    await rateLimiters.login.reset(rateLimitKey, 'login');

    const normalizedRole = normalizeRole(user.role) || 'Sales';
    const displayName = user.name || user.full_name || user.username || 'User';
    const branch = user.branch || 'HQ';

    // Create session cookie
    const response = NextResponse.json({ 
      success: true, 
      role: normalizedRole,
      name: displayName,
      id: user.id, 
      branch
    });
    
    const sessionData = JSON.stringify({ 
      id: user.id, 
      role: normalizedRole,
      name: displayName,
      branch
    });
    
    response.cookies.set('session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}