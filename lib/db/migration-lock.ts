import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname } from "path";
import { mkdirSync } from "fs";

const LOCK_FILE = process.env.MIGRATION_LOCK_PATH || "./data/.migration.lock";
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface LockData {
  pid: number;
  timestamp: number;
  hostname: string;
}

/**
 * Acquires a file-based lock for migrations to prevent concurrent execution
 * @throws Error if lock cannot be acquired
 */
export function acquireMigrationLock(): void {
  // Ensure lock directory exists
  try {
    mkdirSync(dirname(LOCK_FILE), { recursive: true });
  } catch (err) {
    // Directory already exists
  }

  // Check if lock file exists
  if (existsSync(LOCK_FILE)) {
    const lockContent = readFileSync(LOCK_FILE, "utf-8");
    let lockData: LockData;

    try {
      lockData = JSON.parse(lockContent);
    } catch (e) {
      // Corrupted lock file, remove it
      const { getLogger } = require("../logger");
      getLogger().warn("Corrupted lock file detected, removing...");
      unlinkSync(LOCK_FILE);
      return acquireMigrationLock(); // Retry
    }

    const lockAge = Date.now() - lockData.timestamp;

    // Check if lock is stale (older than timeout)
    if (lockAge > LOCK_TIMEOUT_MS) {
      const { getLogger } = require("../logger");
      getLogger().warn(`Stale lock detected (${Math.round(lockAge / 1000)}s old, PID: ${lockData.pid}), removing...`);
      unlinkSync(LOCK_FILE);
    } else {
      throw new Error(
        `Migration is already running (PID: ${lockData.pid}, started ${Math.round(lockAge / 1000)}s ago on ${lockData.hostname}). ` +
          `If this is a stale lock, it will automatically expire in ${Math.round((LOCK_TIMEOUT_MS - lockAge) / 1000)}s.`
      );
    }
  }

  // Create lock file
  const lockData: LockData = {
    pid: process.pid,
    timestamp: Date.now(),
    hostname: process.env.HOSTNAME || "unknown",
  };

  try {
    writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), {
      flag: "wx", // Exclusive write (fail if exists)
    });
    const { getLogger } = require("../logger");
    getLogger().info(`Migration lock acquired (PID: ${process.pid})`);
  } catch (err: any) {
    if (err.code === "EEXIST") {
      // Race condition: another process created the lock between our check and write
      throw new Error("Migration lock acquired by another process during acquisition attempt");
    }
    throw err;
  }
}

/**
 * Releases the migration lock
 */
export function releaseMigrationLock(): void {
  if (existsSync(LOCK_FILE)) {
    try {
      const lockContent = readFileSync(LOCK_FILE, "utf-8");
      const lockData: LockData = JSON.parse(lockContent);

      // Only remove if this process owns the lock
      if (lockData.pid === process.pid) {
        unlinkSync(LOCK_FILE);
        const { getLogger } = require("../logger");
        getLogger().info(`Migration lock released (PID: ${process.pid})`);
      } else {
        const { getLogger } = require("../logger");
        getLogger().warn(`Lock file exists but owned by PID ${lockData.pid}, not removing`);
      }
    } catch (err) {
      const { getLogger } = require("../logger");
      getLogger().error({ err }, "Error releasing migration lock");
    }
  }
}

// Track if listeners are registered to prevent duplicates during HMR
let lockCleanupRegistered = false;

/**
 * Ensures lock is released on process exit
 */
export function setupLockCleanup(): void {
  // Prevent duplicate listener registration during HMR
  if (lockCleanupRegistered) {
    return;
  }
  
  process.on("exit", releaseMigrationLock);
  process.on("SIGINT", () => {
    releaseMigrationLock();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    releaseMigrationLock();
    process.exit(0);
  });
  
  lockCleanupRegistered = true;
}
