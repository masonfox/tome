/**
 * Database Factory Module
 *
 * Centralizes SQLite database configuration using better-sqlite3.
 * Provides a consistent interface for creating database connections.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getLogger } from "@/lib/logger";

export interface DatabaseConfig {
  /** Path to database file, or ":memory:" for in-memory database */
  path: string;
  /** Drizzle schema for type-safe queries (optional) */
  schema?: any;
  /** Enable WAL mode (default: true for file-based, false for in-memory) */
  wal?: boolean;
  /** Enable foreign keys (default: true) */
  foreignKeys?: boolean;
  /** Create database if it doesn't exist (default: true) */
  create?: boolean;
  /** Open database in read-only mode (default: false) */
  readonly?: boolean;
}

export interface DatabaseInstance<TSchema = any> {
  /** Drizzle ORM instance */
  db: any;
  /** Raw SQLite instance (better-sqlite3) */
  sqlite: Database.Database;
}

/**
 * Create a SQLite database instance with better-sqlite3
 *
 * @param config - Database configuration
 * @returns Database instance with drizzle ORM and raw sqlite connection
 *
 * @example
 * // File-based database with schema
 * const { db, sqlite } = createDatabase({
 *   path: './data/tome.db',
 *   schema: mySchema
 * });
 *
 * @example
 * // In-memory database for testing
 * const { db, sqlite } = createDatabase({
 *   path: ':memory:',
 *   schema: mySchema,
 *   wal: false
 * });
 *
 * @example
 * // Calibre database (read-only, no schema)
 * const { db, sqlite } = createDatabase({
 *   path: '/calibre/metadata.db',
 *   readonly: true
 * });
 */
export function createDatabase<TSchema = any>(
  config: DatabaseConfig
): DatabaseInstance<TSchema> {
  const {
    path,
    schema,
    wal = path !== ':memory:', // WAL mode for file-based, DELETE for in-memory
    foreignKeys = true,
    readonly = false,
  } = config;

  // Create database instance using better-sqlite3
  const options: Database.Options = {};
  if (readonly) {
    options.readonly = true;
  }
  
  const sqlite = new Database(path, options);

  // Configure PRAGMA settings (skip for readonly)
  if (!readonly) {
    if (foreignKeys) {
      sqlite.pragma('foreign_keys = ON');
    }
    if (wal) {
      sqlite.pragma('journal_mode = WAL');
    } else {
      sqlite.pragma('journal_mode = DELETE');
    }
  }

  // Create drizzle instance
  const db = schema ? drizzle(sqlite, { schema }) : drizzle(sqlite);

  return { db, sqlite };
}

/**
 * Test database connection
 */
export function testDatabaseConnection(sqlite: Database.Database): boolean {
  try {
    const result = sqlite.prepare('SELECT 1 as test').get() as { test: number };
    return result.test === 1;
  } catch (error) {
    getLogger().error({ err: error }, 'Database connection test failed');
    return false;
  }
}

/**
 * Close database connection gracefully
 */
export function closeDatabaseConnection(sqlite: Database.Database): void {
  try {
    sqlite.close();
    getLogger().info('Database connection closed');
  } catch (error) {
    getLogger().error({ err: error }, 'Error closing database connection');
  }
}
