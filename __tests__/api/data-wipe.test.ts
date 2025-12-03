import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/db-setup";
import type { TestDatabaseInstance } from "../helpers/db-setup";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/lib/db/schema";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";

describe("Data Wipe API", () => {
  let dbInstance: TestDatabaseInstance;

  beforeAll(async () => {
    dbInstance = await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(dbInstance);
  });

  test("should drop all tables and recreate them", () => {
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

    // Simulate the dropAllTables function
    const tables = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
      )
      .all() as { name: string }[];

    // Disable foreign key checks temporarily
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = OFF").run();

    // Drop each table
    for (const { name } of tables) {
      dbInstance.sqlite.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
    }

    // Drop the migrations table as well
    dbInstance.sqlite.prepare("DROP TABLE IF EXISTS __drizzle_migrations").run();

    // Re-enable foreign key checks
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = ON").run();

    // Verify tables are dropped
    const tablesAfterDrop = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as { name: string }[];

    expect(tablesAfterDrop).toHaveLength(0);

    // Reset database (recreate tables)
    runMigrationsOnDatabase(dbInstance.db);

    // Create new drizzle instance with the fresh schema
    const freshDb = drizzle(dbInstance.sqlite, { schema });

    // Verify tables are recreated
    const tablesAfterRecreate = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
      )
      .all() as { name: string }[];

    expect(tablesAfterRecreate.length).toBeGreaterThan(0);

    // Verify data is gone
    const booksAfter = freshDb.select().from(schema.books).all();
    expect(booksAfter).toHaveLength(0);
  });

  test("should preserve table structure after wipe", async () => {
    // Drop and recreate tables
    const tablesBefore = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
      )
      .all() as { name: string }[];

    const tableNamesBefore = tablesBefore.map((t) => t.name).sort();

    // Simulate wipe
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = OFF").run();
    for (const { name } of tablesBefore) {
      dbInstance.sqlite.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
    }
    dbInstance.sqlite.prepare("DROP TABLE IF EXISTS __drizzle_migrations").run();
    dbInstance.sqlite.prepare("PRAGMA foreign_keys = ON").run();

    // Recreate
    await runMigrationsOnDatabase(dbInstance.db);
    const freshDb = drizzle(dbInstance.sqlite, { schema });

    const tablesAfter = dbInstance.sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
      )
      .all() as { name: string }[];

    const tableNamesAfter = tablesAfter.map((t) => t.name).sort();

    // Table names should match
    expect(tableNamesAfter).toEqual(tableNamesBefore);
  });
});
