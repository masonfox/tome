#!/usr/bin/env tsx
/**
 * Run companion migrations manually
 * Usage: npx tsx scripts/run-companion-migrations.ts
 */

import Database from "better-sqlite3";
import { runCompanionMigrations } from "../lib/db/companion-migrations.js";
import { getLogger } from "../lib/logger.js";

const logger = getLogger().child({ script: "run-companion-migrations" });

async function main() {
  const dbPath = process.env.DATABASE_PATH || "data/tome.db";
  
  logger.info({ dbPath }, "Opening database");
  const db = new Database(dbPath);
  
  try {
    await runCompanionMigrations(db);
    logger.info("Companion migrations complete");
  } catch (error) {
    logger.error({ error }, "Companion migrations failed");
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
