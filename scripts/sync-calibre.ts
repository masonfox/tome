#!/usr/bin/env bun

/**
 * Manual Calibre Library Sync CLI
 *
 * This script triggers a full sync of the Calibre library to the Tome database.
 * It's a CLI wrapper around the syncCalibreLibrary() service function.
 *
 * Usage:
 *   bun run scripts/sync-calibre.ts
 *   bun run sync-calibre
 *
 * Environment Variables:
 *   CALIBRE_DB_PATH - Path to Calibre metadata.db (required)
 *   DATABASE_PATH   - Path to Tome database (optional, default: ./data/tome.db)
 */

import { syncCalibreLibrary } from "../lib/sync-service";

async function main() {
  const { getLogger } = await import("@/lib/logger");
  const logger = getLogger();
  logger.info("=== Manual Calibre Library Sync ===");

  // Check for required environment variable
  const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

  if (!CALIBRE_DB_PATH) {
    const { getLogger } = await import("@/lib/logger");
    const logger = getLogger();
    logger.error("CALIBRE_DB_PATH environment variable is not set");
    logger.error("Please set the path to your Calibre library:");
    logger.error("  export CALIBRE_DB_PATH='/path/to/calibre/metadata.db'");
    logger.error("Or add to .env file:");
    logger.error("  CALIBRE_DB_PATH=/path/to/calibre/metadata.db");
    process.exit(1);
  }

  logger.info({ calibreDbPath: CALIBRE_DB_PATH }, `Calibre Database: ${CALIBRE_DB_PATH}`);
  logger.info({ tomeDbPath: process.env.DATABASE_PATH || "./data/tome.db" }, `Tome Database: ${process.env.DATABASE_PATH || "./data/tome.db"}`);
  logger.info("Starting sync...");

  try {
    const startTime = Date.now();

    // Run the sync
    const result = await syncCalibreLibrary();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info("Sync Complete");
    logger.info({ durationSeconds: duration }, `Duration: ${duration}s`);
    logger.info("Sync Result:");
    logger.info({ result }, "Sync outcome");

    process.exit(0);
  } catch (error) {
    logger.error("Sync Failed");
    logger.error({ err: error }, "Sync error");

    if (error instanceof Error) {
      logger.error("Stack trace follows");
      logger.error({ stack: (error as Error).stack }, "Error stack");
    }

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
