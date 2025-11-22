import { sqlite } from "@/lib/db/sqlite";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import { __registerTestDatabase, __unregisterTestDatabase } from "@/lib/db/context";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/lib/db/schema";

/**
 * Test database setup and teardown utilities for SQLite
 * Supports both DI pattern (recommended) and legacy string-based API (backward compatible)
 */

export type TestDatabaseInstance = {
  db: any;
  sqlite: any;
  testFilePath: string;
};

// Map to track databases per test file (keyed by file path)
const databases = new Map<string, TestDatabaseInstance>();

/**
 * Setup: SQLite test database and run migrations
 * Call this in beforeAll()
 * Returns the database instance to be stored and passed to cleanup functions
 *
 * @param testFilePath - Explicit path to test file (use __filename)
 * @returns Database instance to be passed to clear/teardown functions (DI pattern)
 */
export async function setupTestDatabase(testFilePath: string): Promise<TestDatabaseInstance> {
  // Check if already setup for this test file
  if (databases.has(testFilePath)) {
    console.log(`Test database already exists for: ${testFilePath}`);
    return databases.get(testFilePath)!;
  }

  // Create separate test database in memory for complete isolation
  const testSqlite = new Database(":memory:");
  testSqlite.exec("PRAGMA foreign_keys = ON");
  testSqlite.exec("PRAGMA journal_mode = WAL");

  const testDb = drizzle(testSqlite, { schema });
  console.log(`Test database created for: ${testFilePath}`);

  const instance: TestDatabaseInstance = {
    db: testDb,
    sqlite: testSqlite,
    testFilePath,
  };

  // Store the database for this test file
  databases.set(testFilePath, instance);

  // Register the test database so getDatabase() can find it via call stack
  __registerTestDatabase(testFilePath, testDb);

  // Run migrations on test database
  await runMigrationsOnDatabase(testDb);

  return instance;
}

/**
 * Teardown the test database
 * Call this in afterAll()
 *
 * @param dbInstanceOrPath - Database instance (DI) or file path (legacy)
 */
export async function teardownTestDatabase(dbInstanceOrPath: TestDatabaseInstance | string): Promise<void> {
  let testFilePath: string;
  let sqlite: any;

  if (typeof dbInstanceOrPath === 'string') {
    // Legacy API: string path
    const instance = databases.get(dbInstanceOrPath);
    if (!instance) {
      console.warn(`No test database found for ${dbInstanceOrPath}`);
      return;
    }
    testFilePath = instance.testFilePath;
    sqlite = instance.sqlite;
  } else {
    // DI API: instance object
    testFilePath = dbInstanceOrPath.testFilePath;
    sqlite = dbInstanceOrPath.sqlite;
  }

  // Clean up the database
  sqlite.close();
  databases.delete(testFilePath);

  // Unregister the test database
  __unregisterTestDatabase(testFilePath);
}

/**
 * Clear all data from the test database
 * Call this in beforeEach() to reset state between tests
 * IMPORTANT: Order matters due to foreign key constraints
 *
 * @param dbInstanceOrPath - Database instance (DI) or file path (legacy)
 */
export async function clearTestDatabase(dbInstanceOrPath: TestDatabaseInstance | string): Promise<void> {
  let db: any;
  let testFilePath: string;

  if (typeof dbInstanceOrPath === 'string') {
    // Legacy API: string path
    const instance = databases.get(dbInstanceOrPath);
    if (!instance) {
      throw new Error(`No test database found for ${dbInstanceOrPath}. Did you call setupTestDatabase()?`);
    }
    db = instance.db;
    testFilePath = instance.testFilePath;
  } else {
    // DI API: instance object
    db = dbInstanceOrPath.db;
    testFilePath = dbInstanceOrPath.testFilePath;
  }

  console.log(`[clearTestDatabase] Clearing database for: ${testFilePath}`);

  // Delete in order that respects foreign key constraints
  // Children first, then parents
  const progressResult = db.delete(schema.progressLogs).run();
  const sessionsResult = db.delete(schema.readingSessions).run();
  const booksResult = db.delete(schema.books).run();
  const streaksResult = db.delete(schema.streaks).run();

  console.log(
    `[clearTestDatabase] Deleted: ${progressResult.changes} progress, ` +
    `${sessionsResult.changes} sessions, ${booksResult.changes} books, ` +
    `${streaksResult.changes} streaks`
  );

  // Verify tables are empty after clearing (warn but don't throw to avoid breaking tests)
  const streakCount = db.select().from(schema.streaks).all().length;
  if (streakCount > 0) {
    console.error(`[clearTestDatabase] WARNING: ${streakCount} streaks remain after clearing for ${testFilePath}!`);
    // Log more details about what wasn't cleared
    const allStreaks = db.select().from(schema.streaks).all();
    console.error(`[clearTestDatabase] Remaining streaks:`, JSON.stringify(allStreaks, null, 2));
  }
}

/**
 * Get a direct reference to the test database
 * Useful for debugging or advanced test setup
 *
 * @param testFilePath - Explicit path to test file (use __filename)
 */
export function getTestDatabase(testFilePath: string) {
  const dbEntry = databases.get(testFilePath);

  if (!dbEntry) {
    return sqlite;
  }

  return dbEntry.db;
}

/**
 * Get the raw SQLite instance for the test database
 * Useful for executing raw SQL
 *
 * @param testFilePath - Explicit path to test file (use __filename)
 */
export function getTestSqlite(testFilePath: string) {
  const dbEntry = databases.get(testFilePath);

  if (!dbEntry) {
    throw new Error(`No test database found for ${testFilePath}. Did you call setupTestDatabase()?`);
  }

  return dbEntry.sqlite;
}