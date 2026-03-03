import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
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
    // Rate limiting check
    const clientIp = getClientIp(request);
    const rateLimitResult = await rateLimiters.login.check(clientIp, 'login');
    
    if (!rateLimitResult.success) {
      const resetTime = rateLimitResult.resetAt.toLocaleTimeString('ms-MY', {
        hour: '2-digit',
        minute: '2-digit',
      });
      
      return NextResponse.json(
        { 
          error: rateLimitResult.blocked 
            ? `Too many login attempts. Account temporarily locked. Try again at ${resetTime}` 
            : `Too many attempts. Please try again in a few minutes.`,
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

    const body = await request.json();

    // Validate input with Zod
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err: { message: string }) => err.message);
      return NextResponse.json({ error: errors[0] || 'Invalid input' }, { status: 400 });
    }

    const username = validation.data.username.trim();
    const password = validation.data.password;

    let users: Array<Record<string, unknown>> | null = null;
    let error: { message?: string } | null = null;

    if (supabaseAdmin) {
      const primaryQuery = await supabaseAdmin
        .from('users')
        .select('id, username, role, branch, password')
        .ilike('username', username)
        .limit(1);

      users = primaryQuery.data as Array<Record<string, unknown>> | null;
      error = primaryQuery.error as { message?: string } | null;

      // Backward compatibility: some environments still use password_hash
      if ((!users || users.length === 0) && !error) {
        const legacyQuery = await supabaseAdmin
          .from('users')
          .select('id, username, role, branch, password_hash')
          .ilike('username', username)
          .limit(1);

        users = legacyQuery.data as Array<Record<string, unknown>> | null;
        error = legacyQuery.error as { message?: string } | null;
      }
    } else {
      error = { message: 'supabase admin unavailable' };
    }

    let user = users?.[0] as AuthUser | undefined;

    if (!user) {
      // Fallback to local JSON/Redis DB for environments where Supabase schema is incomplete
      try {
        const localUsers = await db.users.getAll();
        user = localUsers.find((u) => (u.username || '').toLowerCase() === username.toLowerCase()) as AuthUser | undefined;
      } catch (fallbackError) {
        console.error('Local auth fallback error:', fallbackError);
      }
    }

    if (!user && error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const storedPassword = user.password || user.password_hash;
    if (!storedPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password with automatic migration from legacy formats
    const verificationResult = await verifyPasswordWithMigration(password, storedPassword);

    if (!verificationResult.valid) {
      console.log('[LOGIN] Failed login attempt for user:', username);
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
    await rateLimiters.login.reset(clientIp, 'login');

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