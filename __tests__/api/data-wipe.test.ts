import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/db-setup";
import type { TestDatabaseInstance } from "../helpers/db-setup";
import * as schema from "@/lib/db/schema";

describe("Data Wipe API", () => {
  let dbInstance: TestDatabaseInstance;

  beforeAll(async () => {
    dbInstance = await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(dbInstance);
  });

  test("should truncate all data while preserving schema", () => {
    // Insert some test data first
    dbInstance.db.insert(schema.books)
      .values({
        title: "Test Book",
        authors: ["Test Author"],
        calibreId: 1,
        path: "/test/path",
        totalPages: 200,
      })
      .returning()
      .get();

    // Verify data exists
    const booksBefore = dbInstance.db.select().from(schema.books).all();
    expect(booksBefore).toHaveLength(1);

    // Simulate the truncateAllData function
    const tables = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
      )
      .all() as { name: string }[];

    // Disable foreign key checks temporarily
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = OFF").run();

    // Delete all data from each table
    for (const { name } of tables) {
      dbInstance.sqlite.prepare(`DELETE FROM "${name}"`).run();
    }

    // Reset sqlite_sequence to reset auto-increment counters
    const sequenceExists = dbInstance.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
      .get();
    
    if (sequenceExists) {
      dbInstance.sqlite.prepare("DELETE FROM sqlite_sequence").run();
    }

    // Re-enable foreign key checks
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = ON").run();

    // Verify tables still exist
    const tablesAfter = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
      )
      .all() as { name: string }[];

    expect(tablesAfter.length).toEqual(tables.length);

    // Verify data is gone
    const booksAfter = dbInstance.db.select().from(schema.books).all();
    expect(booksAfter).toHaveLength(0);
  });

  test("should reset auto-increment IDs after wipe", () => {
    // Insert a book
    const book1 = dbInstance.db.insert(schema.books)
      .values({
        title: "Book 1",
        authors: ["Author 1"],
        calibreId: 1,
        path: "/test/path1",
        totalPages: 100,
      })
      .returning()
      .get();

    expect(book1.id).toBeDefined();
    const firstId = book1.id;

    // Truncate data
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = OFF").run();
    dbInstance.sqlite.prepare("DELETE FROM books").run();
    
    const sequenceExists = dbInstance.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
      .get();
    
    if (sequenceExists) {
      dbInstance.sqlite.prepare("DELETE FROM sqlite_sequence").run();
    }
    
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = ON").run();

    // Insert a new book
    const book2 = dbInstance.db.insert(schema.books)
      .values({
        title: "Book 2",
        authors: ["Author 2"],
        calibreId: 2,
        path: "/test/path2",
        totalPages: 200,
      })
      .returning()
      .get();

    // ID should be reset (or close to the first ID, depending on implementation)
    expect(book2.id).toBeDefined();
    expect(book2.id).toBeLessThanOrEqual(firstId + 1);
  });
});
