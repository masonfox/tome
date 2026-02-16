/**
 * AUTOINCREMENT Sequence Leak Regression Test
 * 
 * Bug: Drizzle's onConflictDoUpdate() caused SQLite to increment AUTOINCREMENT 
 * sequence even during UPDATE operations, leaking ~851 IDs per sync cycle.
 * 
 * Fix: Changed bulkUpsert() to check existence first (SELECT), then UPDATE 
 * (no sequence change) or INSERT (sequence advances correctly).
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

  test("CRITICAL: UPDATE operations must not advance AUTOINCREMENT sequence", async () => {
    const sqlite = getTestSqlite(testFilePath);
    
    // Helper to get current sequence value
    const getSequence = (): number => {
      const result = sqlite.prepare(
        "SELECT seq FROM sqlite_sequence WHERE name = 'books'"
      ).get() as { seq: number } | undefined;
      return result?.seq || 0;
    };

    // Step 1: Insert 10 books
    const books: NewBook[] = Array.from({ length: 10 }, (_, i) => ({
      calibreId: i + 1,
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/books/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    await bookRepository.bulkUpsert(books);
    
    const sequenceAfterInsert = getSequence();
    expect(sequenceAfterInsert).toBe(10); // Should be 10 after inserting 10 books

    // Step 2: Update the same 10 books (simulate a sync)
    const updatedBooks = books.map(b => ({
      ...b,
      lastSynced: new Date(),
    }));
    
    await bookRepository.bulkUpsert(updatedBooks);
    
    const sequenceAfterUpdate = getSequence();
    
    // CRITICAL: Sequence should NOT have changed during update
    expect(sequenceAfterUpdate).toBe(sequenceAfterInsert);
    
    // Step 3: Do it again to be sure (this is where the bug showed up in production)
    await bookRepository.bulkUpsert(updatedBooks);
    const sequenceAfterSecondUpdate = getSequence();
    
    expect(sequenceAfterSecondUpdate).toBe(sequenceAfterInsert);
  });

  test("INSERT operations should correctly advance sequence", async () => {
    const sqlite = getTestSqlite(testFilePath);
    
    const getSequence = (): number => {
      const result = sqlite.prepare(
        "SELECT seq FROM sqlite_sequence WHERE name = 'books'"
      ).get() as { seq: number } | undefined;
      return result?.seq || 0;
    };

    const sequenceBefore = getSequence();

    // Insert 5 books
    await bookRepository.bulkUpsert(
      Array.from({ length: 5 }, (_, i) => ({
        calibreId: i + 100, // Use high IDs to avoid conflicts with other tests
        title: `Book ${i + 1}`,
        authors: ["Author"],
        path: `/book${i + 1}`,
        lastSynced: new Date(),
        addedToLibrary: new Date(),
      }))
    );
    
    expect(getSequence()).toBe(sequenceBefore + 5);
    
    // Insert 5 more books
    await bookRepository.bulkUpsert(
      Array.from({ length: 5 }, (_, i) => ({
        calibreId: i + 200, // Use high IDs to avoid conflicts
        title: `Book ${i + 6}`,
        authors: ["Author"],
        path: `/book${i + 6}`,
        lastSynced: new Date(),
        addedToLibrary: new Date(),
      }))
    );
    
    expect(getSequence()).toBe(sequenceBefore + 10);
  });

  test("Mixed INSERT and UPDATE should only advance sequence for new books", async () => {
    const sqlite = getTestSqlite(testFilePath);
    
    const getSequence = (): number => {
      const result = sqlite.prepare(
        "SELECT seq FROM sqlite_sequence WHERE name = 'books'"
      ).get() as { seq: number } | undefined;
      return result?.seq || 0;
    };

    // Insert 5 books
    const initialBooks: NewBook[] = Array.from({ length: 5 }, (_, i) => ({
      calibreId: i + 300, // Use high IDs to avoid conflicts
      title: `Book ${i + 1}`,
      authors: ["Author"],
      path: `/book${i + 1}`,
      lastSynced: new Date(),
      addedToLibrary: new Date(),
    }));
    
    await bookRepository.bulkUpsert(initialBooks);
    const sequenceAfterInitial = getSequence();
    
    // Update 3 existing + Insert 3 new
    const mixedBooks: NewBook[] = [
      { ...initialBooks[0], title: "Updated 1" },
      { ...initialBooks[1], title: "Updated 2" },
      { ...initialBooks[2], title: "Updated 3" },
      {
        calibreId: 400,
        title: "New Book 6",
        authors: ["Author"],
        path: "/book6",
        lastSynced: new Date(),
        addedToLibrary: new Date(),
      },
      {
        calibreId: 401,
        title: "New Book 7",
        authors: ["Author"],
        path: "/book7",
        lastSynced: new Date(),
        addedToLibrary: new Date(),
      },
      {
        calibreId: 402,
        title: "New Book 8",
        authors: ["Author"],
        path: "/book8",
        lastSynced: new Date(),
        addedToLibrary: new Date(),
      },
    ];
    
    await bookRepository.bulkUpsert(mixedBooks);
    
    // Sequence should only advance by 3 (for the 3 new books)
    expect(getSequence()).toBe(sequenceAfterInitial + 3);
  });
});
