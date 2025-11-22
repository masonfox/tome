import { sqlite } from "@/lib/db/sqlite";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import { __registerTestDatabase, __unregisterTestDatabase } from "@/lib/db/context";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/lib/db/schema";

/**
 * Test database setup and teardown utilities for SQLite
 * Uses Dependency Injection pattern - returns database instance to avoid path resolution issues
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
 * @returns Database instance to be passed to clear/teardown functions
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
 * @param dbInstance - The database instance returned from setupTestDatabase()
 */
export async function teardownTestDatabase(dbInstance: TestDatabaseInstance): Promise<void> {
  const { testFilePath, sqlite } = dbInstance;

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
 * @param dbInstance - The database instance returned from setupTestDatabase()
 */
export async function clearTestDatabase(dbInstance: TestDatabaseInstance): Promise<void> {
  const { db, testFilePath } = dbInstance;

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

  // Verify tables are empty after clearing
  const streakCount = db.select().from(schema.streaks).all().length;
  if (streakCount > 0) {
    console.error(`[clearTestDatabase] ERROR: ${streakCount} streaks remain after clearing!`);
    throw new Error(`Failed to clear test database: ${streakCount} streaks remain`);
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