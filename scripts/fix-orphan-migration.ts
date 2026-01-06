#!/usr/bin/env node
/**
 * Fix orphaned migration entry in __drizzle_migrations table
 * 
 * This script removes migration entries that don't have corresponding SQL files.
 * This can happen when migrations are regenerated or deleted after being applied.
 */

import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "fs";
import { createHash } from "crypto";
import * as readline from "readline";

const DB_PATH = process.env.DATABASE_PATH || "./data/tome.db";
const MIGRATIONS_DIR = "./drizzle";

// Get hashes of all SQL files
function getFileMigrationHashes(): Set<string> {
  const hashes = new Set<string>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const text = readFileSync(`${MIGRATIONS_DIR}/${file}`, 'utf-8');
    const hash = createHash("sha256").update(text).digest("hex");
    hashes.add(hash);
  }

  return hashes;
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("🔍 Checking for orphaned migrations...\n");

  const db = new Database(DB_PATH);
  const fileHashes = getFileMigrationHashes();

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

  const response = await promptUser("Continue? (yes/no): ");
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
