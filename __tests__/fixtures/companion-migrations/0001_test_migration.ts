/**
 * Test companion migration - Valid migration for testing
 * Transforms book titles to uppercase
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";

const migration: CompanionMigration = {
  name: "0001_test_migration",
  requiredTables: ["books"],
  description: "Test companion that transforms book titles to uppercase",
  
  async execute(db) {
    const books = db.prepare("SELECT id, title FROM books").all() as Array<{
      id: number;
      title: string;
    }>;
    
    const updateStmt = db.prepare("UPDATE books SET title = ? WHERE id = ?");
    
    for (const book of books) {
      updateStmt.run(book.title.toUpperCase(), book.id);
    }
  }
};

export default migration;
