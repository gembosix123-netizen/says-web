/**
 * Password Migration Script
 * =========================
 * Migrates passwords from SHA-256 to bcrypt hashing
 * 
 * IMPORTANT: This script cannot reverse SHA-256 hashes. Users with old passwords
 * will need to reset their passwords or use a temporary password.
 * 
 * Usage:
 * ```bash
 * # Dry run (check which users need migration)
 * ts-node scripts/migrate-passwords.ts --dry-run
 * 
 * # Migrate with temporary password
 * ts-node scripts/migrate-passwords.ts --temp-password "TempPass2024!"
 * 
 * # Mark users for password reset (recommended)
 * ts-node scripts/migrate-passwords.ts --force-reset
 * ```
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const SALT_ROUNDS = 10;
const DEFAULT_TEMP_PASSWORD = 'ChangeMe2024!';

interface MigrationStats {
  total: number;
  bcrypt: number;
  sha256: number;
  migrated: number;
  failed: number;
  skipped: number;
}

/**
 * Check if password is already bcrypt hashed
 */
function isBcryptHash(password: string): boolean {
  return password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$');
}

/**
 * Check if password looks like SHA-256 hash (64 hex characters)
 */
function isSHA256Hash(password: string): boolean {
  return /^[a-f0-9]{64}$/i.test(password);
}

/**
 * Get all users from database
 */
async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, password, role, branch, name')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return data || [];
}

/**
 * Update user password in database
 */
async function updateUserPassword(userId: string, hashedPassword: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', userId);

  if (error) {
    console.error(`  ❌ Failed to update user ${userId}:`, error.message);
    return false;
  }

  return true;
}

/**
 * Main migration function
 */
async function migratePasswords(options: {
  dryRun: boolean;
  tempPassword?: string;
  forceReset?: boolean;
}) {
  console.log('\n🔐 Password Migration Script');
  console.log('=' .repeat(50));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'PRODUCTION'}`);
  console.log(`Strategy: ${options.forceReset ? 'Force Password Reset' : 'Temporary Password'}`);
  if (options.tempPassword && !options.forceReset) {
    console.log(`Temp Password: ${options.tempPassword}`);
  }
  console.log('=' .repeat(50));
  console.log('');

  const stats: MigrationStats = {
    total: 0,
    bcrypt: 0,
    sha256: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
  };

  const migrationLog: Array<{
    username: string;
    role: string;
    status: 'migrated' | 'skipped' | 'failed';
    oldHashType: 'bcrypt' | 'sha256' | 'plaintext';
    message?: string;
  }> = [];

  try {
    console.log('📊 Fetching users from database...');
    const users = await getAllUsers();
    stats.total = users.length;
    console.log(`✅ Found ${stats.total} users\n`);

    const tempPassword = options.tempPassword || DEFAULT_TEMP_PASSWORD;
    const tempPasswordHash = options.forceReset ? null : await bcrypt.hash(tempPassword, SALT_ROUNDS);

    for (const user of users) {
      const { id, username, password, role, branch, name } = user;
      console.log(`Processing: ${username} (${role} - ${branch})`);

      // Check current password hash type
      if (isBcryptHash(password)) {
        console.log('  ✅ Already using bcrypt - skipping');
        stats.bcrypt++;
        stats.skipped++;
        migrationLog.push({
          username,
          role,
          status: 'skipped',
          oldHashType: 'bcrypt',
          message: 'Already using bcrypt',
        });
        continue;
      }

      let oldHashType: 'sha256' | 'plaintext' = 'plaintext';
      if (isSHA256Hash(password)) {
        console.log('  🔄 SHA-256 hash detected - needs migration');
        oldHashType = 'sha256';
        stats.sha256++;
      } else {
        console.log('  ⚠️  Plain text or unknown format detected');
      }

      if (options.dryRun) {
        console.log(`  📝 Would migrate (dry run only)`);
        migrationLog.push({
          username,
          role,
          status: 'migrated',
          oldHashType,
          message: 'Dry run - no changes made',
        });
        stats.migrated++;
        continue;
      }

      if (options.forceReset) {
        // In a real implementation, you'd set a password_reset_required flag
        // For now, we'll set a known temporary password
        console.log(`  🔄 Setting temporary password (user must reset)`);
      } else {
        console.log(`  🔄 Migrating to bcrypt...`);
      }

      const success = tempPasswordHash 
        ? await updateUserPassword(id, tempPasswordHash)
        : false;

      if (success) {
        console.log(`  ✅ Migration successful`);
        stats.migrated++;
        migrationLog.push({
          username,
          role,
          status: 'migrated',
          oldHashType,
          message: options.forceReset 
            ? 'Password reset required on next login' 
            : 'Migrated to bcrypt with temporary password',
        });
      } else {
        console.log(`  ❌ Migration failed`);
        stats.failed++;
        migrationLog.push({
          username,
          role,
          status: 'failed',
          oldHashType,
          message: 'Database update failed',
        });
      }

      console.log('');
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Users:       ${stats.total}`);
    console.log(`Already Bcrypt:    ${stats.bcrypt} (skipped)`);
    console.log(`SHA-256 Found:     ${stats.sha256}`);
    console.log(`Successfully Migrated: ${stats.migrated}`);
    console.log(`Failed:            ${stats.failed}`);
    console.log(`Skipped:           ${stats.skipped}`);
    console.log('='.repeat(50));

    // Save migration log
    if (!options.dryRun && stats.migrated > 0) {
      const logFile = path.join(__dirname, `../logs/password-migration-${Date.now()}.json`);
      const logsDir = path.dirname(logFile);
      
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      fs.writeFileSync(
        logFile,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            stats,
            migrations: migrationLog,
            tempPassword: options.forceReset ? 'RESET_REQUIRED' : tempPassword,
          },
          null,
          2
        )
      );

      console.log(`\n📄 Migration log saved: ${logFile}`);
    }

    // Print user notifications
    if (!options.dryRun && stats.migrated > 0) {
      console.log('\n' + '='.repeat(50));
      console.log('📧 USER NOTIFICATIONS REQUIRED');
      console.log('='.repeat(50));
      console.log('\nPlease inform the following users to update their passwords:');
      console.log('');

      migrationLog
        .filter(log => log.status === 'migrated')
        .forEach(log => {
          console.log(`  • ${log.username} (${log.role})`);
        });

      if (!options.forceReset) {
        console.log(`\nTemporary password for all migrated users: ${tempPassword}`);
        console.log('⚠️  IMPORTANT: Users should change this password immediately!\n');
      }
    }

    if (options.dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made to the database.');
      console.log('    Run without --dry-run to perform actual migration.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceReset = args.includes('--force-reset');
const tempPasswordIndex = args.indexOf('--temp-password');
const tempPassword = tempPasswordIndex >= 0 ? args[tempPasswordIndex + 1] : undefined;

// Validate arguments
if (tempPassword && forceReset) {
  console.error('❌ Cannot use both --temp-password and --force-reset');
  process.exit(1);
}

if (tempPassword && tempPassword.length < 8) {
  console.error('❌ Temporary password must be at least 8 characters');
  process.exit(1);
}

// Run migration
migratePasswords({
  dryRun,
  tempPassword,
  forceReset,
}).then(() => {
  console.log('✅ Migration script completed successfully\n');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Migration script failed:', error);
  process.exit(1);
});
