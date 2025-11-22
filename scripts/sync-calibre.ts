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
  console.log("=== Manual Calibre Library Sync ===\n");

  // Check for required environment variable
  const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

  if (!CALIBRE_DB_PATH) {
    console.error("❌ Error: CALIBRE_DB_PATH environment variable is not set");
    console.error("\nPlease set the path to your Calibre library:");
    console.error("  export CALIBRE_DB_PATH='/path/to/calibre/metadata.db'");
    console.error("\nOr add to .env file:");
    console.error("  CALIBRE_DB_PATH=/path/to/calibre/metadata.db");
    process.exit(1);
  }

  console.log(`Calibre Database: ${CALIBRE_DB_PATH}`);
  console.log(`Tome Database: ${process.env.DATABASE_PATH || "./data/tome.db"}`);
  console.log("\nStarting sync...\n");

  try {
    const startTime = Date.now();

    // Run the sync
    const result = await syncCalibreLibrary();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n=== Sync Complete ===");
    console.log(`Duration: ${duration}s`);
    console.log("\nSync Result:");
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Sync Failed");
    console.error("Error:", error);

    if (error instanceof Error) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
