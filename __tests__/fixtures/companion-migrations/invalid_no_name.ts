/**
 * Test companion migration - Invalid (missing name field)
 * Should be skipped by discovery
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";

const migration = {
  // name: "invalid_migration", // Missing!
  requiredTables: ["books"],
  description: "Invalid companion missing name field",
  
  async execute(db: any) {
    // Should never execute
  }
} as any;

export default migration;
