import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/sqlite";
import { runMigrations } from "@/lib/db/migrate";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export const dynamic = 'force-dynamic';

/**
 * Drops all tables from the database
 */
function dropAllTables() {
  logger.info("Dropping all tables...");
  
  // Get all table names
  const tables = sqlite
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
    )
    .all() as { name: string }[];

  logger.info({ tableCount: tables.length }, `Found ${tables.length} tables to drop`);

  // Disable foreign key checks temporarily
  sqlite.prepare("PRAGMA foreign_keys = OFF").run();

  // Drop each table
  for (const { name } of tables) {
    logger.info({ table: name }, `Dropping table: ${name}`);
    sqlite.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
  }

  // Drop the migrations table as well to start fresh
  logger.info("Dropping migrations table");
  sqlite.prepare("DROP TABLE IF EXISTS __drizzle_migrations").run();

  // Re-enable foreign key checks
  sqlite.prepare("PRAGMA foreign_keys = ON").run();

  logger.info("All tables dropped successfully");
}

/**
 * POST endpoint to wipe all data and refresh the database
 */
export async function POST() {
  try {
    logger.info("Data wipe requested via API");

    // Drop all tables
    dropAllTables();

    // Run migrations to recreate tables
    logger.info("Running migrations...");
    runMigrations();

    logger.info("Data wipe completed successfully");

    return NextResponse.json({ 
      success: true, 
      message: "All data has been wiped and database reset successfully" 
    });
  } catch (error) {
    logger.error({ err: error }, "Data wipe failed");
    return NextResponse.json(
      { error: "Failed to wipe data" }, 
      { status: 500 }
    );
  }
}
