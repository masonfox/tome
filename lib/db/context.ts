/**
 * Database context management
 * Allows switching between production and test database instances
 * This is used internally by the test infrastructure but doesn't depend on test files
 */

import { db } from "./sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

// Store the current database context (mainly for testing)
let currentDatabase: BunSQLiteDatabase | null = null;

/**
 * Set the current database instance (used by tests)
 */
export function setDatabase(database: BunSQLiteDatabase | null) {
  currentDatabase = database;
}

/**
 * Get the current database instance
 * Returns test database if set, otherwise returns production database
 */
export function getDatabase(): BunSQLiteDatabase {
  return currentDatabase || db;
}
