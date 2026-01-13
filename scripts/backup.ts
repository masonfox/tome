#!/usr/bin/env tsx

/**
 * Manual Database Backup Script
 * 
 * Creates timestamped backups of Tome and (optionally) Calibre databases.
 * Includes WAL and SHM files for consistency.
 * 
 * Usage:
 *   npm run db:backup
 *   tsx scripts/backup.ts
 * 
 * Environment Variables:
 *   DATABASE_PATH      - Path to Tome database (default: ./data/tome.db)
 *   CALIBRE_DB_PATH    - Path to Calibre database (optional)
 *   BACKUP_DIR         - Backup directory (default: ./data/backups)
 *   BACKUP_CALIBRE_DB  - Enable Calibre backups (default: true)
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { createBackups, listBackups, getBackupConfig } from "@/lib/db/backup";

async function main() {
  try {
    console.log("=== Database Backup Utility ===");
    console.log("");
    
    const cfg = getBackupConfig();
    
    // Show configuration
    console.log("Configuration:");
    console.log(`  Tome DB: ${cfg.tomeDbPath}`);
    if (cfg.calibreDbPath) {
      console.log(`  Calibre DB: ${cfg.calibreDbPath}`);
      console.log(`  Backup Calibre: ${cfg.backupCalibre ? 'yes' : 'no'}`);
    } else {
      console.log(`  Calibre DB: not configured`);
    }
    console.log(`  Backup directory: ${cfg.backupDir}`);
    console.log(`  Retention: last ${cfg.maxBackups} backups`);
    console.log("");
    
    // Create backups
    console.log("Creating backup(s)...");
    const result = await createBackups();
    console.log("");
    
    // Show Tome backup result
    if (result.tome.success) {
      console.log("✅ Tome database backed up successfully");
      console.log(`   Location: ${result.tome.backupPath}`);
      console.log(`   Size: ${result.tome.backupSize}`);
      if (result.tome.hasWal) console.log(`   + WAL file`);
      if (result.tome.hasShm) console.log(`   + SHM file`);
    } else {
      console.error("❌ Tome database backup failed");
      console.error(`   Error: ${result.tome.error}`);
      process.exit(1);
    }
    
    console.log("");
    
    // Show Calibre backup result
    if (result.calibre) {
      if (result.calibre.success) {
        console.log("✅ Calibre database backed up successfully");
        console.log(`   Location: ${result.calibre.backupPath}`);
        console.log(`   Size: ${result.calibre.backupSize}`);
        if (result.calibre.hasWal) console.log(`   + WAL file`);
        if (result.calibre.hasShm) console.log(`   + SHM file`);
      } else {
        console.warn("⚠️  Calibre database backup failed");
        console.warn(`   Error: ${result.calibre.error}`);
        console.warn(`   (Tome backup succeeded, continuing)`);
      }
      console.log("");
    }
    
    // List all backups
    const allBackups = await listBackups(cfg.backupDir);
    const tomeBackups = allBackups.filter(b => b.dbName === "tome.db");
    const calibreBackups = allBackups.filter(b => b.dbName === "metadata.db");
    
    console.log("Total backups:");
    console.log(`  📚 Tome: ${tomeBackups.length}`);
    if (calibreBackups.length > 0) {
      console.log(`  📚 Calibre: ${calibreBackups.length}`);
    }
    console.log("");
    
    if (allBackups.length > cfg.maxBackups * 2) {
      console.log("💡 Tip: Old backups are automatically cleaned up");
      console.log(`   Only the last ${cfg.maxBackups} backups of each database are kept`);
      console.log("");
    }
    
    console.log("=== Backup Complete ===");
    console.log("");
    console.log("To list all backups:");
    console.log("  npm run db:list-backups");
    console.log("");
    console.log("To restore a backup:");
    console.log("  npm run db:restore");
    console.log("");
    
    process.exit(0);
  } catch (error: any) {
    console.error("");
    console.error("❌ Backup failed:");
    console.error(`   ${error.message}`);
    console.error("");
    
    if (error.stack) {
      console.error("Stack trace:");
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

main();
