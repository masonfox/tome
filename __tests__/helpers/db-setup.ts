import { sqlite } from "@/lib/db/sqlite";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import { __registerTestDatabase, __unregisterTestDatabase } from "@/lib/db/context";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/lib/db/schema";

/**
 * Test database setup and teardown utilities for SQLite
 * Each test file gets its own unique in-memory database for parallel execution
 */

// Map to track databases per test file (keyed by file path)
const databases = new Map<string, { db: any; sqlite: any }>();

/**
 * Get the test file path from the call stack
 * DEPRECATED: Use explicit testFilePath parameter instead
 * Kept for backwards compatibility during migration
 */
function getTestFilePathLegacy(): string {
  const stack = new Error().stack || "";
  const lines = stack.split("\n");

  // Find the first line that contains __tests__/ and extract the file path
  for (const line of lines) {
    const match = line.match(/\((.+__tests__.+\.test\.ts):\d+:\d+\)/);
    if (match) {
      return match[1];
    }
  }

  // Fallback: generate a random ID if we can't determine the file path
  return `unknown-${Math.random()}`;
}

/**
 * Setup: SQLite test database and run migrations
 * Call this in beforeAll()
 * Creates a unique database for each test file to enable parallel execution
 *
 * @param testFilePath - Explicit path to test file (use __filename or import.meta.url)
 */
export async function setupTestDatabase(testFilePath?: string): Promise<void> {
  // Use explicit path if provided, otherwise fall back to legacy stack parsing
  const resolvedPath = testFilePath || getTestFilePathLegacy();

  // Check if already setup for this test file
  if (databases.has(resolvedPath)) {
    return;
  }

  // Create separate test database in memory for complete isolation
  const testSqlite = new Database(":memory:");
  testSqlite.exec("PRAGMA foreign_keys = ON");
  testSqlite.exec("PRAGMA journal_mode = WAL");

  const testDb = drizzle(testSqlite, { schema });
  console.log(`Test database created for: ${resolvedPath}`);

  // Store the database for this test file
  databases.set(resolvedPath, { db: testDb, sqlite: testSqlite });

  // Register the test database so getDatabase() can find it via call stack
  __registerTestDatabase(resolvedPath, testDb);

  // Run migrations on test database - pass the Drizzle instance, not the raw SQLite
  await runMigrationsOnDatabase(testDb);
}

/**
 * Teardown the test database
 * Call this in afterAll()
 *
 * @param testFilePath - Explicit path to test file (use __filename or import.meta.url)
 */
export async function teardownTestDatabase(testFilePath?: string): Promise<void> {
  const resolvedPath = testFilePath || getTestFilePathLegacy();

  // Clean up the database for this test file
  if (databases.has(resolvedPath)) {
    const { sqlite } = databases.get(resolvedPath)!;
    sqlite.close();
    databases.delete(resolvedPath);
  }

  // Unregister the test database
  __unregisterTestDatabase(resolvedPath);
}

/**
 * Clear all data from the test database
 * Call this in beforeEach() or afterEach() to reset state between tests
 * IMPORTANT: Order matters due to foreign key constraints
 *
 * @param testFilePath - Explicit path to test file (use __filename or import.meta.url)
 */
export async function clearTestDatabase(testFilePath?: string): Promise<void> {
  const resolvedPath = testFilePath || getTestFilePathLegacy();
  const dbEntry = databases.get(resolvedPath);

  if (!dbEntry) {
    throw new Error(`No test database found for ${resolvedPath}. Did you call setupTestDatabase()?`);
  }

  const { db } = dbEntry;

  // Delete in order that respects foreign key constraints
  // Children first, then parents
  db.delete(schema.progressLogs).run();
  db.delete(schema.readingSessions).run();
  db.delete(schema.books).run();
  db.delete(schema.streaks).run();
}

/**
 * Get a direct reference to the test database
 * Useful for debugging or advanced test setup
 *
 * @param testFilePath - Explicit path to test file (use __filename or import.meta.url)
 */
export function getTestDatabase(testFilePath?: string) {
  const resolvedPath = testFilePath || getTestFilePathLegacy();
  const dbEntry = databases.get(resolvedPath);

  if (!dbEntry) {
    return sqlite;
  }

  return dbEntry.db;
}

/**
 * Get the raw SQLite instance for the test database
 * Useful for executing raw SQL
 *
 * @param testFilePath - Explicit path to test file (use __filename or import.meta.url)
 */
export function getTestSqlite(testFilePath?: string) {
  const resolvedPath = testFilePath || getTestFilePathLegacy();
  const dbEntry = databases.get(resolvedPath);

  if (!dbEntry) {
    throw new Error(`No test database found for ${resolvedPath}. Did you call setupTestDatabase()?`);
  }

  return dbEntry.sqlite;
}