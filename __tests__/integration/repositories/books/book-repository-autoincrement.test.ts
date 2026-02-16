/**
 * AUTOINCREMENT Sequence Leak Regression Test
 * 
 * Bug: Drizzle's onConflictDoUpdate() caused SQLite to increment AUTOINCREMENT 
 * sequence even during UPDATE operations, leaking ~851 IDs per sync cycle.
 * 
 * Fix: Split operations into bulkInsert() and bulkUpdate() so:
 * - INSERT advances sequence (correct behavior)
 * - UPDATE does not advance sequence (correct behavior)
 * 
 * This test verifies that UPDATE operations don't leak the sequence.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, clearTestDatabase, getTestSqlite } from "@/__tests__/helpers/db-setup";
import type { NewBook } from "@/lib/db/schema/books";

describe("BookRepository - AUTOINCREMENT sequence regression test", () => {
  const testFilePath = __filename;

  beforeEach(() => {
    setupTestDatabase(testFilePath);
    clearTestDatabase(testFilePath);
  });

  // Helper to get current sequence value
  const getSequence = (sqlite: any): number => {
    const result = sqlite.prepare(
      "SELECT seq FROM sqlite_sequence WHERE name = 'books'"
    ).get() as { seq: number } | undefined;
    return result?.seq || 0;
  };

  test("bulkInsert: should advance sequence by number of books inserted", async () => {
    const sqlite = getTestSqlite(testFilePath);

    // Insert 10 books
    const books: NewBook[] = Array.from({ length: 10 }, (_, i) => ({
      calibreId: i + 1,
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/books/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    const before = getSequence(sqlite);
    await bookRepository.bulkInsert(books);
    const after = getSequence(sqlite);
    
    expect(after - before).toBe(10);
  });

  test("bulkUpdate: should NOT advance sequence (critical regression check)", async () => {
    const sqlite = getTestSqlite(testFilePath);

    // Step 1: Insert 10 books first
    const books: NewBook[] = Array.from({ length: 10 }, (_, i) => ({
      calibreId: i + 100, // Use unique range to avoid conflicts
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/books/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    const beforeInsert = getSequence(sqlite);
    await bookRepository.bulkInsert(books);
    const sequenceAfterInsert = getSequence(sqlite);
    expect(sequenceAfterInsert - beforeInsert).toBe(10);

    // Step 2: Update the same 10 books (simulate a sync)
    const updatedBooks = books.map(b => ({
      ...b,
      title: `${b.title} - Updated`,
      lastSynced: new Date(),
    }));
    
    await bookRepository.bulkUpdate(updatedBooks);
    const sequenceAfterUpdate = getSequence(sqlite);
    
    // CRITICAL: Sequence should NOT have changed during update
    expect(sequenceAfterUpdate).toBe(sequenceAfterInsert);
    
    // Step 3: Do it again to be sure (this is where the bug showed up in production)
    await bookRepository.bulkUpdate(updatedBooks);
    const sequenceAfterSecondUpdate = getSequence(sqlite);
    
    expect(sequenceAfterSecondUpdate).toBe(sequenceAfterInsert);
  });

  test("bulkUpdate: multiple cycles should never advance sequence", async () => {
    const sqlite = getTestSqlite(testFilePath);

    // Insert 10 books
    const books: NewBook[] = Array.from({ length: 10 }, (_, i) => ({
      calibreId: i + 200, // Use unique range to avoid conflicts
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    await bookRepository.bulkInsert(books);
    const sequenceAfterInsert = getSequence(sqlite);

    // Perform 5 update cycles (simulating 5 syncs)
    for (let cycle = 1; cycle <= 5; cycle++) {
      const updated = books.map(b => ({
        ...b,
        title: `${b.title} - Cycle ${cycle}`,
        lastSynced: new Date(),
      }));
      
      await bookRepository.bulkUpdate(updated);
      
      const sequenceAfterCycle = getSequence(sqlite);
      expect(sequenceAfterCycle).toBe(sequenceAfterInsert);
    }
  });

  test("bulkInsert + bulkUpdate: mixed operations work correctly", async () => {
    const sqlite = getTestSqlite(testFilePath);

    // Insert 5 initial books
    const initialBooks: NewBook[] = Array.from({ length: 5 }, (_, i) => ({
      calibreId: i + 300, // Use unique range to avoid conflicts
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    const beforeInitial = getSequence(sqlite);
    await bookRepository.bulkInsert(initialBooks);
    const sequenceAfterInitial = getSequence(sqlite);
    expect(sequenceAfterInitial - beforeInitial).toBe(5);
    
    // Update 3 existing books
    const booksToUpdate = initialBooks.slice(0, 3).map(b => ({
      ...b,
      title: `${b.title} - Updated`,
    }));
    
    await bookRepository.bulkUpdate(booksToUpdate);
    
    // Sequence should not change
    expect(getSequence(sqlite)).toBe(sequenceAfterInitial);
    
    // Insert 3 new books
    const newBooks: NewBook[] = Array.from({ length: 3 }, (_, i) => ({
      calibreId: i + 306, // Continue unique range
      title: `New Book ${i + 6}`,
      authors: ["Author"],
      path: `/book${i + 6}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    await bookRepository.bulkInsert(newBooks);
    
    // Sequence should advance by 3
    expect(getSequence(sqlite)).toBe(sequenceAfterInitial + 3);
  });

  test("REGRESSION: 851 books scenario from production", async () => {
    const sqlite = getTestSqlite(testFilePath);

    // Simulate production: 851 books
    const productionSize = 851;
    const books: NewBook[] = Array.from({ length: productionSize }, (_, i) => ({
      calibreId: i + 1000, // Use unique range to avoid conflicts
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    // Initial sync: insert all books
    const beforeInsert = getSequence(sqlite);
    await bookRepository.bulkInsert(books);
    const sequenceAfterInsert = getSequence(sqlite);
    expect(sequenceAfterInsert - beforeInsert).toBe(851);
    
    // Re-sync (all updates): This is where the bug occurred in production
    // Before fix: sequence would jump by +851 (leak)
    // After fix: sequence stays unchanged
    const updatedBooks = books.map(b => ({
      ...b,
      lastSynced: new Date(),
    }));
    
    await bookRepository.bulkUpdate(updatedBooks);
    const sequenceAfterUpdate = getSequence(sqlite);
    
    // CRITICAL: No leak!
    expect(sequenceAfterUpdate).toBe(sequenceAfterInsert);
    
    // Do it again to verify stability
    await bookRepository.bulkUpdate(updatedBooks);
    expect(getSequence(sqlite)).toBe(sequenceAfterInsert);
  });
});
