#!/usr/bin/env tsx

/**
 * Docker Container Entrypoint (TypeScript)
 * 
 * Replaces docker-entrypoint.sh to eliminate cross-process boundaries and
 * unify the entire stack in TypeScript. This fixes the "sonic boom is not ready yet"
 * error by ensuring logger initialization happens once in a single process.
 * 
 * Flow:
 * 1. Display banner with version
 * 2. Ensure data directory exists and is writable
 * 3. Create database backup(s) (skip on first run)
 * 4. Run database migrations with retry logic
 * 5. Start Next.js application
 * 
 * Features:
 * - Type-safe configuration from environment variables
 * - Unified structured logging throughout
 * - Proper error handling with try/catch
 * - Exponential backoff retry for migrations
 * - Graceful shutdown on SIGTERM/SIGINT
 * - Direct function calls (no process spawning for backup/migration)
 * 
 * Usage:
 *   npx tsx scripts/entrypoint.ts
 *   docker run -e DATABASE_PATH=/app/data/tome.db tome:latest
 */

// IMPORTANT: Load environment variables BEFORE any imports that might use them
import { config as loadDotenv } from 'dotenv';
loadDotenv();

// NOTE: Database-related imports (createBackups, runMigrations) are dynamically imported
// to avoid module initialization race conditions when the database doesn't exist yet.
// This ensures the entrypoint can fix permissions and create directories before
// any database code tries to initialize connections.

import { getLogger } from '@/lib/logger';
import { spawn, ChildProcess } from 'child_process';
import { dirname } from 'path';
import { existsSync, mkdirSync, accessSync, constants, readFileSync } from 'fs';

/**
 * Type-safe configuration from environment variables
 */
interface EntrypointConfig {
  /** Path to Tome SQLite database */
  databasePath: string;
  /** Directory containing the database */
  dataDir: string;
  /** Maximum number of migration retry attempts */
  maxRetries: number;
  /** Initial retry delay in milliseconds (exponential backoff) */
  retryDelay: number;
  /** Port for Next.js application */
  port: number;
  /** Hostname to bind to */
  hostname: string;
  /** User ID to run as (PUID support) */
  puid: number;
  /** Group ID to run as (PGID support) */
  pgid: number;
}

/**
 * Parse and validate environment configuration
 */
function getEntrypointConfig(): EntrypointConfig {
  const databasePath = process.env.DATABASE_PATH || './data/tome.db';
  
  return {
    databasePath,
    dataDir: dirname(databasePath),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10),
    port: parseInt(process.env.PORT || '3000', 10),
    hostname: process.env.HOSTNAME || '0.0.0.0',
    puid: parseInt(process.env.PUID || '1001', 10),
    pgid: parseInt(process.env.PGID || '1001', 10),
  };
}

const config = getEntrypointConfig();
const logger = getLogger();

/**
 * Check if we're running as root
 */
function isRunningAsRoot(): boolean {
  return process.getuid !== undefined && process.getuid() === 0;
}

/**
 * Setup user and group with specified PUID/PGID
 * 
 * Handles creating or modifying the application user to match the specified
 * UID/GID. This allows the container to run with permissions matching the
 * host system, eliminating volume permission issues.
 * 
 * Strategy:
 * - If user/group with target IDs exist, use them
 * - Otherwise, modify the default nextjs user to match target IDs
 * 
 * @throws Error if user setup fails
 */
async function setupUser(puid: number, pgid: number): Promise<void> {
  logger.info({ puid, pgid }, 'Setting up user with specified PUID/PGID');
  console.log(`Setting up user with PUID=${puid}, PGID=${pgid}...`);
  
  try {
    const { execSync } = require('child_process');
    
    // Check if group with target GID exists
    let groupExists = false;
    try {
      execSync(`getent group ${pgid}`, { encoding: 'utf-8' });
      groupExists = true;
      logger.debug({ pgid }, 'Group with target GID already exists');
    } catch (e) {
      // Group doesn't exist
    }
    
    // Create or modify group
    if (!groupExists) {
      // Remove existing nodejs group and create with target GID
      try {
        execSync('delgroup nodejs', { encoding: 'utf-8' });
      } catch (e) {
        // Group might not exist, that's okay
      }
      execSync(`addgroup -g ${pgid} -S nodejs`, { encoding: 'utf-8' });
      logger.info({ pgid }, 'Created group with target GID');
      console.log(`Created group 'nodejs' with GID=${pgid}`);
    }
    
    // Check if user with target UID exists
    let userExists = false;
    try {
      execSync(`getent passwd ${puid}`, { encoding: 'utf-8' });
      userExists = true;
      logger.debug({ puid }, 'User with target UID already exists');
    } catch (e) {
      // User doesn't exist
    }
    
    // Create or modify user
    if (!userExists) {
      // Remove existing nextjs user and create with target UID
      try {
        execSync('deluser nextjs', { encoding: 'utf-8' });
      } catch (e) {
        // User might not exist, that's okay
      }
      execSync(`adduser -u ${puid} -S nextjs -G nodejs`, { encoding: 'utf-8' });
      logger.info({ puid }, 'Created user with target UID');
      console.log(`Created user 'nextjs' with UID=${puid}`);
    }
    
    logger.info({ puid, pgid }, 'User setup complete');
    
  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      puid,
      pgid,
      stack: error.stack 
    }, 'Failed to setup user');
    
    console.error('\n❌ Failed to setup user:', error.message);
    throw new Error(`Failed to setup user: ${error.message}`);
  }
}

/**
 * Fix ownership of application directories
 * 
 * Ensures the application user can write to required directories:
 * - /app/data (Tome database and backups)
 * - /calibre (Calibre library, if writable)
 * 
 * Attempts to fix permissions even on network filesystems, logging warnings
 * if unsuccessful but continuing anyway (may still work).
 * 
 * @throws Error if critical directory permission fix fails
 */
async function fixPermissions(puid: number, pgid: number): Promise<void> {
  logger.info({ puid, pgid }, 'Fixing directory permissions');
  console.log(`Fixing directory permissions for UID=${puid}, GID=${pgid}...`);
  
  try {
    const { execSync } = require('child_process');
    
    // Fix /app/data ownership (critical)
    if (existsSync(config.dataDir)) {
      logger.info({ dir: config.dataDir, puid, pgid }, 'Fixing /app/data ownership');
      try {
        execSync(`chown -R ${puid}:${pgid} ${config.dataDir}`, { encoding: 'utf-8' });
        console.log(`✓ Fixed ownership of ${config.dataDir}`);
      } catch (error: any) {
        // Log warning but continue (might work anyway on some filesystems)
        logger.warn({ 
          error: error.message,
          dir: config.dataDir 
        }, 'Failed to chown data directory (may work anyway)');
        console.warn(`⚠ Warning: Could not change ownership of ${config.dataDir}`);
        console.warn('  This may cause permission errors, especially on network filesystems.');
      }
    }
    
    // Fix /app/.next ownership (critical for prerender cache writes)
    // Next.js writes to .next/cache and .next/server/app when using revalidatePath()
    // Recursive chown handles all subdirectories
    const nextJsDir = '/app/.next';
    if (existsSync(nextJsDir)) {
      logger.info({ dir: nextJsDir, puid, pgid }, 'Fixing /app/.next ownership for cache writes');
      try {
        execSync(`chown -R ${puid}:${pgid} ${nextJsDir}`, { encoding: 'utf-8' });
        console.log(`✓ Fixed ownership of ${nextJsDir}`);
      } catch (error: any) {
        // Log warning but continue (may work anyway on some filesystems)
        logger.warn({ 
          error: error.message,
          dir: nextJsDir 
        }, 'Failed to chown .next directory (may cause cache write errors)');
        console.warn(`⚠ Warning: Could not change ownership of ${nextJsDir}`);
        console.warn('  Next.js prerender cache updates may fail.');
      }
    }
    
    // Fix /calibre ownership if it exists and is writable (best effort)
    const calibrePath = '/calibre';
    if (existsSync(calibrePath)) {
      try {
        // Check if we can write to it
        accessSync(calibrePath, constants.W_OK);
        logger.info({ dir: calibrePath, puid, pgid }, 'Fixing /calibre ownership');
        execSync(`chown -R ${puid}:${pgid} ${calibrePath}`, { encoding: 'utf-8' });
        console.log(`✓ Fixed ownership of ${calibrePath}`);
      } catch (error: any) {
        // Calibre might be read-only or on network mount, that's okay
        logger.debug({ 
          error: error.message,
          dir: calibrePath 
        }, 'Could not fix /calibre ownership (may be read-only)');
        console.log(`ℹ /calibre mount is read-only or not writable (this is okay for read-only Calibre access)`);
      }
    }
    
    logger.info('Permission fixes complete');
    
  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      puid,
      pgid,
      stack: error.stack 
    }, 'Failed to fix permissions');
    
    console.error('\n❌ Failed to fix permissions:', error.message);
    throw new Error(`Failed to fix permissions: ${error.message}`);
  }
}

/**
 * Drop privileges and re-execute entrypoint as target user
 * 
 * Uses su-exec to replace the current process with a new one running as
 * the specified UID/GID. The entrypoint will then continue with normal
 * startup flow (migrations, app start) as the non-root user.
 * 
 * This function never returns - the process is replaced via exec.
 */
async function dropPrivileges(puid: number, pgid: number): Promise<never> {
  logger.info({ puid, pgid }, 'Dropping privileges and re-executing as target user');
  console.log(`\nDropping privileges to UID=${puid}, GID=${pgid}...`);
  console.log('Re-executing entrypoint as non-root user...\n');
  
  try {
    const { execFileSync } = require('child_process');
    
    // Set environment variable to indicate we've already handled PUID/PGID
    process.env.PUID_PGID_HANDLED = '1';
    
    // Use su-exec to drop privileges and re-exec
    // su-exec replaces the current process, so this never returns
    execFileSync(
      'su-exec',
      [`${puid}:${pgid}`, 'npx', 'tsx', 'scripts/entrypoint.ts'],
      { 
        stdio: 'inherit',
        env: process.env,
      }
    );
    
    // This code is unreachable, but TypeScript requires it
    throw new Error('su-exec should have replaced the process');
    
  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      puid,
      pgid,
      stack: error.stack 
    }, 'Failed to drop privileges');
    
    console.error('\n❌ Failed to drop privileges:', error.message);
    console.error('This indicates a problem with su-exec or process execution.');
    process.exit(1);
  }
}

/**
 * Display ASCII art banner with version information
 */
async function showBanner(): Promise<void> {
  try {
    // Try multiple locations for package.json
    let version = 'unknown';
    const paths = [
      './package.json',
      '/app/package.json',
      '../package.json',
    ];
    
    for (const pkgPath of paths) {
      try {
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          version = pkg.version;
          break;
        }
      } catch (err) {
        // Continue to next path
      }
    }
    
    const uid = process.getuid ? process.getuid() : 'unknown';
    const gid = process.getgid ? process.getgid() : 'unknown';
    
    console.log(`
============================================

   ████████╗ ██████╗ ███╗   ███╗███████╗
   ╚══██╔══╝██╔═══██╗████╗ ████║██╔════╝
      ██║   ██║   ██║██╔████╔██║█████╗  
      ██║   ██║   ██║██║╚██╔╝██║██╔══╝  
      ██║   ╚██████╔╝██║ ╚═╝ ██║███████╗
      ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚══════╝

              Version: ${version}
            UID=${uid}, GID=${gid}

============================================
`);
  } catch (error: any) {
    // Banner is nice-to-have, don't fail if it can't be displayed
    logger.debug({ error: error.message }, 'Failed to display banner');
  }
}

/**
 * Ensure data directory exists and is writable
 * 
 * Creates the directory if it doesn't exist and validates write permissions.
 * Provides helpful error messages for common Docker volume permission issues.
 * 
 * @throws Error if directory cannot be created or is not writable
 */
async function ensureDataDirectory(): Promise<void> {
  logger.info({ dataDir: config.dataDir }, 'Ensuring data directory exists');
  
  // Create directory if it doesn't exist
  if (!existsSync(config.dataDir)) {
    logger.info({ dataDir: config.dataDir }, 'Creating data directory');
    try {
      mkdirSync(config.dataDir, { recursive: true });
      logger.info({ dataDir: config.dataDir }, 'Data directory created');
    } catch (error: any) {
      logger.fatal({ 
        error: error.message, 
        dataDir: config.dataDir,
        stack: error.stack 
      }, 'Failed to create data directory');
      
      console.error('\nERROR: Failed to create data directory:', config.dataDir);
      console.error('This usually indicates a permission problem.');
      console.error('\nTroubleshooting:');
      console.error('  1. Ensure Docker volume has correct permissions');
      console.error('  2. Run container with correct user: --user 1001:1001');
      console.error('  3. Or run with: docker run --user $(id -u):$(id -g) ...');
      
      throw new Error(`Failed to create data directory: ${config.dataDir}`);
    }
  }
  
  // Verify directory is writable
  try {
    accessSync(config.dataDir, constants.W_OK);
    logger.info({ dataDir: config.dataDir }, 'Data directory ready');
  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      dataDir: config.dataDir 
    }, 'Data directory is not writable');
    
    console.error('\nERROR: Data directory is not writable:', config.dataDir);
    
    // Try to provide helpful diagnostics
    try {
      const { execSync } = require('child_process');
      const userId = execSync('id', { encoding: 'utf-8' });
      console.error('Current user:', userId.trim());
      
      try {
        const perms = execSync(`ls -ld "${config.dataDir}"`, { encoding: 'utf-8' });
        console.error('Directory permissions:', perms.trim());
      } catch (e) {
        console.error('Cannot read directory permissions');
      }
    } catch (e) {
      // Best effort diagnostics
    }
    
    console.error('\nThis is usually caused by Docker volume mount permission issues.');
    console.error('Solutions:');
    console.error('  1. Ensure Docker volume has correct permissions');
    console.error('  2. Run container with correct user: --user 1001:1001');
    console.error('  3. Or run with: docker run --user $(id -u):$(id -g) ...');
    
    throw new Error(`Data directory is not writable: ${config.dataDir}`);
  }
}

/**
 * Create database backup(s) before running migrations
 * 
 * Backs up Tome database and optionally Calibre database if configured.
 * Skips backup on first run (database doesn't exist yet).
 * 
 * @throws Error if backup fails
 */
async function backupDatabase(): Promise<void> {
  // Skip backup if database doesn't exist (first run)
  if (!existsSync(config.databasePath)) {
    logger.info({
      databasePath: config.databasePath
    }, 'Database not found (first run), skipping backup');
    console.log('Database not found (first run), skipping backup');
    return;
  }

  logger.info('Creating database backup(s)');
  console.log('Creating database backup(s)...');

  try {
    const { createBackups } = await import('@/lib/db/backup');
    const result = await createBackups();
    
    if (!result.tome.success) {
      throw new Error(result.tome.error || 'Backup failed');
    }
    
    logger.info({ 
      tomeBackup: result.tome.backupSize,
      tomeBackupPath: result.tome.backupPath,
      calibreBackup: result.calibre?.backupSize,
      calibreBackupPath: result.calibre?.backupPath,
      hasWal: result.tome.hasWal,
      hasShm: result.tome.hasShm,
    }, 'Backup(s) created successfully');
    
    console.log(`Tome backup created: ${result.tome.backupSize}`);
    if (result.calibre?.success) {
      console.log(`Calibre backup created: ${result.calibre.backupSize}`);
    }
    
  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      stack: error.stack 
    }, 'Backup failed');
    
    console.error('\n❌ Backup failed:', error.message);
    throw new Error(`Backup failed: ${error.message}`);
  }
}

/**
 * Run database migrations with exponential backoff retry
 * 
 * Attempts migrations up to maxRetries times with exponential backoff.
 * Logs detailed information about each attempt.
 * 
 * @throws Error if all retry attempts fail
 */
async function runMigrationsWithRetry(): Promise<void> {
  console.log('\n=== Database Migration Process ===\n');

  const { runMigrations } = await import('@/lib/db/migrate');

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    logger.info({
      attempt,
      maxRetries: config.maxRetries
    }, `Migration attempt ${attempt} of ${config.maxRetries}`);

    console.log(`Migration attempt ${attempt} of ${config.maxRetries}...`);

    try {
      await runMigrations();
      
      logger.info('Migrations completed successfully');
      console.log('Migrations completed successfully');
      return;
      
    } catch (error: any) {
      logger.error({ 
        attempt,
        error: error.message,
        stack: error.stack 
      }, `Migration attempt ${attempt} failed`);
      
      console.error(`Migration attempt ${attempt} failed:`, error.message);
      
      if (attempt < config.maxRetries) {
        // Exponential backoff: delay * 2^(attempt-1)
        const delay = config.retryDelay * Math.pow(2, attempt - 1);
        
        logger.info({ delay, nextAttempt: attempt + 1 }, `Retrying in ${delay}ms`);
        console.log(`Retrying in ${delay / 1000} seconds...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.fatal({ totalAttempts: attempt }, 'All migration attempts failed');
        console.error(`\n❌ All migration attempts failed after ${attempt} attempts`);
        throw new Error(`Migration failed after ${attempt} attempts: ${error.message}`);
      }
    }
  }
}

/**
 * Seed demo database if needed (NODE_ENV=demo)
 *
 * Checks if the database already has books (seeding already done) and seeds
 * the database from the Calibre library if not. This is called when the
 * container is run with NODE_ENV=demo.
 */
async function seedDemoIfNeeded(): Promise<void> {
  console.log('\n=== Demo Database Seeding ===\n');

  // Check if database already has books (seeding already done)
  const { db } = await import('@/lib/db/sqlite');
  const { books } = await import('@/lib/db/schema');
  const { count } = await import('drizzle-orm');

  const result = await db.select({ count: count() }).from(books);
  const bookCount = result[0]?.count ?? 0;

  if (bookCount > 0) {
    logger.info({ bookCount }, 'Demo database already seeded, skipping');
    console.log(`Database already has ${bookCount} books, skipping seeding`);
    return;
  }

  // Check for CALIBRE_DB_PATH
  if (!process.env.CALIBRE_DB_PATH) {
    logger.warn('CALIBRE_DB_PATH not set, skipping demo seeding');
    console.log('Warning: CALIBRE_DB_PATH not set, skipping demo seeding');
    return;
  }

  logger.info('Seeding demo database from Calibre library...');
  console.log('Seeding demo database from Calibre library...');

  const { seedDatabase } = await import('@/lib/db/seeders');
  const seedResult = await seedDatabase();

  if (seedResult.success) {
    logger.info({
      booksFromSync: seedResult.booksFromSync,
      sessionsSeeded: seedResult.sessionsSeeded,
    }, 'Demo seeding completed');
    console.log(`Demo seeding complete: ${seedResult.booksFromSync} books, ${seedResult.sessionsSeeded} sessions`);
  } else {
    logger.error({ error: seedResult.error }, 'Demo seeding failed');
    console.error('Demo seeding failed:', seedResult.error);
    // Don't throw - allow app to start even if seeding fails
  }
}

/**
 * Start the Next.js application as a child process
 *
 * Spawns node server.js and forwards all stdio.
 * Sets up signal handlers for graceful shutdown.
 *
 * @returns Never returns (process exits when app exits)
 */
async function startApplication(): Promise<never> {
  console.log('\n=== Starting Application ===\n');
  logger.info({ 
    port: config.port, 
    hostname: config.hostname 
  }, 'Starting Next.js application');
  
  console.log(`Starting application on ${config.hostname}:${config.port}...`);
  
  const app: ChildProcess = spawn('node', ['server.js'], {
    stdio: 'inherit', // Forward stdin, stdout, stderr
    env: process.env,
  });
  
  // Graceful shutdown on SIGTERM (docker stop)
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    
    if (app.pid) {
      app.kill('SIGTERM');
    }
  });
  
  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    console.log('\nReceived SIGINT, shutting down gracefully...');
    
    if (app.pid) {
      app.kill('SIGINT');
    }
  });
  
  // Exit when application exits
  app.on('exit', (code, signal) => {
    const exitCode = code ?? 0;
    
    logger.info({ 
      exitCode, 
      signal 
    }, `Application exited with code ${exitCode}`);
    
    if (exitCode !== 0) {
      console.error(`\nApplication exited with code ${exitCode}`);
    }
    
    process.exit(exitCode);
  });
  
  // Handle spawn errors
  app.on('error', (error) => {
    logger.fatal({ error: error.message }, 'Failed to start application');
    console.error('\n❌ Failed to start application:', error.message);
    process.exit(1);
  });
  
  // This function never returns - it exits via the app.on('exit') handler
  return new Promise(() => {}) as never;
}

/**
 * Main entrypoint execution flow
 *
 * Orchestrates the entire startup sequence:
 *
 * If running as root (initial startup):
 * 1. Display banner
 * 2. Setup user with PUID/PGID
 * 3. Fix directory permissions
 * 4. Drop privileges and re-exec as target user
 *
 * If running as target user (after privilege drop):
 * 1. Display banner
 * 2. Validate data directory
 * 3. Database backup
 * 4. Migrations
 * 5. Demo seeding (if NODE_ENV=demo)
 * 6. Application startup
 *
 * Exits with code 1 on any failure.
 */
async function main(): Promise<never> {
  try {
    // Check if we're running as root and haven't handled PUID/PGID yet
    if (isRunningAsRoot() && !process.env.PUID_PGID_HANDLED) {
      // Running as root - handle PUID/PGID setup
      await showBanner();
      
      logger.info({ 
        puid: config.puid, 
        pgid: config.pgid 
      }, 'Running as root, setting up PUID/PGID');
      
      console.log('Container starting as root for user setup...');
      
      // Setup user and group
      await setupUser(config.puid, config.pgid);
      
      // Fix directory permissions
      await fixPermissions(config.puid, config.pgid);
      
      // Drop privileges and re-exec (never returns)
      return await dropPrivileges(config.puid, config.pgid);
    }
    
    // Running as target user - continue normal flow
    await showBanner();
    
    logger.info({ 
      uid: process.getuid ? process.getuid() : 'unknown',
      gid: process.getgid ? process.getgid() : 'unknown'
    }, 'Running as target user, continuing startup');
    
    // Validate data directory
    await ensureDataDirectory();
    
    // Create backup before migrations
    await backupDatabase();
    
    // Run migrations with retry
    await runMigrationsWithRetry();

    // Seed demo database if NODE_ENV=demo
    if ((process.env.NODE_ENV as string) === 'demo') {
      await seedDemoIfNeeded();
    }

    // Start the application (never returns)
    return await startApplication();
    
  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      stack: error.stack 
    }, 'Entrypoint failed');
    
    console.error('\n❌ Entrypoint failed:', error.message);
    console.error('\nSee logs above for details.');
    
    process.exit(1);
  }
}

// Run main if this is the entry point
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export functions for testing
export {
  getEntrypointConfig as getConfig,
  showBanner,
  ensureDataDirectory,
  backupDatabase,
  runMigrationsWithRetry,
  seedDemoIfNeeded,
  startApplication,
};
