#!/usr/bin/env bun
/**
 * Fix orphaned migration entry in __drizzle_migrations table
 * 
 * This script removes migration entries that don't have corresponding SQL files.
 * This can happen when migrations are regenerated or deleted after being applied.
 */

import { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { createHash } from "crypto";

const DB_PATH = process.env.DATABASE_PATH || "./data/tome.db";
const MIGRATIONS_DIR = "./drizzle";

// Get hashes of all SQL files
async function getFileMigrationHashes(): Promise<Set<string>> {
  const hashes = new Set<string>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const content = Bun.file(`${MIGRATIONS_DIR}/${file}`);
    const text = await content.text();
    const hash = createHash("sha256").update(text).digest("hex");
    hashes.add(hash);
  }

  return hashes;
}

async function main() {
  console.log("🔍 Checking for orphaned migrations...\n");

  const db = new Database(DB_PATH);
  const fileHashes = await getFileMigrationHashes();

  console.log(`Found ${fileHashes.size} migration files`);

  // Get all applied migrations
  const appliedMigrations = db
    .prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at")
    .all() as Array<{ hash: string; created_at: number }>;

  console.log(`Found ${appliedMigrations.length} applied migrations\n`);

  // Find orphaned migrations
  const orphanedMigrations = appliedMigrations.filter(
    (m) => !fileHashes.has(m.hash)
  );

  if (orphanedMigrations.length === 0) {
    console.log("✅ No orphaned migrations found!");
    db.close();
    return;
  }

  console.log(`⚠️  Found ${orphanedMigrations.length} orphaned migration(s):\n`);

  for (const migration of orphanedMigrations) {
    const date = new Date(migration.created_at);
    console.log(`  - Hash: ${migration.hash.substring(0, 16)}...`);
    console.log(`    Applied: ${date.toISOString()}\n`);
  }

  // Confirm deletion
  console.log("This will DELETE the orphaned migration entries from the database.");
  console.log("The actual database schema will NOT be affected.\n");

  const response = prompt("Continue? (yes/no): ");
  if (response?.toLowerCase() !== "yes") {
    console.log("\n❌ Cancelled");
    db.close();
    return;
  }

  // Delete orphaned migrations
  const deleteStmt = db.prepare("DELETE FROM __drizzle_migrations WHERE hash = ?");

  for (const migration of orphanedMigrations) {
    deleteStmt.run(migration.hash);
    console.log(`✅ Removed: ${migration.hash.substring(0, 16)}...`);
  }

  db.close();

  console.log(`\n✅ Successfully removed ${orphanedMigrations.length} orphaned migration(s)`);
  console.log("\nYou can now run migrations normally.");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
