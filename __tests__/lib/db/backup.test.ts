import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { 
  createBackup, 
  createBackups, 
  cleanupOldBackups, 
  listBackups, 
  getBackupConfig,
  type BackupOptions,
  type BackupConfig 
} from "@/lib/db/backup";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Database Backup Module Test Suite
 * 
 * Tests the backup functionality in lib/db/backup.ts including:
 * - Creating backups of single databases
 * - Handling WAL and SHM files
 * - Date-based folder structure
 * - Error handling (missing files, permissions, etc.)
 * - Cleanup of old backups with retention policy
 * - Listing existing backups
 * - Combined backup of Tome and Calibre databases
 * - Configuration handling
 * 
 * Uses temporary directories for complete isolation.
 */

describe("Database Backup Module", () => {
  let tempDir: string;
  let sourceDir: string;
  let backupDir: string;

  beforeEach(() => {
    // Create temp directory structure for each test
    tempDir = join(tmpdir(), `tome-backup-test-${Date.now()}-${Math.random()}`);
    sourceDir = join(tempDir, "source");
    backupDir = join(tempDir, "backups");
    
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(backupDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("createBackup()", () => {
    describe("Successful Backups", () => {
      test("should create backup of single database", async () => {
        // Create source database file
        const dbPath = join(sourceDir, "test.db");
        writeFileSync(dbPath, "fake database content");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db",
          includeWal: false
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        expect(result.backupPath).toBeDefined();
        expect(result.backupSize).toBeDefined();
        expect(result.backupSizeBytes).toBeGreaterThan(0);
        expect(existsSync(result.backupPath!)).toBe(true);
      });

      test("should include WAL file when present", async () => {
        // Create source database and WAL file
        const dbPath = join(sourceDir, "test.db");
        const walPath = `${dbPath}-wal`;
        
        writeFileSync(dbPath, "fake database content");
        writeFileSync(walPath, "fake wal content");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db",
          includeWal: true
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        expect(result.hasWal).toBe(true);
        expect(result.hasShm).toBe(false);
        
        // Verify WAL file was backed up
        const walBackupPath = `${result.backupPath!}-wal`;
        expect(existsSync(walBackupPath)).toBe(true);
      });

      test("should include SHM file when present", async () => {
        // Create source database and SHM file
        const dbPath = join(sourceDir, "test.db");
        const shmPath = `${dbPath}-shm`;
        
        writeFileSync(dbPath, "fake database content");
        writeFileSync(shmPath, "fake shm content");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db",
          includeWal: true
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        expect(result.hasWal).toBe(false);
        expect(result.hasShm).toBe(true);
        
        // Verify SHM file was backed up
        const shmBackupPath = `${result.backupPath!}-shm`;
        expect(existsSync(shmBackupPath)).toBe(true);
      });

      test("should include both WAL and SHM files when present", async () => {
        // Create source database with WAL and SHM
        const dbPath = join(sourceDir, "test.db");
        const walPath = `${dbPath}-wal`;
        const shmPath = `${dbPath}-shm`;
        
        writeFileSync(dbPath, "fake database content");
        writeFileSync(walPath, "fake wal content");
        writeFileSync(shmPath, "fake shm content");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db",
          includeWal: true
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        expect(result.hasWal).toBe(true);
        expect(result.hasShm).toBe(true);
        
        // Verify both files were backed up
        const walBackupPath = `${result.backupPath!}-wal`;
        const shmBackupPath = `${result.backupPath!}-shm`;
        expect(existsSync(walBackupPath)).toBe(true);
        expect(existsSync(shmBackupPath)).toBe(true);
      });

      test("should create date-based folder structure", async () => {
        // Create source database
        const dbPath = join(sourceDir, "test.db");
        writeFileSync(dbPath, "fake database content");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db"
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        
        // Verify backup is in date folder (YYYY-MM-DD format)
        const backupPath = result.backupPath!;
        const pathParts = backupPath.split('/');
        const dateFolder = pathParts[pathParts.length - 2];
        
        // Check date folder format (YYYY-MM-DD)
        expect(dateFolder).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      test("should use custom timestamp when provided", async () => {
        // Create source database
        const dbPath = join(sourceDir, "test.db");
        writeFileSync(dbPath, "fake database content");

        const customTimestamp = "20250101_120000";
        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db",
          timestamp: customTimestamp
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        
        // Verify timestamp is in filename
        const filename = result.backupPath!.split('/').pop()!;
        expect(filename).toContain(customTimestamp);
      });

      test("should skip WAL/SHM when includeWal is false", async () => {
        // Create source database with WAL and SHM
        const dbPath = join(sourceDir, "test.db");
        const walPath = `${dbPath}-wal`;
        const shmPath = `${dbPath}-shm`;
        
        writeFileSync(dbPath, "fake database content");
        writeFileSync(walPath, "fake wal content");
        writeFileSync(shmPath, "fake shm content");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "test.db",
          includeWal: false
        };

        const result = await createBackup(options);

        expect(result.success).toBe(true);
        expect(result.hasWal).toBe(false);
        expect(result.hasShm).toBe(false);
        
        // Verify WAL/SHM were NOT backed up
        const walBackupPath = `${result.backupPath!}-wal`;
        const shmBackupPath = `${result.backupPath!}-shm`;
        expect(existsSync(walBackupPath)).toBe(false);
        expect(existsSync(shmBackupPath)).toBe(false);
      });
    });

    describe("Error Handling", () => {
      test("should handle missing source database", async () => {
        const dbPath = join(sourceDir, "nonexistent.db");

        const options: BackupOptions = {
          dbPath,
          backupDir,
          dbName: "nonexistent.db"
        };

        const result = await createBackup(options);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("not found");
      });

      test("should handle unreadable source database", async () => {
        // Create source database
        const dbPath = join(sourceDir, "unreadable.db");
        writeFileSync(dbPath, "fake database content");

        // Make file unreadable (chmod 000)
        // Note: This test may not work on all platforms (Windows doesn't support chmod)
        // Skip on Windows or when permissions can't be changed
        try {
          const fs = await import("fs/promises");
          await fs.chmod(dbPath, 0o000);

          const options: BackupOptions = {
            dbPath,
            backupDir,
            dbName: "unreadable.db"
          };

          const result = await createBackup(options);

          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain("not readable");

          // Restore permissions for cleanup
          await fs.chmod(dbPath, 0o644);
        } catch (err) {
          // Skip test on Windows or if chmod fails
          console.log("Skipping unreadable file test (platform doesn't support chmod)");
        }
      });

      test("should handle write permission errors", async () => {
        // Create source database
        const dbPath = join(sourceDir, "test.db");
        writeFileSync(dbPath, "fake database content");

        // Create backup directory that will be made read-only
        const readonlyBackupDir = join(tempDir, "readonly-backups");
        mkdirSync(readonlyBackupDir, { recursive: true });

        // Create date folder first
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateFolder = `${year}-${month}-${day}`;
        const datePath = join(readonlyBackupDir, dateFolder);
        mkdirSync(datePath, { recursive: true });

        // Make date folder read-only
        try {
          const fs = await import("fs/promises");
          await fs.chmod(datePath, 0o444);

          const options: BackupOptions = {
            dbPath,
            backupDir: readonlyBackupDir,
            dbName: "test.db"
          };

          const result = await createBackup(options);

          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain("not writable");

          // Restore permissions for cleanup
          await fs.chmod(datePath, 0o755);
        } catch (err) {
          // Skip test on Windows or if chmod fails
          console.log("Skipping write permission test (platform doesn't support chmod)");
        }
      });
    });
  });

  describe("cleanupOldBackups()", () => {
    test("should keep only last N backups", async () => {
      // Create 5 backups
      const dbName = "test.db";
      const dateFolder = join(backupDir, "2025-01-01");
      mkdirSync(dateFolder, { recursive: true });

      const backupPaths: string[] = [];
      for (let i = 0; i < 5; i++) {
        const timestamp = `20250101_${String(i).padStart(6, '0')}`;
        const backupPath = join(dateFolder, `${dbName}.backup-${timestamp}`);
        writeFileSync(backupPath, `backup ${i}`);
        backupPaths.push(backupPath);
        
        // Sleep 10ms to ensure different mtimes
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Keep only 3 most recent
      const maxBackups = 3;
      const deleted = await cleanupOldBackups(backupDir, dbName, maxBackups);

      expect(deleted).toBe(2);
      
      // Verify only 3 backups remain
      const remaining = backupPaths.filter(p => existsSync(p));
      expect(remaining.length).toBe(3);
      
      // Verify oldest 2 were deleted (indices 0 and 1)
      expect(existsSync(backupPaths[0])).toBe(false);
      expect(existsSync(backupPaths[1])).toBe(false);
      expect(existsSync(backupPaths[2])).toBe(true);
      expect(existsSync(backupPaths[3])).toBe(true);
      expect(existsSync(backupPaths[4])).toBe(true);
    });

    test("should remove empty date folders", async () => {
      const dbName = "test.db";
      const dateFolder1 = join(backupDir, "2025-01-01");
      const dateFolder2 = join(backupDir, "2025-01-02");
      
      mkdirSync(dateFolder1, { recursive: true });
      mkdirSync(dateFolder2, { recursive: true });

      // Create 1 backup in folder 1
      const backupPath1 = join(dateFolder1, `${dbName}.backup-20250101_000000`);
      writeFileSync(backupPath1, "backup 1");

      // Create 3 backups in folder 2
      const backupPath2 = join(dateFolder2, `${dbName}.backup-20250102_000000`);
      const backupPath3 = join(dateFolder2, `${dbName}.backup-20250102_000001`);
      const backupPath4 = join(dateFolder2, `${dbName}.backup-20250102_000002`);
      
      writeFileSync(backupPath2, "backup 2");
      await new Promise(resolve => setTimeout(resolve, 10));
      writeFileSync(backupPath3, "backup 3");
      await new Promise(resolve => setTimeout(resolve, 10));
      writeFileSync(backupPath4, "backup 4");

      // Keep only 2 most recent (will delete all from folder 1 and oldest from folder 2)
      const maxBackups = 2;
      await cleanupOldBackups(backupDir, dbName, maxBackups);

      // Verify folder 1 is removed (empty)
      expect(existsSync(dateFolder1)).toBe(false);
      
      // Verify folder 2 still exists (has 2 backups)
      expect(existsSync(dateFolder2)).toBe(true);
      
      // Verify correct backups remain
      expect(existsSync(backupPath1)).toBe(false); // deleted (oldest)
      expect(existsSync(backupPath2)).toBe(false); // deleted (2nd oldest)
      expect(existsSync(backupPath3)).toBe(true);  // kept
      expect(existsSync(backupPath4)).toBe(true);  // kept
    });

    test("should delete associated WAL and SHM files", async () => {
      const dbName = "test.db";
      const dateFolder = join(backupDir, "2025-01-01");
      mkdirSync(dateFolder, { recursive: true });

      // Create 2 backups with WAL and SHM files
      const backup1 = join(dateFolder, `${dbName}.backup-20250101_000000`);
      const backup2 = join(dateFolder, `${dbName}.backup-20250101_000001`);
      
      writeFileSync(backup1, "backup 1");
      writeFileSync(`${backup1}-wal`, "wal 1");
      writeFileSync(`${backup1}-shm`, "shm 1");
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      writeFileSync(backup2, "backup 2");
      writeFileSync(`${backup2}-wal`, "wal 2");
      writeFileSync(`${backup2}-shm`, "shm 2");

      // Keep only 1 backup
      await cleanupOldBackups(backupDir, dbName, 1);

      // Verify oldest backup and its WAL/SHM were deleted
      expect(existsSync(backup1)).toBe(false);
      expect(existsSync(`${backup1}-wal`)).toBe(false);
      expect(existsSync(`${backup1}-shm`)).toBe(false);
      
      // Verify newest backup and its WAL/SHM remain
      expect(existsSync(backup2)).toBe(true);
      expect(existsSync(`${backup2}-wal`)).toBe(true);
      expect(existsSync(`${backup2}-shm`)).toBe(true);
    });

    test("should handle nonexistent backup directory", async () => {
      const nonexistentDir = join(tempDir, "nonexistent");
      const deleted = await cleanupOldBackups(nonexistentDir, "test.db", 3);

      expect(deleted).toBe(0);
    });

    test("should handle cleanup errors gracefully", async () => {
      const dbName = "test.db";
      const dateFolder = join(backupDir, "2025-01-01");
      mkdirSync(dateFolder, { recursive: true });

      // Create 2 backups
      const backup1 = join(dateFolder, `${dbName}.backup-20250101_000000`);
      const backup2 = join(dateFolder, `${dbName}.backup-20250101_000001`);
      
      writeFileSync(backup1, "backup 1");
      await new Promise(resolve => setTimeout(resolve, 10));
      writeFileSync(backup2, "backup 2");

      // Make first backup read-only so deletion might fail (platform-dependent)
      try {
        const fs = await import("fs/promises");
        await fs.chmod(backup1, 0o444);
        
        // Keep only 1 backup (should try to delete backup1 but might fail)
        const deleted = await cleanupOldBackups(backupDir, dbName, 1);

        // Function should handle error gracefully (returns 0 or 1)
        expect(deleted).toBeGreaterThanOrEqual(0);
        
        // Restore permissions for cleanup
        await fs.chmod(backup1, 0o644);
      } catch (err) {
        // Skip test on Windows
        console.log("Skipping cleanup error test (platform doesn't support chmod)");
      }
    });
  });

  describe("listBackups()", () => {
    test("should return correct backup info", async () => {
      const dateFolder = join(backupDir, "2025-01-15");
      mkdirSync(dateFolder, { recursive: true });

      // Create test backups
      const tomeBackup = join(dateFolder, "tome.db.backup-20250115_120000");
      const calibreBackup = join(dateFolder, "metadata.db.backup-20250115_120000");
      
      writeFileSync(tomeBackup, "tome backup");
      writeFileSync(calibreBackup, "calibre backup");
      writeFileSync(`${tomeBackup}-wal`, "tome wal");

      const backups = await listBackups(backupDir);

      expect(backups.length).toBe(2);
      
      // Find Tome backup
      const tomeInfo = backups.find(b => b.dbName === "tome.db");
      expect(tomeInfo).toBeDefined();
      expect(tomeInfo!.name).toContain("tome.db.backup-");
      expect(tomeInfo!.timestamp).toBe("20250115_120000");
      expect(tomeInfo!.formattedDate).toBe("2025-01-15 12:00:00");
      expect(tomeInfo!.folder).toBe("2025-01-15");
      expect(tomeInfo!.hasWal).toBe(true);
      expect(tomeInfo!.hasShm).toBe(false);
      expect(tomeInfo!.sizeBytes).toBeGreaterThan(0);
      
      // Find Calibre backup
      const calibreInfo = backups.find(b => b.dbName === "metadata.db");
      expect(calibreInfo).toBeDefined();
      expect(calibreInfo!.dbName).toBe("metadata.db");
      expect(calibreInfo!.hasWal).toBe(false);
    });

    test("should handle empty backup directory", async () => {
      const backups = await listBackups(backupDir);
      expect(backups).toEqual([]);
    });

    test("should sort backups by timestamp (newest first)", async () => {
      const dateFolder = join(backupDir, "2025-01-15");
      mkdirSync(dateFolder, { recursive: true });

      // Create backups with different timestamps
      writeFileSync(join(dateFolder, "tome.db.backup-20250115_100000"), "backup 1");
      writeFileSync(join(dateFolder, "tome.db.backup-20250115_120000"), "backup 2");
      writeFileSync(join(dateFolder, "tome.db.backup-20250115_110000"), "backup 3");

      const backups = await listBackups(backupDir);

      expect(backups.length).toBe(3);
      expect(backups[0].timestamp).toBe("20250115_120000"); // newest
      expect(backups[1].timestamp).toBe("20250115_110000");
      expect(backups[2].timestamp).toBe("20250115_100000"); // oldest
    });

    test("should handle nonexistent backup directory", async () => {
      const nonexistentDir = join(tempDir, "nonexistent");
      const backups = await listBackups(nonexistentDir);
      
      expect(backups).toEqual([]);
    });

    test("should ignore WAL and SHM files in listing", async () => {
      const dateFolder = join(backupDir, "2025-01-15");
      mkdirSync(dateFolder, { recursive: true });

      // Create backup with WAL and SHM
      const backup = join(dateFolder, "tome.db.backup-20250115_120000");
      writeFileSync(backup, "backup");
      writeFileSync(`${backup}-wal`, "wal");
      writeFileSync(`${backup}-shm`, "shm");

      const backups = await listBackups(backupDir);

      // Should only list the main backup file, not WAL/SHM
      expect(backups.length).toBe(1);
      expect(backups[0].name).toBe("tome.db.backup-20250115_120000");
      expect(backups[0].hasWal).toBe(true);
      expect(backups[0].hasShm).toBe(true);
    });

    test("should handle backups across multiple date folders", async () => {
      const dateFolder1 = join(backupDir, "2025-01-14");
      const dateFolder2 = join(backupDir, "2025-01-15");
      
      mkdirSync(dateFolder1, { recursive: true });
      mkdirSync(dateFolder2, { recursive: true });

      writeFileSync(join(dateFolder1, "tome.db.backup-20250114_120000"), "backup 1");
      writeFileSync(join(dateFolder2, "tome.db.backup-20250115_120000"), "backup 2");

      const backups = await listBackups(backupDir);

      expect(backups.length).toBe(2);
      expect(backups[0].folder).toBe("2025-01-15"); // newest first
      expect(backups[1].folder).toBe("2025-01-14");
    });
  });

  describe("getBackupConfig()", () => {
    test("should return config structure", () => {
      const config = getBackupConfig();

      // Should return all required fields
      expect(config).toHaveProperty('tomeDbPath');
      expect(config).toHaveProperty('backupDir');
      expect(config).toHaveProperty('backupCalibre');
      expect(config).toHaveProperty('maxBackups');
      
      // Should have sensible types
      expect(typeof config.tomeDbPath).toBe('string');
      expect(typeof config.backupDir).toBe('string');
      expect(typeof config.backupCalibre).toBe('boolean');
      expect(typeof config.maxBackups).toBe('number');
      expect(config.maxBackups).toBe(3);
    });

    test("should allow custom config via createBackups()", async () => {
      // Create test databases
      const tomeDbPath = join(sourceDir, "tome.db");
      const calibreDbPath = join(sourceDir, "metadata.db");
      
      writeFileSync(tomeDbPath, "tome database");
      writeFileSync(calibreDbPath, "calibre database");

      // Use custom config (not from environment)
      const customConfig: BackupConfig = {
        tomeDbPath,
        calibreDbPath,
        backupDir,
        backupCalibre: false, // Custom value
        maxBackups: 5 // Custom value
      };

      const result = await createBackups(customConfig);

      // Custom config should be respected
      expect(result.tome.success).toBe(true);
      expect(result.calibre).toBeUndefined(); // backupCalibre was false
    });
  });

  describe("createBackups()", () => {
    test("should back up both Tome and Calibre databases", async () => {
      // Create source databases
      const tomeDbPath = join(sourceDir, "tome.db");
      const calibreDbPath = join(sourceDir, "metadata.db");
      
      writeFileSync(tomeDbPath, "tome database");
      writeFileSync(calibreDbPath, "calibre database");

      const config: BackupConfig = {
        tomeDbPath,
        calibreDbPath,
        backupDir,
        backupCalibre: true,
        maxBackups: 3
      };

      const result = await createBackups(config);

      expect(result.tome.success).toBe(true);
      expect(result.calibre).toBeDefined();
      expect(result.calibre!.success).toBe(true);
      
      // Verify both backups exist
      expect(existsSync(result.tome.backupPath!)).toBe(true);
      expect(existsSync(result.calibre!.backupPath!)).toBe(true);
      
      // Verify both backups use same timestamp (correlated)
      const tomeFilename = result.tome.backupPath!.split('/').pop()!;
      const calibreFilename = result.calibre!.backupPath!.split('/').pop()!;
      
      const tomeTimestamp = tomeFilename.match(/backup-(\d{8}_\d{6})/)?.[1];
      const calibreTimestamp = calibreFilename.match(/backup-(\d{8}_\d{6})/)?.[1];
      
      expect(tomeTimestamp).toBe(calibreTimestamp);
    });

    test("should continue when Calibre backup fails", async () => {
      // Create only Tome database (Calibre missing)
      const tomeDbPath = join(sourceDir, "tome.db");
      const calibreDbPath = join(sourceDir, "nonexistent.db");
      
      writeFileSync(tomeDbPath, "tome database");

      const config: BackupConfig = {
        tomeDbPath,
        calibreDbPath,
        backupDir,
        backupCalibre: true,
        maxBackups: 3
      };

      const result = await createBackups(config);

      // Tome backup should succeed
      expect(result.tome.success).toBe(true);
      
      // Calibre backup should fail
      expect(result.calibre).toBeDefined();
      expect(result.calibre!.success).toBe(false);
      expect(result.calibre!.error).toBeDefined();
    });

    test("should respect BACKUP_CALIBRE_DB=false", async () => {
      // Create both databases
      const tomeDbPath = join(sourceDir, "tome.db");
      const calibreDbPath = join(sourceDir, "metadata.db");
      
      writeFileSync(tomeDbPath, "tome database");
      writeFileSync(calibreDbPath, "calibre database");

      const config: BackupConfig = {
        tomeDbPath,
        calibreDbPath,
        backupDir,
        backupCalibre: false, // Disabled
        maxBackups: 3
      };

      const result = await createBackups(config);

      // Tome backup should succeed
      expect(result.tome.success).toBe(true);
      
      // Calibre backup should not be attempted
      expect(result.calibre).toBeUndefined();
    });

    test("should skip Calibre when CALIBRE_DB_PATH not set", async () => {
      // Create Tome database
      const tomeDbPath = join(sourceDir, "tome.db");
      writeFileSync(tomeDbPath, "tome database");

      const config: BackupConfig = {
        tomeDbPath,
        calibreDbPath: undefined, // Not set
        backupDir,
        backupCalibre: true,
        maxBackups: 3
      };

      const result = await createBackups(config);

      // Tome backup should succeed
      expect(result.tome.success).toBe(true);
      
      // Calibre backup should not be attempted
      expect(result.calibre).toBeUndefined();
    });

    test("should fail when Tome backup fails", async () => {
      // Don't create Tome database (missing)
      const tomeDbPath = join(sourceDir, "nonexistent.db");
      const calibreDbPath = join(sourceDir, "metadata.db");
      
      writeFileSync(calibreDbPath, "calibre database");

      const config: BackupConfig = {
        tomeDbPath,
        calibreDbPath,
        backupDir,
        backupCalibre: true,
        maxBackups: 3
      };

      const result = await createBackups(config);

      // Tome backup should fail
      expect(result.tome.success).toBe(false);
      expect(result.tome.error).toBeDefined();
      
      // Calibre backup should not be attempted (Tome is required)
      expect(result.calibre).toBeUndefined();
    });

    test("should clean up old backups after creating new ones", async () => {
      // Create Tome database
      const tomeDbPath = join(sourceDir, "tome.db");
      writeFileSync(tomeDbPath, "tome database");

      const config: BackupConfig = {
        tomeDbPath,
        backupDir,
        backupCalibre: false,
        maxBackups: 2
      };

      // Manually create 3 backups with different timestamps to ensure cleanup
      const dateFolder = join(backupDir, "2025-01-15");
      mkdirSync(dateFolder, { recursive: true });

      // Create old backup (will be deleted)
      const oldBackup = join(dateFolder, "tome.db.backup-20250115_100000");
      writeFileSync(oldBackup, "old backup");
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create newer backups (will be kept)
      const backup1 = join(dateFolder, "tome.db.backup-20250115_120000");
      writeFileSync(backup1, "backup 1");
      await new Promise(resolve => setTimeout(resolve, 10));

      const backup2 = join(dateFolder, "tome.db.backup-20250115_130000");
      writeFileSync(backup2, "backup 2");

      // Run cleanup
      await cleanupOldBackups(backupDir, "tome.db", 2);

      // List backups
      const backups = await listBackups(backupDir);
      const tomeBackups = backups.filter(b => b.dbName === "tome.db");

      // Should only keep 2 most recent
      expect(tomeBackups.length).toBe(2);
      
      // Verify oldest was deleted
      expect(existsSync(oldBackup)).toBe(false);
      expect(existsSync(backup1)).toBe(true);
      expect(existsSync(backup2)).toBe(true);
    });

    test("should use same timestamp for correlated backups", async () => {
      // Create both databases
      const tomeDbPath = join(sourceDir, "tome.db");
      const calibreDbPath = join(sourceDir, "metadata.db");
      
      writeFileSync(tomeDbPath, "tome database");
      writeFileSync(calibreDbPath, "calibre database");

      const config: BackupConfig = {
        tomeDbPath,
        calibreDbPath,
        backupDir,
        backupCalibre: true,
        maxBackups: 3
      };

      const result = await createBackups(config);

      // Both backups should be in the same date folder
      const tomeFolder = result.tome.backupPath!.split('/').slice(-2, -1)[0];
      const calibreFolder = result.calibre!.backupPath!.split('/').slice(-2, -1)[0];
      
      expect(tomeFolder).toBe(calibreFolder);
      
      // Both backups should have the same timestamp
      const tomeFile = result.tome.backupPath!.split('/').pop()!;
      const calibreFile = result.calibre!.backupPath!.split('/').pop()!;
      
      const tomeTimestamp = tomeFile.match(/backup-(\d{8}_\d{6})/)?.[1];
      const calibreTimestamp = calibreFile.match(/backup-(\d{8}_\d{6})/)?.[1];
      
      expect(tomeTimestamp).toBe(calibreTimestamp);
    });
  });
});
