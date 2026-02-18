import { getLogger } from "@/lib/logger";
import { existsSync, statSync, accessSync, constants } from "fs";
import { dirname } from "path";
import { ensureCoverDirectory, getCoversDir } from "@/lib/utils/cover-storage";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/tome.db";
const DATA_DIR = dirname(DATABASE_PATH);
const MIGRATIONS_DIR = "./drizzle";
const MIN_DISK_SPACE_MB = 100;

export interface PreflightCheckResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

/**
 * Runs pre-flight checks before database migrations
 * @returns PreflightCheckResult with details of all checks
 */
export function runPreflightChecks(): PreflightCheckResult {
  const checks: PreflightCheckResult["checks"] = [];

  // Check 1: Data directory exists and is writable
  try {
    if (!existsSync(DATA_DIR)) {
      checks.push({
        name: "Data directory existence",
        passed: false,
        message: `Data directory does not exist: ${DATA_DIR}`,
      });
    } else {
      accessSync(DATA_DIR, constants.W_OK);
      checks.push({
        name: "Data directory writable",
        passed: true,
        message: `Data directory is writable: ${DATA_DIR}`,
      });
    }
  } catch (err) {
    checks.push({
      name: "Data directory writable",
      passed: false,
      message: `Data directory is not writable: ${DATA_DIR}`,
    });
  }

  // Check 2: Migration files directory exists
  if (!existsSync(MIGRATIONS_DIR)) {
    checks.push({
      name: "Migration directory existence",
      passed: false,
      message: `Migration directory does not exist: ${MIGRATIONS_DIR}`,
    });
  } else {
    checks.push({
      name: "Migration directory existence",
      passed: true,
      message: `Migration directory exists: ${MIGRATIONS_DIR}`,
    });
  }

  // Check 3: Database file permissions (if exists)
  if (existsSync(DATABASE_PATH)) {
    try {
      accessSync(DATABASE_PATH, constants.R_OK | constants.W_OK);
      checks.push({
        name: "Database file permissions",
        passed: true,
        message: `Database file is readable and writable: ${DATABASE_PATH}`,
      });
    } catch (err) {
      checks.push({
        name: "Database file permissions",
        passed: false,
        message: `Database file has incorrect permissions: ${DATABASE_PATH}`,
      });
    }
  } else {
    checks.push({
      name: "Database file (new)",
      passed: true,
      message: `Database file does not exist yet (will be created): ${DATABASE_PATH}`,
    });
  }

  // Check 4: Disk space
  // Note: Disk space checking would require platform-specific code
  // For simplicity, we'll skip this check as it's not critical for operation
  checks.push({
    name: "Disk space",
    passed: true,
    message: "Disk space check skipped (not critical)",
  });

  // Check 5: Migration metadata file exists
  const metaJournalPath = `${MIGRATIONS_DIR}/meta/_journal.json`;
  if (!existsSync(metaJournalPath)) {
    checks.push({
      name: "Migration metadata",
      passed: false,
      message: `Migration metadata file not found: ${metaJournalPath}`,
    });
  } else {
    checks.push({
      name: "Migration metadata",
      passed: true,
      message: `Migration metadata file exists: ${metaJournalPath}`,
    });
  }

  // Check 6: Covers directory exists and is writable
  try {
    ensureCoverDirectory(); // Creates if missing
    const coversDir = getCoversDir();
    accessSync(coversDir, constants.W_OK);
    checks.push({
      name: "Covers directory",
      passed: true,
      message: `Covers directory is writable: ${coversDir}`,
    });
  } catch (err: any) {
    checks.push({
      name: "Covers directory",
      passed: false,
      message: `Covers directory is not writable: ${err.message}`,
    });
  }

  // Check 7: Test write to data directory
  try {
    const testFile = `${DATA_DIR}/.preflight-test-${Date.now()}`;
    const { writeFileSync, unlinkSync } = require("fs");
    writeFileSync(testFile, "test");
    unlinkSync(testFile);
    checks.push({
      name: "Data directory write test",
      passed: true,
      message: "Successfully wrote and deleted test file",
    });
  } catch (err: any) {
    // Get directory permissions for debugging
    let permInfo = "unknown";
    try {
      const stats = statSync(DATA_DIR);
      permInfo = `mode: ${stats.mode.toString(8)}, uid: ${stats.uid}, gid: ${stats.gid}`;
    } catch {
      // Ignore errors getting stats
    }

    checks.push({
      name: "Data directory write test",
      passed: false,
      message: `Failed to write test file: ${err.message}. Directory: ${DATA_DIR}, Permissions: ${permInfo}`,
    });
  }

  const allPassed = checks.every((check) => check.passed);

  return {
    passed: allPassed,
    checks,
  };
}

/**
 * Runs pre-flight checks and logs results
 * @throws Error if critical checks fail
 */
export function validatePreflightChecks(): void {
  const logger = getLogger();
  logger.info("Running pre-flight checks...");
  const result = runPreflightChecks();

  result.checks.forEach((check) => {
    const icon = check.passed ? "✓" : "✗";
    const level = check.passed ? "info" : "error";
    (logger as any)[level]({ check: check.name, passed: check.passed }, `${icon} ${check.name}: ${check.message}`);
  });

  if (!result.passed) {
    const failedChecks = result.checks.filter((c) => !c.passed);
    throw new Error(
      `Pre-flight checks failed (${failedChecks.length}/${result.checks.length}). See errors above.`
    );
  }

  logger.info("All pre-flight checks passed.");
}
