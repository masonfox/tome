import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/tome.db";

// Runtime detection: Use bun:sqlite in Bun, better-sqlite3 in Node.js
const isBun = typeof Bun !== 'undefined';

// Check if we're in test mode - skip production database initialization
const isTest = isBun ? Bun.env.BUN_ENV === 'test' : process.env.NODE_ENV === 'test';

let sqlite: any;
let db: any;

if (!isTest) {
  // Only initialize production database when not in test mode
  // Create data directory if it doesn't exist
  try {
    mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  } catch (err) {
    // Directory already exists or couldn't be created
  }

  if (isBun) {
    // Bun runtime - use native bun:sqlite
    const { Database } = require('bun:sqlite');
    const { drizzle } = require('drizzle-orm/bun-sqlite');

    sqlite = new Database(DATABASE_PATH, { create: true });
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec("PRAGMA journal_mode = WAL");

    db = drizzle(sqlite, { schema });
    console.log("Using bun:sqlite for Tome database");
  } else {
    // Node.js runtime - use better-sqlite3
    const Database = require('better-sqlite3');
    const { drizzle } = require('drizzle-orm/better-sqlite3');

    sqlite = new Database(DATABASE_PATH);
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");

    db = drizzle(sqlite, { schema });
    console.log("Using better-sqlite3 for Tome database (Node.js dev mode)");
  }
} else {
  // In test mode, return null/undefined - tests will use their own in-memory databases
  sqlite = null;
  db = null;
}

export { db, sqlite };

// Connection test function
export function testConnection(): boolean {
  if (!sqlite) {
    // In test mode, no production database to test
    return true;
  }
  try {
    const result = sqlite.query("SELECT 1 as test").get();
    return (result as any).test === 1;
  } catch (error) {
    console.error("SQLite connection test failed:", error);
    return false;
  }
}

// Graceful shutdown
export function closeConnection(): void {
  if (!sqlite) {
    // In test mode, no production database to close
    return;
  }
  try {
    sqlite.close();
    console.log("SQLite connection closed");
  } catch (error) {
    console.error("Error closing SQLite connection:", error);
  }
}

// Handle process termination
if (typeof process !== "undefined") {
  process.on("exit", closeConnection);
  process.on("SIGINT", () => {
    closeConnection();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    closeConnection();
    process.exit(0);
  });
}

export default db;
