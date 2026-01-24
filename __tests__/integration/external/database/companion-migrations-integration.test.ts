/**
 * Integration Tests for Companion Migrations Framework
 * 
 * Tests end-to-end migration execution:
 * - runCompanionMigrations(): Full execution flow
 * - Transaction rollback on errors
 * - Fresh database support
 * - Idempotency
 * - Multiple migrations in order
 * 
 * TODO: These tests need to be rewritten after moving to dynamic TypeScript imports.
 * Currently skipped because dynamic file creation at test runtime doesn't work well
 * with ES module imports. See companion-migrations-loading.test.ts for the approach
 * that works with real files.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createDatabase } from "@/lib/db/factory";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import { runCompanionMigrations } from "@/lib/db/companion-migrations";
import * as schema from "@/lib/db/schema";
import { writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe.skip("Companion Migrations - Integration Tests", () => {
  let testDb: any;
  let testSqlite: any;
  let testMigrationsDir: string;

  beforeAll(() => {
    // Create temporary migrations directory
    testMigrationsDir = join(tmpdir(), `companion-integration-${Date.now()}`);
    mkdirSync(testMigrationsDir, { recursive: true });
    
    const migrationsDir = join(testMigrationsDir, "lib/migrations");
    mkdirSync(migrationsDir, { recursive: true });
    
    // Create test companion that transforms data
    writeFileSync(
      join(migrationsDir, "0001_test_transform.ts"),
      `
      export default {
        name: "0001_test_transform",
        requiredTables: ["books"],
        description: "Test data transformation",
        execute: async (db) => {
          const books = db.prepare("SELECT id, title FROM books WHERE title LIKE 'OLD:%'").all();
          const updateStmt = db.prepare("UPDATE books SET title = ? WHERE id = ?");
          
          for (const book of books) {
            const newTitle = book.title.replace('OLD:', 'NEW:');
            updateStmt.run(newTitle, book.id);
          }
        }
      };
      `
    );
  });

  afterAll(() => {
    // Clean up
    rmSync(testMigrationsDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Create fresh database
    const { db, sqlite } = createDatabase({
      path: ":memory:",
      schema,
      wal: false,
      foreignKeys: true,
    });
    testDb = db;
    testSqlite = sqlite;
    
    // Run schema migrations
    runMigrationsOnDatabase(testDb);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  describe("runCompanionMigrations() - Basic Execution", () => {
    test("should run companions on existing database and transform data", async () => {
      // Insert test data
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(1, "OLD:Test Book", '["Author"]', "/path");
      
      // Run companions
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      
      // Verify transformation
      const book = testSqlite.prepare(
        "SELECT title FROM books WHERE calibre_id = ?"
      ).get(1) as { title: string };
      
      expect(book.title).toBe("NEW:Test Book");
    });

    test("should mark companion as complete after successful run", async () => {
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(1, "OLD:Test Book", '["Author"]', "/path");
      
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      
      const result = testSqlite.prepare(
        "SELECT value FROM migration_metadata WHERE key = ?"
      ).get("0001_test_transform") as { value: string } | undefined;
      
      expect(result).toBeDefined();
      expect(result?.value).toBe("true");
    });

    test("should handle multiple books in single migration", async () => {
      // Insert multiple books
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(1, "OLD:Book One", '["Author"]', "/path1");
      
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(2, "OLD:Book Two", '["Author"]', "/path2");
      
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(3, "NEW:Book Three", '["Author"]', "/path3");
      
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      
      // Verify transformations
      const books = testSqlite.prepare(
        "SELECT calibre_id, title FROM books ORDER BY calibre_id"
      ).all() as Array<{ calibre_id: number; title: string }>;
      
      expect(books[0].title).toBe("NEW:Book One");
      expect(books[1].title).toBe("NEW:Book Two");
      expect(books[2].title).toBe("NEW:Book Three"); // Already had NEW:
    });
  });

  describe("Idempotency", () => {
    test("should skip companion if already marked complete", async () => {
      // Insert test data
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(1, "OLD:Test Book", '["Author"]', "/path");
      
      // Run companions first time
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      
      // Verify transformation
      let book = testSqlite.prepare(
        "SELECT title FROM books WHERE calibre_id = ?"
      ).get(1) as { title: string };
      expect(book.title).toBe("NEW:Test Book");
      
      // Change data back to OLD:
      testSqlite.prepare(
        "UPDATE books SET title = ? WHERE calibre_id = ?"
      ).run("OLD:Test Book", 1);
      
      // Run companions again (should skip)
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      
      // Data should still be OLD (companion was skipped)
      book = testSqlite.prepare(
        "SELECT title FROM books WHERE calibre_id = ?"
      ).get(1) as { title: string };
      
      expect(book.title).toBe("OLD:Test Book");
    });

    test("should handle running migrations multiple times safely", async () => {
      testSqlite.prepare(
        "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
      ).run(1, "OLD:Test", '["Author"]', "/path");
      
      // Run 3 times
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      await runCompanionMigrations(testSqlite, testMigrationsDir);
      
      // Should still only be marked complete once
      const count = testSqlite.prepare(
        "SELECT COUNT(*) as count FROM migration_metadata WHERE key = ?"
      ).get("0001_test_transform") as { count: number };
      
      expect(count.count).toBe(1);
    });
  });

  describe("Fresh Database Support", () => {
    test("should skip companion when required tables don't exist (fresh DB)", async () => {
      // Create fresh database without running migrations
      const { db: freshDb, sqlite: freshSqlite } = createDatabase({
        path: ":memory:",
        schema,
        wal: false,
        foreignKeys: false,
      });
      
      // Run companions (should skip because books table doesn't exist)
      await runCompanionMigrations(freshSqlite, testMigrationsDir);
      
      // Should be marked complete anyway
      const result = freshSqlite.prepare(
        "SELECT value FROM migration_metadata WHERE key = ?"
      ).get("0001_test_transform") as { value: string } | undefined;
      
      expect(result?.value).toBe("true");
      
      freshSqlite.close();
    });

    test("should handle empty database gracefully", async () => {
      const { db: emptyDb, sqlite: emptySqlite } = createDatabase({
        path: ":memory:",
        schema,
        wal: false,
      });
      
      // No migrations run, no tables exist
      await expect(runCompanionMigrations(emptySqlite)).resolves.not.toThrow();
      
      emptySqlite.close();
    });
  });

  describe("Transaction Handling", () => {
    test("should rollback transaction on companion execution error", async () => {
      // Create companion that modifies data then fails
      const migrationsDir = join(testMigrationsDir, "lib/migrations");
      const failingFile = join(migrationsDir, "0002_failing.ts");
      
      writeFileSync(
        failingFile,
        `
        export default {
          name: "0002_failing",
          requiredTables: ["books"],
          execute: async (db) => {
            db.prepare("UPDATE books SET title = 'MODIFIED' WHERE calibre_id = 1").run();
            throw new Error("Intentional error");
          }
        };
        `
      );
      
      try {
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "OLD:ORIGINAL", '["Author"]', "/path");
        
        // Run companions (should fail on 0002_failing)
        await expect(runCompanionMigrations(testSqlite, testMigrationsDir)).rejects.toThrow("Intentional error");
        
        // Verify rollback - 0002_failing changes should be reverted
        const book = testSqlite.prepare(
          "SELECT title FROM books WHERE calibre_id = ?"
        ).get(1) as { title: string };
        
        // Book should have been transformed by 0001 (which succeeded)
        // But NOT by 0002 (which failed and rolled back)
        expect(book.title).toBe("NEW:ORIGINAL");
      } finally {
        // Clean up temporary companion file
        if (existsSync(failingFile)) {
          unlinkSync(failingFile);
        }
      }
    });

    test("should not mark companion as complete when it fails", async () => {
      const migrationsDir = join(testMigrationsDir, "lib/migrations");
      const failingFile = join(migrationsDir, "0003_failing.ts");
      
      writeFileSync(
        failingFile,
        `
        export default {
          name: "0003_failing",
          requiredTables: ["books"],
          execute: async (db) => {
            throw new Error("Failed immediately");
          }
        };
        `
      );
      
      try {
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "OLD:Test", '["Author"]', "/path");
        
        // Run companions (should fail)
        await expect(runCompanionMigrations(testSqlite, testMigrationsDir)).rejects.toThrow();
        
        // Check that failed migration is NOT marked complete
        const result = testSqlite.prepare(
          "SELECT value FROM migration_metadata WHERE key = ?"
        ).get("0003_failing") as { value: string } | undefined;
        
        expect(result).toBeUndefined();
      } finally {
        // Clean up temporary companion file
        if (existsSync(failingFile)) {
          unlinkSync(failingFile);
        }
      }
    });
  });

  describe("Multiple Migrations", () => {
    test("should run multiple companions in numeric order", async () => {
      const migrationsDir = join(testMigrationsDir, "lib/migrations");
      const testFile = join(migrationsDir, "0004_append_suffix.ts");
      
      // Create second companion that appends suffix
      writeFileSync(
        testFile,
        `
        export default {
          name: "0004_append_suffix",
          requiredTables: ["books"],
          execute: async (db) => {
            db.prepare("UPDATE books SET title = title || ' [PASS2]'").run();
          }
        };
        `
      );
      
      try {
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "OLD:Test", '["Author"]', "/path");
        
        await runCompanionMigrations(testSqlite, testMigrationsDir);
        
        const book = testSqlite.prepare(
          "SELECT title FROM books WHERE calibre_id = ?"
        ).get(1) as { title: string };
        
        // Should be transformed by both companions in order
        expect(book.title).toBe("NEW:Test [PASS2]");
      } finally {
        // Clean up temporary companion file
        if (existsSync(testFile)) {
          unlinkSync(testFile);
        }
      }
    });

    test("should mark all successful companions as complete", async () => {
      const migrationsDir = join(testMigrationsDir, "lib/migrations");
      const testFile = join(migrationsDir, "0005_another.ts");
      
      writeFileSync(
        testFile,
        `
        export default {
          name: "0005_another",
          requiredTables: ["books"],
          execute: async (db) => {
            // No-op transformation
          }
        };
        `
      );
      
      try {
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "OLD:Test", '["Author"]', "/path");
        
        await runCompanionMigrations(testSqlite, testMigrationsDir);
        
        // Check all migrations marked complete
        const completedMigrations = testSqlite.prepare(
          "SELECT key FROM migration_metadata WHERE value = 'true' ORDER BY key"
        ).all() as Array<{ key: string }>;
        
        const migrationNames = completedMigrations.map(m => m.key);
        
        // Should include at least 0001 and 0005
        expect(migrationNames).toContain("0001_test_transform");
        expect(migrationNames).toContain("0005_another");
      } finally {
        // Clean up temporary companion file
        if (existsSync(testFile)) {
          unlinkSync(testFile);
        }
      }
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty companions directory gracefully", async () => {
      // Remove all companions
      const migrationsDir = join(testMigrationsDir, "lib/migrations");
      rmSync(migrationsDir, { recursive: true, force: true });
      mkdirSync(migrationsDir, { recursive: true });
      
      await expect(runCompanionMigrations(testSqlite, testMigrationsDir)).resolves.not.toThrow();
    });

    test("should handle companion with no data to transform", async () => {
      const migrationsDir = join(testMigrationsDir, "lib/migrations");
      mkdirSync(migrationsDir, { recursive: true });
      
      const testFile = join(migrationsDir, "0006_no_data.ts");
      writeFileSync(
        testFile,
        `
        export default {
          name: "0006_no_data",
          requiredTables: ["books"],
          execute: async (db) => {
            // Transform OLD: to NEW:, but no such books exist
            const books = db.prepare("SELECT id, title FROM books WHERE title LIKE 'OLD:%'").all();
            const updateStmt = db.prepare("UPDATE books SET title = ? WHERE id = ?");
            
            for (const book of books) {
              const newTitle = book.title.replace('OLD:', 'NEW:');
              updateStmt.run(newTitle, book.id);
            }
          }
        };
        `
      );
      
      try {
        // Insert book without OLD: prefix
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "Normal Book", '["Author"]', "/path");
        
        await runCompanionMigrations(testSqlite, testMigrationsDir);
        
        // Book should be unchanged
        const book = testSqlite.prepare(
          "SELECT title FROM books WHERE calibre_id = ?"
        ).get(1) as { title: string };
        
        expect(book.title).toBe("Normal Book");
        
        // Migration should still be marked complete
        const result = testSqlite.prepare(
          "SELECT value FROM migration_metadata WHERE key = ?"
        ).get("0006_no_data") as { value: string } | undefined;
        
        expect(result?.value).toBe("true");
      } finally {
        // Clean up temporary companion file
        if (existsSync(testFile)) {
          unlinkSync(testFile);
        }
      }
    });
  });
});
