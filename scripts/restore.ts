#!/usr/bin/env tsx

/**
 * Database Restore Script
 * 
 * Restores the Tome database from a backup file.
 * Creates a safety backup before restoring.
 * 
 * Usage:
 *   npm run db:restore                    # Interactive mode
 *   npm run db:restore <backup-file>      # Direct restore
 *   tsx scripts/restore.ts
 * 
 * Environment Variables:
 *   DATABASE_PATH - Path to Tome database (default: ./data/tome.db)
 *   BACKUP_DIR    - Backup directory (default: ./data/backups)
 */

// IMPORTANT: Load environment variables BEFORE importing modules
import { config } from 'dotenv';
config();

import { listBackups, restoreBackup, getBackupConfig } from "@/lib/db/backup";
import * as readline from 'readline';

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function prompt(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive restore mode - list backups and prompt for selection
 */
async function interactiveRestore(cfg: ReturnType<typeof getBackupConfig>): Promise<void> {
  console.log("Interactive restore mode");
  console.log("");
  
  // List all backups
  const backups = await listBackups(cfg.backupDir);
  
  if (backups.length === 0) {
    console.log(`❌ Error: No backups found in: ${cfg.backupDir}`);
    console.log("");
    console.log("Create a backup first:");
    console.log("  npm run db:backup");
    console.log("");
    process.exit(1);
  }
  
  // Filter to only Tome backups
  const tomeBackups = backups.filter(b => b.dbName === "tome.db");
  
  if (tomeBackups.length === 0) {
    console.log(`❌ Error: No Tome database backups found in: ${cfg.backupDir}`);
    console.log("");
    console.log("Create a backup first:");
    console.log("  npm run db:backup");
    console.log("");
    process.exit(1);
  }
  
  console.log("Available backups:");
  console.log("");
  
  // Display backups
  for (let i = 0; i < tomeBackups.length; i++) {
    const backup = tomeBackups[i];
    const extra: string[] = [];
    if (backup.hasWal) extra.push("+WAL");
    if (backup.hasShm) extra.push("+SHM");
    const extraInfo = extra.length > 0 ? ` (${extra.join(", ")})` : "";
    
    console.log(`  [${i + 1}] ${backup.name} (${backup.size})`);
    console.log(`       Date: ${backup.formattedDate}`);
    console.log(`       Folder: ${backup.folder}${extraInfo}`);
    console.log("");
  }
  
  // Prompt for selection
  const selection = await prompt(`Select a backup to restore (1-${tomeBackups.length}), or 'q' to quit:\n> `);
  console.log("");
  
  if (selection.toLowerCase() === 'q') {
    console.log("Restore cancelled");
    process.exit(0);
  }
  
  // Validate selection
  const selectionNum = parseInt(selection, 10);
  if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > tomeBackups.length) {
    console.error("❌ Error: Invalid selection");
    process.exit(1);
  }
  
  const selectedBackup = tomeBackups[selectionNum - 1];
  
  console.log(`Selected backup: ${selectedBackup.name}`);
  console.log(`Date: ${selectedBackup.formattedDate}`);
  console.log("");
  console.log("⚠️  WARNING: This will overwrite the current database!");
  console.log("");
  
  // Confirm restore
  const confirm = await prompt("Are you sure you want to continue? (yes/no): ");
  console.log("");
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log("Restore cancelled");
    process.exit(0);
  }
  
  // Perform restore
  await performRestore(selectedBackup.path, cfg.tomeDbPath);
}

/**
 * Direct restore mode - restore from specified backup file
 */
async function directRestore(backupFile: string, targetPath: string): Promise<void> {
  console.log("Direct restore mode");
  console.log(`Backup file: ${backupFile}`);
  console.log("");
  console.log("⚠️  WARNING: This will overwrite the current database!");
  console.log("");
  
  // Confirm restore
  const confirm = await prompt("Are you sure you want to continue? (yes/no): ");
  console.log("");
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log("Restore cancelled");
    process.exit(0);
  }
  
  // Perform restore
  await performRestore(backupFile, targetPath);
}

/**
 * Perform the actual restore operation
 */
async function performRestore(backupPath: string, targetPath: string): Promise<void> {
  console.log(`Restoring database from: ${backupPath}`);
  console.log("");
  
  // Restore the database
  const result = await restoreBackup(backupPath, targetPath);
  
  if (!result.success) {
    console.error("❌ Restore failed:");
    console.error(`   ${result.error}`);
    console.error("");
    process.exit(1);
  }
  
  // Display results
  console.log("=== Restore Complete ===");
  console.log("");
  console.log(`✅ Database restored successfully`);
  console.log(`   Location: ${result.restoredPath}`);
  console.log(`   Size: ${result.restoredSize}`);
  
  if (result.safetyBackupPath) {
    console.log("");
    console.log(`📦 Safety backup created: ${result.safetyBackupPath}`);
  }
  
  console.log("");
  console.log("⚠️  Important: Restart the application to use the restored database");
  console.log("");
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log("=== Database Restore Utility ===");
    console.log("");
    
    const cfg = getBackupConfig();
    
    // Check if backup file was provided as argument
    const backupFile = process.argv[2];
    
    if (backupFile) {
      // Direct restore mode
      await directRestore(backupFile, cfg.tomeDbPath);
    } else {
      // Interactive restore mode
      await interactiveRestore(cfg);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error("");
    console.error("❌ Restore failed:");
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
