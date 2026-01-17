/**
 * Unit Tests for Companion Migrations Framework
 * 
 * Tests individual functions in isolation:
 * - isCompleteMigration(): Completion tracking
 * - markComplete(): Marking migrations complete
 * - tablesExist(): Table existence checks
 * - discoverCompanions(): Migration discovery (requires real files)
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createDatabase } from "@/lib/db/factory";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import * as schema from "@/lib/db/schema";
import {
  isCompleteMigration,
  markComplete,
  tablesExist,
} from "@/lib/db/companion-migrations";

describe("Companion Migrations - Unit Tests", () => {
  let testDb: any;
  let testSqlite: any;

  beforeEach(() => {
    // Create fresh in-memory database
    const { db, sqlite } = createDatabase({
      path: ":memory:",
      schema,
      wal: false,
      foreignKeys: true,
    });
    testDb = db;
    testSqlite = sqlite;
    
    // Run migrations to set up schema
    runMigrationsOnDatabase(testDb);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  describe("isCompleteMigration()", () => {
    test("should return false when migration_metadata table doesn't exist", () => {
      // Drop migration_metadata table if it exists
      try {
        testSqlite.exec("DROP TABLE IF EXISTS migration_metadata");
      } catch (error) {
        // Ignore if table doesn't exist
      }
      
      const result = isCompleteMigration(testSqlite, "0015_test_migration");
      expect(result).toBe(false);
    });

    test("should return false when migration key doesn't exist in table", () => {
      // Create migration_metadata table
      testSqlite.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);
      
      const result = isCompleteMigration(testSqlite, "0015_test_migration");
      expect(result).toBe(false);
    });

    test("should return true when migration key has value 'true'", () => {
      // Create migration_metadata table
      testSqlite.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);
      
      // Insert completion flag
      testSqlite.prepare(
        "INSERT INTO migration_metadata (key, value) VALUES (?, ?)"
      ).run("0015_test_migration", "true");
      
      const result = isCompleteMigration(testSqlite, "0015_test_migration");
      expect(result).toBe(true);
    });

    test("should return false when migration key has value 'false'", () => {
      // Create migration_metadata table
      testSqlite.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);
      
      // Insert flag with false value
      testSqlite.prepare(
        "INSERT INTO migration_metadata (key, value) VALUES (?, ?)"
      ).run("0015_test_migration", "false");
      
      const result = isCompleteMigration(testSqlite, "0015_test_migration");
      expect(result).toBe(false);
    });

    test("should handle database query errors gracefully", () => {
      // Close database to trigger error
      const closedDb = testSqlite;
      closedDb.close();
      
      const result = isCompleteMigration(closedDb, "0015_test_migration");
      expect(result).toBe(false); // Returns false on error
    });

    test("should handle multiple migrations independently", () => {
      testSqlite.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);
      
      // Mark migration 1 complete
      testSqlite.prepare(
        "INSERT INTO migration_metadata (key, value) VALUES (?, ?)"
      ).run("0015_migration_1", "true");
      
      // Mark migration 2 incomplete
      testSqlite.prepare(
        "INSERT INTO migration_metadata (key, value) VALUES (?, ?)"
      ).run("0016_migration_2", "false");
      
      expect(isCompleteMigration(testSqlite, "0015_migration_1")).toBe(true);
      expect(isCompleteMigration(testSqlite, "0016_migration_2")).toBe(false);
      expect(isCompleteMigration(testSqlite, "0017_migration_3")).toBe(false);
    });
  });

  describe("markComplete()", () => {
    test("should create migration_metadata table if it doesn't exist", () => {
      // Drop table if exists
      try {
        testSqlite.exec("DROP TABLE IF EXISTS migration_metadata");
      } catch (error) {
        // Ignore
      }
      
      markComplete(testSqlite, "0015_test_migration");
      
      // Verify table was created
      const tables = testSqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_metadata'"
      ).all();
      
      expect(tables.length).toBe(1);
    });

    test("should insert completion flag for new migration", () => {
      markComplete(testSqlite, "0015_test_migration");
      
      const result = testSqlite.prepare(
        "SELECT value FROM migration_metadata WHERE key = ?"
      ).get("0015_test_migration") as { value: string } | undefined;
      
      expect(result).toBeDefined();
      expect(result?.value).toBe("true");
    });

    test("should update completion flag for existing migration (INSERT OR REPLACE)", () => {
      testSqlite.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);
      
      // Insert initial flag with false value
      testSqlite.prepare(
        "INSERT INTO migration_metadata (key, value) VALUES (?, ?)"
      ).run("0015_test_migration", "false");
      
      // Mark complete (should update)
      markComplete(testSqlite, "0015_test_migration");
      
      const result = testSqlite.prepare(
        "SELECT value FROM migration_metadata WHERE key = ?"
      ).get("0015_test_migration") as { value: string };
      
      expect(result.value).toBe("true");
    });

    test("should store created_at timestamp", () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      markComplete(testSqlite, "0015_test_migration");
      
      const result = testSqlite.prepare(
        "SELECT created_at FROM migration_metadata WHERE key = ?"
      ).get("0015_test_migration") as { created_at: number };
      
      const afterTime = Math.floor(Date.now() / 1000);
      
      expect(result.created_at).toBeGreaterThanOrEqual(beforeTime);
      expect(result.created_at).toBeLessThanOrEqual(afterTime);
    });

    test("should throw error if database write fails", () => {
      // Close database to trigger error
      const closedDb = testSqlite;
      closedDb.close();
      
      expect(() => markComplete(closedDb, "0015_test_migration")).toThrow();
    });

    test("should handle multiple migrations", () => {
      markComplete(testSqlite, "0015_migration_1");
      markComplete(testSqlite, "0016_migration_2");
      markComplete(testSqlite, "0017_migration_3");
      
      // Verify all marked complete
      const migrations = testSqlite.prepare(
        "SELECT key, value FROM migration_metadata ORDER BY key"
      ).all() as Array<{ key: string; value: string }>;
      
      expect(migrations.length).toBe(3);
      expect(migrations[0].key).toBe("0015_migration_1");
      expect(migrations[0].value).toBe("true");
      expect(migrations[1].key).toBe("0016_migration_2");
      expect(migrations[1].value).toBe("true");
      expect(migrations[2].key).toBe("0017_migration_3");
      expect(migrations[2].value).toBe("true");
    });

    test("should use INSERT OR REPLACE semantics", () => {
      // Mark complete
      markComplete(testSqlite, "0015_test");
      
      // Get initial created_at
      const first = testSqlite.prepare(
        "SELECT created_at FROM migration_metadata WHERE key = ?"
      ).get("0015_test") as { created_at: number };
      
      // Wait a moment
      const waitStart = Date.now();
      while (Date.now() - waitStart < 10) {
        // Busy wait
      }
      
      // Mark complete again (should replace)
      markComplete(testSqlite, "0015_test");
      
      // Verify still only one row
      const count = testSqlite.prepare(
        "SELECT COUNT(*) as count FROM migration_metadata WHERE key = ?"
      ).get("0015_test") as { count: number };
      
      expect(count.count).toBe(1);
    });
  });

  describe("tablesExist()", () => {
    test("should return true when all required tables exist", () => {
      // books and reading_sessions should exist after migrations
      const result = tablesExist(testSqlite, ["books", "reading_sessions"]);
      expect(result).toBe(true);
    });

    test("should return false when any required table is missing", () => {
      const result = tablesExist(testSqlite, ["books", "nonexistent_table"]);
      expect(result).toBe(false);
    });

    test("should return true for empty array (no requirements)", () => {
      const result = tablesExist(testSqlite, []);
      expect(result).toBe(true);
    });

    test("should return false when all tables are missing", () => {
      const result = tablesExist(testSqlite, ["table1", "table2", "table3"]);
      expect(result).toBe(false);
    });

    test("should handle database query errors gracefully", () => {
      // Close database to trigger error
      const closedDb = testSqlite;
      closedDb.close();
      
      const result = tablesExist(closedDb, ["books"]);
      expect(result).toBe(false); // Returns false on error
    });

    test("should check multiple tables correctly", () => {
      // All these tables should exist after migrations
      const result = tablesExist(testSqlite, [
        "books",
        "reading_sessions",
        "progress_logs",
        "streaks",
        "reading_goals",
      ]);
      
      expect(result).toBe(true);
    });

    test("should be case-sensitive for table names", () => {
      // SQLite table names are case-sensitive in most configurations
      const result = tablesExist(testSqlite, ["BOOKS"]); // Wrong case
      expect(result).toBe(false);
    });

    test("should detect missing table even when others exist", () => {
      expect(tablesExist(testSqlite, ["books", "reading_sessions"])).toBe(true);
      expect(tablesExist(testSqlite, ["books", "fake_table"])).toBe(false);
      expect(tablesExist(testSqlite, ["fake_table", "reading_sessions"])).toBe(false);
    });
  });
});
