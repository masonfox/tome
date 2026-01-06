import * as schema from "./schema";
import { mkdirSync, readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { createDatabase, testDatabaseConnection, closeDatabaseConnection } from "./factory";
import { getLogger } from "@/lib/logger";

// Lazy logger initialization to prevent pino from loading during instrumentation phase
let logger: any = null;
function getLoggerSafe() {
  // In test mode, return no-op logger to avoid require() issues in Vitest
  if (process.env.NODE_ENV === 'test') {
    return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, fatal: () => {} };
  }
  if (!logger) {
    logger = getLogger();
  }
  return logger;
}

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/tome.db";

// Check if we're in test mode or build mode
const isTest = process.env.NODE_ENV === 'test';
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

let sqlite: any;
let db: any;

if (isTest) {
  // In test mode, return null - tests will use their own in-memory databases
  sqlite = null;
  db = null;
} else if (isBuild) {
  // In build mode, use an in-memory database to allow API routes to execute
  getLoggerSafe().info('Build phase: Using in-memory database');
  const instance = createDatabase({
    path: ':memory:',
    schema,
    wal: false,
    foreignKeys: true,
    create: true,
  });
  sqlite = instance.sqlite;
  db = instance.db;

  // Apply migrations to the in-memory database
  try {
    const migrationsPath = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to apply in order

    for (const file of migrationFiles) {
      const sql = readFileSync(join(migrationsPath, file), 'utf-8');
      // Split by --> statement-breakpoint and execute each statement
      const statements = sql
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          sqlite.exec(statement);
        }
      }
    }
    getLoggerSafe().info({ migrationsApplied: migrationFiles.length }, `Build phase: Applied ${migrationFiles.length} migrations to in-memory database`);
  } catch (err: any) {
    getLoggerSafe().error({ err }, 'Build phase: Failed to apply migrations');
    // Don't throw - allow build to continue even if migrations fail
  }
} else {
  // Production mode: use file-based database
  // Create data directory if it doesn't exist
  const dataDir = dirname(DATABASE_PATH);
  try {
    mkdirSync(dataDir, { recursive: true });
    getLoggerSafe().debug({ dataDir }, `Data directory verified: ${dataDir}`);
  } catch (err: any) {
    getLoggerSafe().fatal({ dataDir, err }, `CRITICAL: Failed to create data directory: ${dataDir}`);
    getLoggerSafe().fatal({ err }, `Error creating data directory: ${err.message}`);
    getLoggerSafe().warn({ dataDir }, 'This usually indicates a permission problem.');
    throw new Error(`Cannot initialize database - data directory creation failed: ${err.message}`);
  }

  // Create database using factory
  const instance = createDatabase({
    path: DATABASE_PATH,
    schema,
    wal: true,
    foreignKeys: true,
    create: true,
  });

  sqlite = instance.sqlite;
  db = instance.db;

  getLoggerSafe().debug({ dbPath: DATABASE_PATH }, `Using better-sqlite3 for Tome database`);
}

export { db, sqlite };

// Connection test function (wraps factory function)
export function testConnection(): boolean {
  if (!sqlite) {
    // In test/build mode, no production database to test
    return true;
  }
  return testDatabaseConnection(sqlite);
}

// Graceful shutdown (wraps factory function)
export function closeConnection(): void {
  if (!sqlite) {
    // In test/build mode, no production database to close
    return;
  }
  closeDatabaseConnection(sqlite);
}

// Track if listeners are registered to prevent duplicates
let listenersRegistered = false;

// Handle process termination - only register once
if (typeof process !== "undefined" && !listenersRegistered) {
  process.on("exit", closeConnection);
  process.on("SIGINT", () => {
    closeConnection();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    closeConnection();
    process.exit(0);
  });
  listenersRegistered = true;
}

export default db;
