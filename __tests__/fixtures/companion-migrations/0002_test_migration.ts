/**
 * Test companion migration - Second migration for testing ordering
 * Appends suffix to book titles
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";

const migration: CompanionMigration = {
  name: "0002_test_migration",
  requiredTables: ["books"],
  description: "Test companion that appends suffix to book titles",
  
  async execute(db) {
    const books = db.prepare("SELECT id, title FROM books").all() as Array<{
      id: number;
      title: string;
    }>;
    
    const updateStmt = db.prepare("UPDATE books SET title = ? WHERE id = ?");
    
    for (const book of books) {
      updateStmt.run(book.title + " [TRANSFORMED]", book.id);
    }
  }
};

export default migration;
