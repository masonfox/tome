/**
 * Database context management
 * Allows switching between production and test database instances
 * This is used internally by the test infrastructure but doesn't depend on test files
 *
 * Uses AsyncLocalStorage for reliable database context tracking across async boundaries,
 * with fallback to call stack inspection for backwards compatibility.
 */

import { AsyncLocalStorage } from "async_hooks";
import { db } from "./sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

// Internal registry for test databases (populated by test infrastructure)
const testDatabases = new Map<string, BunSQLiteDatabase>();

// AsyncLocalStorage for tracking current test context
const testContext = new AsyncLocalStorage<{ testFilePath: string; database: BunSQLiteDatabase }>();

// Global fallback for test database (used when stack traces fail)
// NOTE: This prevents true parallel execution - requires process isolation to remove
let currentTestDatabase: BunSQLiteDatabase | null = null;

/**
 * Register a test database for a specific test file
 * Used internally by test infrastructure - do not call directly
 */
export function __registerTestDatabase(testFilePath: string, database: BunSQLiteDatabase) {
  testDatabases.set(testFilePath, database);
  currentTestDatabase = database;
}

/**
 * Unregister a test database for a specific test file
 * Used internally by test infrastructure - do not call directly
 */
export function __unregisterTestDatabase(testFilePath: string) {
  testDatabases.delete(testFilePath);
  if (testDatabases.size === 0) {
    currentTestDatabase = null;
  }
}

/**
 * Get the test file path from the call stack
 * Returns null if not called from a test file
 */
function getTestFilePathFromStack(): string | null {
  const stack = new Error().stack || "";
  const lines = stack.split("\n");

  // Look for any stack frame that contains __tests__ and .test.ts
  // This handles both sync and async stack frames
  for (const line of lines) {
    if (line.includes("__tests__") && line.includes(".test.ts")) {
      // Extract the file path from various stack frame formats:
      // 1. (path:line:col)
      // 2. at functionName (path:line:col)
      // 3. at async <anonymous> (path:line:col)
      const pathMatch = line.match(/\((.+?__tests__.+?\.test\.ts):\d+:\d+\)/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }
  }

  return null;
}

/**
 * Set the current database instance (deprecated - no-op for backwards compatibility)
 */
export function setDatabase(database: BunSQLiteDatabase | null) {
  // No-op: database context is now determined by call stack
}

/**
 * Run a function with a specific test database context
 * Used internally by test infrastructure
 */
export function runWithTestContext<T>(
  testFilePath: string,
  database: BunSQLiteDatabase,
  fn: () => T
): T {
  return testContext.run({ testFilePath, database }, fn);
}

/**
 * Get the current database instance
 * In tests: returns the database from AsyncLocalStorage, stack inspection, or global fallback
 * In production: returns the production database
 */
export function getDatabase(): BunSQLiteDatabase {
  // Tier 1: Try AsyncLocalStorage first (most reliable for async contexts)
  const context = testContext.getStore();
  if (context) {
    return context.database;
  }

  // Tier 2: Fall back to stack inspection (works when called directly from test)
  const testFilePath = getTestFilePathFromStack();
  if (testFilePath && testDatabases.has(testFilePath)) {
    return testDatabases.get(testFilePath)!;
  }

  // Tier 3: Global fallback (works for serial execution, prevents parallel execution)
  // NOTE: This is the blocker for true parallel execution
  if (currentTestDatabase && process.env.NODE_ENV === 'test') {
    return currentTestDatabase;
  }

  // Production mode: return production database
  return db;
}
