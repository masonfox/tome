/**
 * Database Factory Module
 *
 * Centralizes SQLite driver selection and configuration logic.
 * Supports both bun:sqlite (Bun runtime) and better-sqlite3 (Node.js runtime).
 *
 * This module eliminates duplicated runtime detection across the codebase.
 */

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
  db: TSchema extends undefined ? any : ReturnType<typeof createDrizzle<TSchema>>;
  /** Raw SQLite instance (bun:sqlite Database or better-sqlite3) */
  sqlite: any;
  /** Runtime being used */
  runtime: 'bun' | 'node';
}

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): 'bun' | 'node' {
  return typeof Bun !== 'undefined' ? 'bun' : 'node';
}

/**
 * Create a drizzle instance with the appropriate adapter
 */
function createDrizzle<TSchema>(sqlite: any, schema: TSchema | undefined, runtime: 'bun' | 'node') {
  if (runtime === 'bun') {
    const { drizzle } = require('drizzle-orm/bun-sqlite');
    return schema ? drizzle(sqlite, { schema }) : drizzle(sqlite);
  } else {
    const { drizzle } = require('drizzle-orm/better-sqlite3');
    return schema ? drizzle(sqlite, { schema }) : drizzle(sqlite);
  }
}

/**
 * Create a SQLite database instance with appropriate driver for current runtime
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
 *   path: '/calibre/metadata.db'
 * });
 */
export function createDatabase<TSchema = undefined>(
  config: DatabaseConfig
): DatabaseInstance<TSchema> {
  const {
    path,
    schema,
    wal = path !== ':memory:', // WAL mode for file-based, DELETE for in-memory
    foreignKeys = true,
    create = true,
    readonly = false,
  } = config;

  const runtime = detectRuntime();
  let sqlite: any;

  // Create database instance based on runtime
  if (runtime === 'bun') {
    const { Database } = require('bun:sqlite');
    const options: any = {};
    if (readonly) {
      options.readonly = true;
    } else {
      options.create = create;
    }
    sqlite = new Database(path, options);

    // Configure PRAGMA settings using exec (skip for readonly)
    if (!readonly) {
      if (foreignKeys) {
        sqlite.exec('PRAGMA foreign_keys = ON');
      }
      if (wal) {
        sqlite.exec('PRAGMA journal_mode = WAL');
      } else {
        sqlite.exec('PRAGMA journal_mode = DELETE');
      }
    }
  } else {
    const Database = require('better-sqlite3');
    const options: any = {};
    if (readonly) {
      options.readonly = true;
    }
    sqlite = new Database(path, options);

    // Configure PRAGMA settings using pragma method (skip for readonly)
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
  }

  // Create drizzle instance
  const db = createDrizzle(sqlite, schema, runtime);

  return { db, sqlite, runtime };
}

/**
 * Test database connection
 */
export function testDatabaseConnection(sqlite: any): boolean {
  try {
    const result = sqlite.query ?
      sqlite.query('SELECT 1 as test').get() : // bun:sqlite
      sqlite.prepare('SELECT 1 as test').get(); // better-sqlite3
    return (result as any).test === 1;
  } catch (error) {
    getLogger().error({ err: error }, 'Database connection test failed');
    return false;
  }
}

/**
 * Close database connection gracefully
 */
export function closeDatabaseConnection(sqlite: any): void {
  try {
    sqlite.close();
    getLogger().info('Database connection closed');
  } catch (error) {
    getLogger().error({ err: error }, 'Error closing database connection');
  }
}
