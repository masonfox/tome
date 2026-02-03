#!/usr/bin/env tsx
/**
 * Migration Script: Fix Books Without Active Sessions
 * 
 * This script fixes books that were left without active sessions due to the
 * delete session bug where deleting inactive "read" sessions didn't create
 * a new active "to-read" session.
 * 
 * Issue: When users deleted "read" sessions (is_active = 0), no new session
 * was created, leaving books without active sessions.
 * 
 * Fix: Create a new "to-read" session with is_active = 1 for affected books.
 * 
 * Run with: npx tsx scripts/fix-books-without-active-sessions.ts
 */

import { createDatabase } from "@/lib/db/factory";
import { setDatabase } from "@/lib/db/context";
import { books } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { sql } from "drizzle-orm";

const DB_PATH = process.env.DATABASE_PATH || "./data/tome.db";

async function main() {
  console.log("🔧 Starting migration: Fix books without active sessions\n");

  // Initialize database
  const { db } = createDatabase({
    path: DB_PATH,
    schema: { books, readingSessions },
    wal: true,
  });

  // Set database context for repositories
  setDatabase(db);

  // Find books without active sessions
  // This includes both books with no sessions and books with only inactive sessions
  const booksWithoutActiveSessions = db
    .select({
      bookId: books.id,
      title: books.title,
    })
    .from(books)
    .leftJoin(
      readingSessions,
      sql`${readingSessions.bookId} = ${books.id} AND ${readingSessions.isActive} = 1`
    )
    .where(sql`${readingSessions.id} IS NULL`)
    .all();

  console.log(`📊 Found ${booksWithoutActiveSessions.length} books without active sessions\n`);

  if (booksWithoutActiveSessions.length === 0) {
    console.log("✅ No books need fixing. All books have active sessions.");
    return;
  }

  // Show affected books
  console.log("📚 Affected books:");
  booksWithoutActiveSessions.slice(0, 10).forEach((book: { bookId: number; title: string }) => {
    console.log(`  - ${book.title} (ID: ${book.bookId})`);
  });
  if (booksWithoutActiveSessions.length > 10) {
    console.log(`  ... and ${booksWithoutActiveSessions.length - 10} more\n`);
  } else {
    console.log();
  }

  // For each affected book, create an active "to-read" session using the repository
  let fixed = 0;
  let errors = 0;

  for (const book of booksWithoutActiveSessions as Array<{ bookId: number; title: string }>) {
    try {
      // Get the next available session number for this book
      const nextSessionNumber = await sessionRepository.getNextSessionNumber(book.bookId);

      // Create new active "to-read" session using repository
      await sessionRepository.create({
        bookId: book.bookId,
        sessionNumber: nextSessionNumber,
        status: "to-read",
        isActive: true,
        userId: null, // No specific user (for single-user setup)
      });

      fixed++;
      console.log(`✅ Fixed: ${book.title} (ID: ${book.bookId}) - Created session #${nextSessionNumber}`);
    } catch (error) {
      errors++;
      console.error(`❌ Error fixing ${book.title} (ID: ${book.bookId}):`, error);
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`  ✅ Fixed: ${fixed} books`);
  if (errors > 0) {
    console.log(`  ❌ Errors: ${errors} books`);
  }

  // Verify results
  const remainingBooksWithoutActiveSessions = db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(books)
    .leftJoin(
      readingSessions,
      sql`${readingSessions.bookId} = ${books.id} AND ${readingSessions.isActive} = 1`
    )
    .where(sql`${readingSessions.id} IS NULL`)
    .get();

  const remaining = remainingBooksWithoutActiveSessions?.count || 0;
  console.log(`\n🔍 Verification: ${remaining} books still without active sessions`);

  if (remaining === 0) {
    console.log("✅ All books now have active sessions!");
  } else {
    console.log(`⚠️  ${remaining} books still need attention`);
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
