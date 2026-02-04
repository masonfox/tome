/**
 * Test companion migration - Should be excluded from discovery
 * Files starting with underscore are templates/excluded
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";

const migration: CompanionMigration = {
  name: "_excluded_migration",
  requiredTables: [],
  description: "Should be excluded by discovery (underscore prefix)",
  
  async execute(db) {
    // Should never execute
  }
};

export default migration;
