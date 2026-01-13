/**
 * Database Backup Module
 * 
 * Provides unified backup functionality for both Tome and Calibre databases.
 * Used by Docker entrypoint (automatic backups before migrations) and CLI scripts (manual backups).
 * 
 * Features:
 * - Backs up SQLite database files including WAL and SHM files
 * - Stores backups in date-based folders for organization
 * - Implements retention policy (keeps last N backups)
 * - Supports both Tome and Calibre databases
 * - Graceful error handling with detailed logging
 * 
 * @module lib/db/backup
 */

import { getLogger } from "@/lib/logger";
import { existsSync, statSync, accessSync, constants, mkdirSync, copyFileSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { dirname, join, basename } from "path";

// Lazy environment configuration - read at function call time to ensure .env is loaded
function getEnvConfig() {
  return {
    DATABASE_PATH: process.env.DATABASE_PATH || "./data/tome.db",
    CALIBRE_DB_PATH: process.env.CALIBRE_DB_PATH || "",
    BACKUP_DIR: process.env.BACKUP_DIR || "./data/backups",
    BACKUP_CALIBRE_DB: process.env.BACKUP_CALIBRE_DB !== "false",
    MAX_BACKUPS: 3
  };
}

/**
 * Options for creating a single database backup
 */
export interface BackupOptions {
  /** Path to the source database file */
  dbPath: string;
  /** Directory to store backups */
  backupDir: string;
  /** Base name for the database (e.g., "tome.db" or "metadata.db") */
  dbName: string;
  /** Whether to include WAL and SHM files (default: true) */
  includeWal?: boolean;
  /** Timestamp to use for backup naming (default: current time) */
  timestamp?: string;
}

/**
 * Result of a backup operation
 */
export interface BackupResult {
  /** Whether the backup succeeded */
  success: boolean;
  /** Full path to the backup file (if successful) */
  backupPath?: string;
  /** Human-readable size of the backup (if successful) */
  backupSize?: string;
  /** Size in bytes (if successful) */
  backupSizeBytes?: number;
  /** Error message (if failed) */
  error?: string;
  /** Whether WAL file was backed up */
  hasWal?: boolean;
  /** Whether SHM file was backed up */
  hasShm?: boolean;
}

/**
 * Configuration for backing up both databases
 */
export interface BackupConfig {
  /** Path to Tome database */
  tomeDbPath: string;
  /** Path to Calibre database (optional) */
  calibreDbPath?: string;
  /** Directory to store backups */
  backupDir: string;
  /** Whether to backup Calibre database */
  backupCalibre: boolean;
  /** Maximum number of backups to keep */
  maxBackups: number;
}

/**
 * Information about an existing backup
 */
export interface BackupInfo {
  /** Full path to the backup file */
  path: string;
  /** Filename */
  name: string;
  /** Timestamp from filename (YYYYMMDD_HHMMSS) */
  timestamp: string;
  /** Human-readable date (YYYY-MM-DD HH:MM:SS) */
  formattedDate: string;
  /** Database name (tome.db or metadata.db) */
  dbName: string;
  /** Human-readable size */
  size: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Whether WAL file exists */
  hasWal: boolean;
  /** Whether SHM file exists */
  hasShm: boolean;
  /** Date folder name */
  folder: string;
}

/**
 * Combined result of backing up both databases
 */
export interface BackupsResult {
  /** Result of Tome database backup */
  tome: BackupResult;
  /** Result of Calibre database backup (if attempted) */
  calibre?: BackupResult;
}

/**
 * Lazy logger initialization to prevent issues during instrumentation phase
 */
let logger: any = null;
function getLoggerSafe() {
  if (process.env.NODE_ENV === 'test') {
    return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, fatal: () => {} };
  }
  if (!logger) {
    logger = getLogger();
  }
  return logger;
}

/**
 * Generate a timestamp string in the format YYYYMMDD_HHMMSS
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Generate a date folder name in the format YYYY-MM-DD
 */
function generateDateFolder(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a size in bytes to human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/**
 * Parse timestamp from backup filename
 * Format: tome.db.backup-YYYYMMDD_HHMMSS or metadata.db.backup-YYYYMMDD_HHMMSS
 */
function parseTimestamp(filename: string): string | null {
  const match = filename.match(/backup-(\d{8}_\d{6})/);
  return match ? match[1] : null;
}

/**
 * Format a timestamp string to human-readable date
 */
function formatTimestamp(timestamp: string): string {
  // timestamp format: YYYYMMDD_HHMMSS
  const datePart = timestamp.substring(0, 8);
  const timePart = timestamp.substring(9);
  
  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);
  
  const hours = timePart.substring(0, 2);
  const minutes = timePart.substring(2, 4);
  const seconds = timePart.substring(4, 6);
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Create a backup of a single database file
 * 
 * @param options - Backup options
 * @returns Promise resolving to backup result
 */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  const log = getLoggerSafe();
  const includeWal = options.includeWal !== false;
  const timestamp = options.timestamp || generateTimestamp();
  const dateFolder = generateDateFolder();
  
  try {
    // Validate source database exists
    if (!existsSync(options.dbPath)) {
      const error = `Database file not found: ${options.dbPath}`;
      log.warn({ dbPath: options.dbPath }, error);
      return { success: false, error };
    }
    
    // Validate source database is readable
    try {
      accessSync(options.dbPath, constants.R_OK);
    } catch (err) {
      const error = `Database file is not readable: ${options.dbPath}`;
      log.warn({ dbPath: options.dbPath, err }, error);
      return { success: false, error };
    }
    
    // Create backup directory structure
    const backupFolder = join(options.backupDir, dateFolder);
    if (!existsSync(backupFolder)) {
      mkdirSync(backupFolder, { recursive: true });
      log.debug({ backupFolder }, "Created backup folder");
    }
    
    // Validate backup directory is writable
    try {
      accessSync(backupFolder, constants.W_OK);
    } catch (err) {
      const error = `Backup directory is not writable: ${backupFolder}`;
      log.error({ backupFolder, err }, error);
      return { success: false, error };
    }
    
    // Generate backup filename
    const backupName = `${options.dbName}.backup-${timestamp}`;
    const backupPath = join(backupFolder, backupName);
    
    // Copy main database file
    log.debug({ source: options.dbPath, destination: backupPath }, "Copying database file");
    copyFileSync(options.dbPath, backupPath);
    
    // Get backup file size
    const stats = statSync(backupPath);
    const backupSizeBytes = stats.size;
    const backupSize = formatSize(backupSizeBytes);
    
    // Copy WAL and SHM files if they exist and includeWal is true
    let hasWal = false;
    let hasShm = false;
    
    if (includeWal) {
      const walPath = `${options.dbPath}-wal`;
      if (existsSync(walPath)) {
        const backupWalPath = `${backupPath}-wal`;
        log.debug({ source: walPath, destination: backupWalPath }, "Copying WAL file");
        copyFileSync(walPath, backupWalPath);
        hasWal = true;
      }
      
      const shmPath = `${options.dbPath}-shm`;
      if (existsSync(shmPath)) {
        const backupShmPath = `${backupPath}-shm`;
        log.debug({ source: shmPath, destination: backupShmPath }, "Copying SHM file");
        copyFileSync(shmPath, backupShmPath);
        hasShm = true;
      }
    }
    
    log.info({
      dbName: options.dbName,
      backupPath,
      size: backupSize,
      hasWal,
      hasShm
    }, `Backup created successfully: ${backupName}`);
    
    return {
      success: true,
      backupPath,
      backupSize,
      backupSizeBytes,
      hasWal,
      hasShm
    };
  } catch (error: any) {
    const errorMessage = `Failed to create backup: ${error.message}`;
    log.error({ dbPath: options.dbPath, error: error.message, stack: error.stack }, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Clean up old backups, keeping only the most recent N backups
 * 
 * @param backupDir - Directory containing backups
 * @param dbName - Database name to clean up (e.g., "tome.db" or "metadata.db")
 * @param maxBackups - Maximum number of backups to keep
 * @returns Promise resolving to number of backups deleted
 */
export async function cleanupOldBackups(
  backupDir: string,
  dbName: string,
  maxBackups: number
): Promise<number> {
  const log = getLoggerSafe();
  
  try {
    if (!existsSync(backupDir)) {
      log.debug({ backupDir }, "Backup directory does not exist, skipping cleanup");
      return 0;
    }
    
    // Find all backups for this database across all date folders
    const backups: { path: string; mtime: number }[] = [];
    
    // Recursively search date folders
    const dateFolders = readdirSync(backupDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => join(backupDir, dirent.name));
    
    for (const folder of dateFolders) {
      const files = readdirSync(folder, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .filter(dirent => dirent.name.startsWith(`${dbName}.backup-`))
        .filter(dirent => !dirent.name.endsWith('-wal') && !dirent.name.endsWith('-shm'))
        .map(dirent => {
          const fullPath = join(folder, dirent.name);
          const stats = statSync(fullPath);
          return { path: fullPath, mtime: stats.mtimeMs };
        });
      
      backups.push(...files);
    }
    
    // Sort by modification time (newest first)
    backups.sort((a, b) => b.mtime - a.mtime);
    
    // Delete backups beyond maxBackups
    let deletedCount = 0;
    const backupsToDelete = backups.slice(maxBackups);
    
    for (const backup of backupsToDelete) {
      try {
        log.debug({ path: backup.path }, "Deleting old backup");
        unlinkSync(backup.path);
        
        // Delete associated WAL and SHM files if they exist
        const walPath = `${backup.path}-wal`;
        if (existsSync(walPath)) {
          unlinkSync(walPath);
          log.debug({ path: walPath }, "Deleted WAL file");
        }
        
        const shmPath = `${backup.path}-shm`;
        if (existsSync(shmPath)) {
          unlinkSync(shmPath);
          log.debug({ path: shmPath }, "Deleted SHM file");
        }
        
        deletedCount++;
      } catch (error: any) {
        log.warn({ path: backup.path, error: error.message }, "Failed to delete old backup");
      }
    }
    
    // Clean up empty date folders
    for (const folder of dateFolders) {
      try {
        const files = readdirSync(folder);
        if (files.length === 0) {
          rmdirSync(folder);
          log.debug({ folder }, "Removed empty date folder");
        }
      } catch (error: any) {
        log.debug({ folder, error: error.message }, "Failed to remove empty folder");
      }
    }
    
    if (deletedCount > 0) {
      log.info({ dbName, deletedCount, maxBackups }, `Cleaned up ${deletedCount} old backup(s)`);
    }
    
    return deletedCount;
  } catch (error: any) {
    log.error({ backupDir, dbName, error: error.message }, "Failed to clean up old backups");
    return 0;
  }
}

/**
 * List all backups in the backup directory
 * 
 * @param backupDir - Directory containing backups
 * @returns Promise resolving to array of backup information
 */
export async function listBackups(backupDir: string): Promise<BackupInfo[]> {
  const log = getLoggerSafe();
  
  try {
    if (!existsSync(backupDir)) {
      log.debug({ backupDir }, "Backup directory does not exist");
      return [];
    }
    
    const backups: BackupInfo[] = [];
    
    // Recursively search date folders
    const dateFolders = readdirSync(backupDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({ name: dirent.name, path: join(backupDir, dirent.name) }));
    
    for (const folder of dateFolders) {
      const files = readdirSync(folder.path, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .filter(dirent => dirent.name.includes('.backup-'))
        .filter(dirent => !dirent.name.endsWith('-wal') && !dirent.name.endsWith('-shm'));
      
      for (const file of files) {
        const fullPath = join(folder.path, file.name);
        const stats = statSync(fullPath);
        
        // Parse database name (tome.db or metadata.db)
        const dbName = file.name.split('.backup-')[0];
        
        // Parse timestamp
        const timestamp = parseTimestamp(file.name);
        if (!timestamp) continue;
        
        // Check for WAL and SHM files
        const hasWal = existsSync(`${fullPath}-wal`);
        const hasShm = existsSync(`${fullPath}-shm`);
        
        backups.push({
          path: fullPath,
          name: file.name,
          timestamp,
          formattedDate: formatTimestamp(timestamp),
          dbName,
          size: formatSize(stats.size),
          sizeBytes: stats.size,
          hasWal,
          hasShm,
          folder: folder.name
        });
      }
    }
    
    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    return backups;
  } catch (error: any) {
    log.error({ backupDir, error: error.message }, "Failed to list backups");
    return [];
  }
}

/**
 * Get backup configuration from environment variables
 * 
 * @returns Backup configuration
 */
export function getBackupConfig(): BackupConfig {
  const env = getEnvConfig();
  return {
    tomeDbPath: env.DATABASE_PATH,
    calibreDbPath: env.CALIBRE_DB_PATH || undefined,
    backupDir: env.BACKUP_DIR,
    backupCalibre: env.BACKUP_CALIBRE_DB,
    maxBackups: env.MAX_BACKUPS
  };
}

/**
 * Create backups of both Tome and Calibre databases
 * 
 * This is the main entry point for creating backups. It:
 * 1. Backs up Tome database (required)
 * 2. Backs up Calibre database (optional, if configured)
 * 3. Cleans up old backups for both databases
 * 
 * @param config - Optional backup configuration (defaults to environment variables)
 * @returns Promise resolving to combined backup results
 */
export async function createBackups(config?: BackupConfig): Promise<BackupsResult> {
  const log = getLoggerSafe();
  const cfg = config || getBackupConfig();
  
  // Use the same timestamp for both backups to keep them correlated
  const timestamp = generateTimestamp();
  
  log.info({
    tomeDbPath: cfg.tomeDbPath,
    calibreDbPath: cfg.calibreDbPath,
    backupCalibre: cfg.backupCalibre
  }, "Starting database backup(s)");
  
  // 1. Backup Tome database (required)
  const tomeResult = await createBackup({
    dbPath: cfg.tomeDbPath,
    backupDir: cfg.backupDir,
    dbName: "tome.db",
    includeWal: true,
    timestamp
  });
  
  if (!tomeResult.success) {
    log.error({ error: tomeResult.error }, "Tome database backup failed");
    return { tome: tomeResult };
  }
  
  // 2. Backup Calibre database (optional)
  let calibreResult: BackupResult | undefined;
  
  if (cfg.backupCalibre && cfg.calibreDbPath) {
    calibreResult = await createBackup({
      dbPath: cfg.calibreDbPath,
      backupDir: cfg.backupDir,
      dbName: "metadata.db",
      includeWal: true,
      timestamp
    });
    
    if (!calibreResult.success) {
      log.warn({
        error: calibreResult.error,
        calibreDbPath: cfg.calibreDbPath
      }, "Calibre database backup failed, but continuing (Tome backup succeeded)");
    }
  } else if (cfg.backupCalibre && !cfg.calibreDbPath) {
    log.info("Calibre backup enabled but CALIBRE_DB_PATH not set, skipping Calibre backup");
  } else {
    log.info("Calibre backup disabled via BACKUP_CALIBRE_DB=false");
  }
  
  // 3. Clean up old backups for both databases
  const tomeDeleted = await cleanupOldBackups(cfg.backupDir, "tome.db", cfg.maxBackups);
  if (calibreResult?.success) {
    await cleanupOldBackups(cfg.backupDir, "metadata.db", cfg.maxBackups);
  }
  
  log.info({
    tomeBackup: tomeResult.success,
    calibreBackup: calibreResult?.success || false,
    oldBackupsDeleted: tomeDeleted
  }, "Backup process completed");
  
  return {
    tome: tomeResult,
    calibre: calibreResult
  };
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  /** Whether the restore succeeded */
  success: boolean;
  /** Full path to the restored database (if successful) */
  restoredPath?: string;
  /** Human-readable size of restored database (if successful) */
  restoredSize?: string;
  /** Path to safety backup created before restore (if successful) */
  safetyBackupPath?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Validate that a backup file is a valid SQLite database
 * 
 * @param backupPath - Path to backup file to validate
 * @returns Promise resolving to validation result
 */
export async function validateBackup(backupPath: string): Promise<{ valid: boolean; error?: string }> {
  const log = getLoggerSafe();
  
  try {
    if (!existsSync(backupPath)) {
      return { valid: false, error: `Backup file not found: ${backupPath}` };
    }
    
    // Check file is readable
    try {
      accessSync(backupPath, constants.R_OK);
    } catch (err) {
      return { valid: false, error: `Backup file is not readable: ${backupPath}` };
    }
    
    // Check if it's a valid SQLite database using better-sqlite3
    try {
      const Database = require('better-sqlite3');
      const db = new Database(backupPath, { readonly: true });
      
      // Run integrity check
      const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      db.close();
      
      if (result.integrity_check !== 'ok') {
        return { valid: false, error: 'Backup file failed integrity check' };
      }
      
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Backup file is not a valid SQLite database: ${err.message}` };
    }
  } catch (error: any) {
    log.error({ backupPath, error: error.message }, 'Failed to validate backup');
    return { valid: false, error: `Validation failed: ${error.message}` };
  }
}

/**
 * Restore a database from a backup file
 * 
 * This function:
 * 1. Validates the backup file
 * 2. Creates a safety backup of the current database (if it exists)
 * 3. Restores the backup file to the target location
 * 4. Restores WAL and SHM files if they exist
 * 5. Validates the restored database
 * 
 * @param backupPath - Path to the backup file to restore
 * @param targetPath - Path where the database should be restored
 * @returns Promise resolving to restore result
 */
export async function restoreBackup(backupPath: string, targetPath: string): Promise<RestoreResult> {
  const log = getLoggerSafe();
  
  try {
    // 1. Validate backup file
    log.info({ backupPath }, 'Validating backup file');
    const validation = await validateBackup(backupPath);
    if (!validation.valid) {
      log.error({ backupPath, error: validation.error }, 'Backup validation failed');
      return { success: false, error: validation.error };
    }
    
    // 2. Create safety backup of current database (if it exists)
    let safetyBackupPath: string | undefined;
    if (existsSync(targetPath)) {
      log.info({ targetPath }, 'Creating safety backup of current database');
      
      const timestamp = generateTimestamp();
      const dateFolder = generateDateFolder();
      const backupFolder = join(dirname(targetPath), 'backups', dateFolder);
      const dbName = basename(targetPath);
      
      if (!existsSync(backupFolder)) {
        mkdirSync(backupFolder, { recursive: true });
      }
      
      safetyBackupPath = join(backupFolder, `${dbName}.before-restore-${timestamp}`);
      
      try {
        copyFileSync(targetPath, safetyBackupPath);
        
        // Copy WAL and SHM files if they exist
        if (existsSync(`${targetPath}-wal`)) {
          copyFileSync(`${targetPath}-wal`, `${safetyBackupPath}-wal`);
        }
        if (existsSync(`${targetPath}-shm`)) {
          copyFileSync(`${targetPath}-shm`, `${safetyBackupPath}-shm`);
        }
        
        log.info({ safetyBackupPath }, 'Safety backup created');
      } catch (error: any) {
        log.error({ targetPath, safetyBackupPath, error: error.message }, 'Failed to create safety backup');
        return { success: false, error: `Failed to create safety backup: ${error.message}` };
      }
    } else {
      log.info({ targetPath }, 'No existing database to backup (fresh install)');
    }
    
    // 3. Restore the database file
    log.info({ backupPath, targetPath }, 'Restoring database');
    try {
      // Ensure target directory exists
      const targetDir = dirname(targetPath);
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      
      copyFileSync(backupPath, targetPath);
    } catch (error: any) {
      log.error({ backupPath, targetPath, error: error.message }, 'Failed to restore database');
      return { success: false, error: `Failed to restore database: ${error.message}` };
    }
    
    // 4. Restore WAL and SHM files if they exist
    const walBackupPath = `${backupPath}-wal`;
    if (existsSync(walBackupPath)) {
      log.debug({ walBackupPath }, 'Restoring WAL file');
      try {
        copyFileSync(walBackupPath, `${targetPath}-wal`);
      } catch (error: any) {
        log.warn({ walBackupPath, error: error.message }, 'Failed to restore WAL file');
      }
    }
    
    const shmBackupPath = `${backupPath}-shm`;
    if (existsSync(shmBackupPath)) {
      log.debug({ shmBackupPath }, 'Restoring SHM file');
      try {
        copyFileSync(shmBackupPath, `${targetPath}-shm`);
      } catch (error: any) {
        log.warn({ shmBackupPath, error: error.message }, 'Failed to restore SHM file');
      }
    }
    
    // 5. Validate restored database
    log.info({ targetPath }, 'Validating restored database');
    const restoredValidation = await validateBackup(targetPath);
    if (!restoredValidation.valid) {
      log.error({ targetPath, error: restoredValidation.error }, 'Restored database validation failed');
      return {
        success: false,
        error: `Restored database failed validation: ${restoredValidation.error}`
      };
    }
    
    // Get restored database size
    const stats = statSync(targetPath);
    const restoredSize = formatSize(stats.size);
    
    log.info({
      backupPath,
      targetPath,
      restoredSize,
      safetyBackupPath
    }, 'Database restored successfully');
    
    return {
      success: true,
      restoredPath: targetPath,
      restoredSize,
      safetyBackupPath
    };
  } catch (error: any) {
    log.error({ backupPath, targetPath, error: error.message, stack: error.stack }, 'Restore failed');
    return { success: false, error: `Restore failed: ${error.message}` };
  }
}

/**
 * CLI execution support
 * Allows this module to be run directly as a script
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  (async () => {
    const dockerMode = process.argv.includes('--docker-mode');
    
    try {
      if (!dockerMode) {
        console.log("=== Database Backup Utility ===");
        console.log("");
      }
      
      const result = await createBackups();
      
      if (result.tome.success) {
        if (!dockerMode) {
          console.log(`✅ Tome database backed up: ${result.tome.backupPath}`);
          console.log(`   Size: ${result.tome.backupSize}`);
          if (result.tome.hasWal) console.log(`   + WAL file`);
          if (result.tome.hasShm) console.log(`   + SHM file`);
        } else {
          console.log(`Tome backup created: ${result.tome.backupSize}`);
        }
      } else {
        console.error(`❌ Tome database backup failed: ${result.tome.error}`);
        process.exit(1);
      }
      
      if (result.calibre) {
        if (result.calibre.success) {
          if (!dockerMode) {
            console.log(`✅ Calibre database backed up: ${result.calibre.backupPath}`);
            console.log(`   Size: ${result.calibre.backupSize}`);
            if (result.calibre.hasWal) console.log(`   + WAL file`);
            if (result.calibre.hasShm) console.log(`   + SHM file`);
          } else {
            console.log(`Calibre backup created: ${result.calibre.backupSize}`);
          }
        } else {
          console.warn(`⚠️  Calibre database backup failed: ${result.calibre.error}`);
        }
      }
      
      if (!dockerMode) {
        console.log("");
        console.log("Backup(s) created successfully!");
      }
      
      process.exit(0);
    } catch (error: any) {
      console.error(`❌ Backup failed: ${error.message}`);
      process.exit(1);
    }
  })();
}
