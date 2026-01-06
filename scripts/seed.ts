#!/usr/bin/env node

/**
 * Database seeding script
 * Syncs Calibre and generates realistic development data for testing
 *
 * Usage:
 *   bun run scripts/seed.ts
 *   bun run db:seed
 *
 * Prerequisites:
 *   - CALIBRE_DB_PATH environment variable must be set
 *   - Calibre library must contain books
 */

import { seedDatabase } from "@/lib/db/seeders";
import { getLogger } from "@/lib/logger";

async function main() {
  const logger = getLogger();

  // Check for required environment variables
  const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

  if (!CALIBRE_DB_PATH) {
    logger.error("CALIBRE_DB_PATH environment variable is not set");
    console.error("\n❌ Error: CALIBRE_DB_PATH is not set");
    console.error("\nPlease set the CALIBRE_DB_PATH environment variable:");
    console.error("  export CALIBRE_DB_PATH=/path/to/calibre/metadata.db");
    console.error("\nOr add it to your .env file:");
    console.error("  CALIBRE_DB_PATH=/path/to/calibre/metadata.db\n");
    process.exit(1);
  }

  logger.info("Starting database seeding...");
  console.log("\n🌱 Starting database seeding...\n");

  try {
    const startTime = Date.now();
    const result = await seedDatabase();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!result.success) {
      throw new Error(result.error || "Seeding failed");
    }

    logger.info({
      duration,
      booksFromSync: result.booksFromSync,
      booksUsed: result.booksUsed,
      sessionsSeeded: result.sessionsSeeded,
      progressLogsSeeded: result.progressLogsSeeded,
      goalsCreated: result.goalsCreated,
      booksCompletedHistorically: result.booksCompletedHistorically,
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      totalDaysActive: result.totalDaysActive,
    }, "Database seeding completed successfully");

    // Pretty console output
    console.log("✅ Seeding completed successfully!\n");
    console.log("Summary:");
    console.log(`  📚 Books from Calibre sync: ${result.booksFromSync}`);
    console.log(`  📖 Books used for seeding: ${result.booksUsed}`);
    console.log(`  📝 Sessions created: ${result.sessionsSeeded}`);
    console.log(`  📊 Progress logs created: ${result.progressLogsSeeded}`);
    if (result.goalsCreated !== undefined) {
      console.log(`  🎯 Reading goals created: ${result.goalsCreated}`);
      console.log(`  📅 Historical completions: ${result.booksCompletedHistorically}`);
    }
    if (result.currentStreak !== undefined) {
      console.log(`  🔥 Current streak: ${result.currentStreak} ${result.currentStreak === 1 ? 'day' : 'days'}`);
      console.log(`  ⭐ Longest streak: ${result.longestStreak} ${result.longestStreak === 1 ? 'day' : 'days'}`);
      console.log(`  📅 Total active days: ${result.totalDaysActive}`);
    }
    console.log(`  ⏱️  Duration: ${duration}s\n`);

    console.log("Next steps:");
    console.log("  • Start the dev server: bun run dev");
    console.log("  • Visit /goals to see your reading goals");
    console.log("  • Visit /streak to see the analytics");
    console.log("  • Check the dashboard to see books in progress\n");

    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Database seeding failed");
    console.error("\n❌ Seeding failed:", error instanceof Error ? error.message : error);

    if (error instanceof Error && error.stack) {
      logger.error({ stack: error.stack }, "Error stack trace");
    }

    console.error("\nTroubleshooting:");
    console.error("  • Ensure CALIBRE_DB_PATH points to a valid Calibre database");
    console.error("  • Make sure your Calibre library contains books with page counts");
    console.error("  • Check the logs for more details\n");

    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
