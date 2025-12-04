import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/sqlite";
import { getLogger } from "@/lib/logger";
import { syncCalibreLibrary } from "@/lib/sync-service";

const logger = getLogger();

export const dynamic = 'force-dynamic';

/**
 * Truncates all data from all tables, preserving schema
 */
function truncateAllData() {
  logger.info("Truncating all data from tables...");
  
  // Get all table names (excluding system tables and migrations)
  const tables = sqlite
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
    )
    .all() as { name: string }[];

  logger.info({ tableCount: tables.length }, `Found ${tables.length} tables to truncate`);

  // Disable foreign key checks temporarily
  sqlite.prepare("PRAGMA foreign_keys = OFF").run();

  // Delete all data from each table
  for (const { name } of tables) {
    logger.info({ table: name }, `Truncating table: ${name}`);
    sqlite.prepare(`DELETE FROM "${name}"`).run();
  }

  // Reset sqlite_sequence to reset auto-increment counters
  const sequenceExists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
    .get();
  
  if (sequenceExists) {
    logger.info("Resetting auto-increment sequences");
    sqlite.prepare("DELETE FROM sqlite_sequence").run();
  }

  // Re-enable foreign key checks
  sqlite.prepare("PRAGMA foreign_keys = ON").run();

  // Checkpoint WAL to ensure changes are persisted
  logger.info("Checkpointing WAL");
  sqlite.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();

  // Run VACUUM to reclaim space and optimize database
  logger.info("Running VACUUM");
  sqlite.prepare("VACUUM").run();

  logger.info("All data truncated successfully");
}

/**
 * POST endpoint to wipe all data while preserving schema
 */
export async function POST() {
  try {
    logger.info("Data wipe requested via API");

    // Truncate all data (preserves schema)
    truncateAllData();

    logger.info("Data wipe completed successfully, starting Calibre sync...");

    // Automatically sync with Calibre to reimport books
    const syncResult = await syncCalibreLibrary();

    if (syncResult.success) {
      logger.info(
        { 
          syncedCount: syncResult.syncedCount, 
          updatedCount: syncResult.updatedCount 
        }, 
        "Calibre sync completed after data wipe"
      );
      return NextResponse.json({ 
        success: true, 
        message: "All data has been wiped and Calibre library has been synced",
        syncResult: {
          syncedCount: syncResult.syncedCount,
          totalBooks: syncResult.totalBooks,
        }
      });
    } else {
      logger.warn({ syncError: syncResult.error }, "Data wipe succeeded but Calibre sync failed");
      return NextResponse.json({ 
        success: true, 
        message: "Data has been wiped, but Calibre sync failed. You may need to sync manually.",
        syncError: syncResult.error
      });
    }
  } catch (error) {
    logger.error({ err: error }, "Data wipe failed");
    return NextResponse.json(
      { error: "Failed to wipe data" }, 
      { status: 500 }
    );
  }
}
