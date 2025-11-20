import { sqlite } from "@/lib/db/sqlite";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import { setDatabase } from "@/lib/db/context";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/lib/db/schema";

/**
 * Test database setup and teardown utilities for SQLite
 */

let isSetup = false;
let testDb: any;
let testSqlite: any;

/**
 * Setup: SQLite test database and run migrations
 * Call this in beforeAll()
 */
export async function setupTestDatabase(): Promise<void> {
  if (isSetup) {
    return; // Already setup
  }

  // Create separate test database in memory for complete isolation
  testSqlite = new Database(":memory:");
  testSqlite.exec("PRAGMA foreign_keys = ON");
  testSqlite.exec("PRAGMA journal_mode = WAL");
  
  testDb = drizzle(testSqlite, { schema });
  console.log("Test database created successfully");
  
  // Set the test database as the current database for repositories
  setDatabase(testDb);
  
  // Run migrations on test database - pass the Drizzle instance, not the raw SQLite
  await runMigrationsOnDatabase(testDb);
  isSetup = true;
}

/**
 * Teardown the test database
 * Call this in afterAll()
 */
export async function teardownTestDatabase(): Promise<void> {
  // Reset database context to production database
  setDatabase(null);
  isSetup = false;
}

/**
 * Clear all data from the test database
 * Call this in beforeEach() or afterEach() to reset state between tests
 * IMPORTANT: Order matters due to foreign key constraints
 */
export async function clearTestDatabase(): Promise<void> {
  // Delete in order that respects foreign key constraints
  // Children first, then parents
  testDb.delete(schema.progressLogs).run();
  testDb.delete(schema.readingSessions).run();
  testDb.delete(schema.books).run();
  testDb.delete(schema.streaks).run();
}

/**
 * Get a direct reference to the test database
 * Useful for debugging or advanced test setup
 */
export function getTestDatabase() {
  console.log("getTestDatabase called, returning:", testDb ? "test database" : "null");
  return testDb || sqlite;
}

/**
 * Get the raw SQLite instance for the test database
 * Useful for executing raw SQL
 */
export function getTestSqlite() {
  return testSqlite;
}