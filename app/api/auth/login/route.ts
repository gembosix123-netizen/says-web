import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { rateLimiters, getClientIp } from '@/lib/rateLimit';
import { loginSchema } from '@/lib/validations';

const SALT_ROUNDS = 10;

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
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsMigration: false };
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

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err: any) => err.message);
      return NextResponse.json({ error: errors[0] || 'Invalid input' }, { status: 400 });
    }

    const { username, password } = validation.data;

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const user = users?.[0];

    // Use constant-time comparison to prevent timing attacks
    if (!user) {
      // Still check a dummy password to prevent timing analysis
      await bcrypt.compare(password, '$2b$10$abcdefghijklmnopqrstuv1234567890123456789012');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password with automatic migration from legacy formats
    const verificationResult = await verifyPasswordWithMigration(password, user.password);

    if (!verificationResult.valid) {
      console.log('[LOGIN] Failed login attempt for user:', username);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // If password needs migration, upgrade it now
    if (verificationResult.needsMigration && verificationResult.newHash) {
      console.log('[LOGIN] Auto-migrating password to bcrypt for user:', username);
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ password: verificationResult.newHash })
        .eq('id', user.id);

      if (updateError) {
        console.error('[LOGIN] Failed to migrate password:', updateError);
        // Don't fail login - password will migrate next time
      } else {
        console.log('[LOGIN] Password successfully migrated to bcrypt');
      }
    }

    console.log('[LOGIN] Successful login for user:', username);

    // Reset rate limit on successful login
    await rateLimiters.login.reset(clientIp, 'login');

    // Create session cookie
    const response = NextResponse.json({ 
      success: true, 
      role: user.role, 
      name: user.name, 
      id: user.id, 
      branch: user.branch 
    });
    
    const sessionData = JSON.stringify({ 
      id: user.id, 
      role: user.role, 
      name: user.name, 
      branch: user.branch 
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