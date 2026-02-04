/**
 * Companion Migration Template
 * 
 * Use this template to create new companion migrations for schema changes
 * that require semantic data transformations.
 * 
 * Steps:
 * 1. Copy this file to lib/migrations/{migration_number}_{description}.ts
 * 2. Update the migration object with your transformation logic
 * 3. Test with both fresh and existing databases
 * 4. Commit alongside the corresponding Drizzle schema migration
 * 
 * Example: drizzle/0017_add_feature.sql → lib/migrations/0017_feature_data_migration.ts
 * 
 * See: docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "XXXX_migration_name" });

const migration: CompanionMigration = {
  // Unique name for tracking (matches filename without extension)
  name: "XXXX_migration_name",
  
  // Tables that must exist for this migration to run
  // If these tables don't exist (fresh database), migration is skipped
  requiredTables: ["table_name"],
  
  // Optional description
  description: "Brief description of what this migration does",
  
  // Transformation logic
  async execute(db) {
    logger.info("Starting data transformation...");
    
    // Example: Get rows that need transformation
    const rows = db.prepare(
      "SELECT id, column_name FROM table_name WHERE condition"
    ).all() as Array<{ id: number; column_name: any }>;
    
    logger.info({ count: rows.length }, "Found rows to transform");
    
    if (rows.length === 0) {
      logger.info("No rows need transformation");
      return;
    }
    
    // Example: Transform data
    const updateStmt = db.prepare(
      "UPDATE table_name SET column_name = ? WHERE id = ?"
    );
    
    let transformed = 0;
    for (const row of rows) {
      try {
        // Your transformation logic here
        const newValue = transformValue(row.column_name);
        
        updateStmt.run(newValue, row.id);
        transformed++;
        
        // Log progress every 100 records
        if (transformed % 100 === 0) {
          logger.info({ transformed, total: rows.length }, "Progress");
        }
      } catch (error) {
        logger.error({ id: row.id, error }, "Failed to transform record");
        throw error; // Abort on error (transaction will rollback)
      }
    }
    
    logger.info({ transformed }, "Transformation complete");
  }
};

// Helper function example
function transformValue(value: any): any {
  // Your transformation logic
  return value;
}

export default migration;
