import { sqlite } from "../lib/db/sqlite";
import { runMigrations } from "../lib/db/migrate";
import { getLogger } from "../lib/logger";
import * as readline from "readline";

const logger = getLogger();

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
 * Prompts user for confirmation before proceeding
 */
async function promptForConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\n⚠️  WARNING: This will delete ALL data in the database!\n\nType 'y' to confirm or anything else to exit: ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y");
      }
    );
  });
}

/**
 * Main function to refresh the database
 */
async function refreshDatabase() {
  logger.info("=== Database Refresh ===");

  // Prompt for confirmation
  const confirmed = await promptForConfirmation();

  if (!confirmed) {
    logger.info("Database refresh cancelled by user");
    process.exit(0);
  }

  try {
    // Drop all tables
    dropAllTables();

    // Run migrations to recreate tables
    logger.info("Running migrations...");
    runMigrations();

    logger.info("✅ Database refresh complete!");
  } catch (error) {
    logger.error({ err: error }, "Database refresh failed");
    throw error;
  } finally {
    // Close database connection
    sqlite.close();
  }
}

// Run if executed directly
if (import.meta.main) {
  refreshDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ err: error }, "Fatal error during database refresh");
      process.exit(1);
    });
}

export { refreshDatabase, dropAllTables };
