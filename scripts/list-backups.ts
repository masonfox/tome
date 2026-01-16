#!/usr/bin/env tsx

/**
 * List Database Backups Script
 * 
 * Lists all available database backups with details.
 * Sorted by date (newest first).
 * 
 * Usage:
 *   npm run db:list-backups
 *   tsx scripts/list-backups.ts
 * 
 * Environment Variables:
 *   BACKUP_DIR - Backup directory (default: ./data/backups)
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { listBackups, getBackupConfig } from "@/lib/db/backup";

async function main() {
  try {
    console.log("=== Database Backup List ===");
    console.log("");
    
    const cfg = getBackupConfig();
    
    // List all backups
    const allBackups = await listBackups(cfg.backupDir);
    
    if (allBackups.length === 0) {
      console.log(`No backups found in: ${cfg.backupDir}`);
      console.log("");
      console.log("Create your first backup:");
      console.log("  npm run db:backup");
      console.log("");
      process.exit(0);
    }
    
    // Separate by database type
    const tomeBackups = allBackups.filter(b => b.dbName === "tome.db");
    const calibreBackups = allBackups.filter(b => b.dbName === "metadata.db");
    
    console.log(`Found ${allBackups.length} backup(s) in: ${cfg.backupDir}`);
    console.log(`  📚 Tome: ${tomeBackups.length}`);
    if (calibreBackups.length > 0) {
      console.log(`  📚 Calibre: ${calibreBackups.length}`);
    }
    console.log("");
    
    // Calculate total size
    const totalSize = allBackups.reduce((sum, b) => sum + b.sizeBytes, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
    
    // Group backups by date folder
    const byFolder = allBackups.reduce((acc, backup) => {
      if (!acc[backup.folder]) {
        acc[backup.folder] = [];
      }
      acc[backup.folder].push(backup);
      return acc;
    }, {} as Record<string, typeof allBackups>);
    
    // Display each date folder
    let index = 1;
    for (const folder of Object.keys(byFolder).sort().reverse()) {
      console.log(`📁 ${folder}:`);
      console.log("");
      
      const folderBackups = byFolder[folder].sort((a, b) => 
        b.timestamp.localeCompare(a.timestamp)
      );
      
      for (const backup of folderBackups) {
        const extra: string[] = [];
        if (backup.hasWal) extra.push("+WAL");
        if (backup.hasShm) extra.push("+SHM");
        const extraInfo = extra.length > 0 ? ` (${extra.join(", ")})` : "";
        
        console.log(`  [${index}] ${backup.dbName === "tome.db" ? "📗" : "📘"} ${backup.dbName}`);
        console.log(`      Time: ${backup.formattedDate}`);
        console.log(`      Size: ${backup.size}${extraInfo}`);
        console.log(`      Path: ${backup.path}`);
        console.log("");
        
        index++;
      }
    }
    
    console.log("Summary:");
    console.log(`  Total backups: ${allBackups.length}`);
    console.log(`  Total size: ${totalSizeMB}MB`);
    console.log(`  Retention policy: Last ${cfg.maxBackups} backup folders (date-based)`);
    console.log("");
    
    if (allBackups.length > cfg.maxBackups * 2) {
      console.log("💡 Old backups are automatically cleaned up when new backups are created");
      console.log("");
    }
    
    console.log("Backup Management Commands:");
    console.log("  Create new backup:   npm run db:backup");
    console.log("  Restore from backup: npm run db:restore");
    console.log("");
    
    console.log("=== End of Backup List ===");
    console.log("");
    
    process.exit(0);
  } catch (error: any) {
    console.error("");
    console.error("❌ Failed to list backups:");
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
