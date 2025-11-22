import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { createDatabase, detectRuntime, testDatabaseConnection, closeDatabaseConnection } from "./factory";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/tome.db";

// Check if we're in test mode or build mode - skip production database initialization
const isBun = detectRuntime() === 'bun';
const isTest = isBun ? Bun.env.BUN_ENV === 'test' : process.env.NODE_ENV === 'test';
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

let sqlite: any;
let db: any;

if (!isTest && !isBuild) {
  // Only initialize production database when not in test mode or build phase
  // Create data directory if it doesn't exist
  const dataDir = dirname(DATABASE_PATH);
  try {
    mkdirSync(dataDir, { recursive: true });
    console.log(`Data directory verified: ${dataDir}`);
  } catch (err: any) {
    console.error(`CRITICAL: Failed to create data directory: ${dataDir}`);
    console.error(`Error: ${err.message}`);
    console.error(`This usually indicates a permission problem.`);
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

  console.log(`Using ${instance.runtime === 'bun' ? 'bun:sqlite' : 'better-sqlite3'} for Tome database`);
} else {
  // In test/build mode, return null/undefined - tests will use their own in-memory databases
  sqlite = null;
  db = null;
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

// Handle process termination
if (typeof process !== "undefined") {
  process.on("exit", closeConnection);
  process.on("SIGINT", () => {
    closeConnection();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    closeConnection();
    process.exit(0);
  });
}

export default db;
