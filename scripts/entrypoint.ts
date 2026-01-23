#!/usr/bin/env node

/**
 * Docker Container Entrypoint (Compiled JS)
 *
 * This script handles application-level startup logic:
 * 1. Display banner with version
 * 2. Ensure data directory exists and is writable
 * 3. Create database backup(s) (skip on first run)
 * 4. Run database migrations with retry logic
 * 5. Seed demo database if NODE_ENV=demo
 * 6. Start Next.js application
 *
 * Docker housekeeping (user setup, permissions, privilege drop) is handled
 * by the shell script docker-entrypoint.sh which runs this script via su-exec.
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
 *   node dist/entrypoint.cjs
 */

// IMPORTANT: Load environment variables BEFORE any imports that might use them
import { config as loadDotenv } from 'dotenv';
loadDotenv();

// NOTE: Database-related imports (createBackups, runMigrations) are dynamically imported
// to avoid module initialization race conditions when the database doesn't exist yet.
// This ensures the entrypoint can create directories before any database code tries
// to initialize connections.

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
  };
}

const config = getEntrypointConfig();
const logger = getLogger();

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
              Version: ${version}
            UID=${uid}, GID=${gid}
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
      console.error('  2. Set PUID/PGID to match your host user');
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
      const { execSync } = await import('child_process');
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
    console.error('  2. Set PUID/PGID to match your host user');
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
 * 1. Display banner (version info)
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
    await showBanner();

    logger.info({
      uid: process.getuid ? process.getuid() : 'unknown',
      gid: process.getgid ? process.getgid() : 'unknown'
    }, 'Starting entrypoint');

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
// Check both CommonJS and ESM entry detection
const isMainModule = typeof require !== 'undefined'
  ? require.main === module
  : import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
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
