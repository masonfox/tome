/**
 * Test Data Helpers
 * 
 * Reusable helper functions for creating test data in a consistent way.
 * These helpers reduce boilerplate in test files and make tests more readable.
 * 
 * Usage:
 * ```typescript
 * import { createTestBook, createTestBookWithSession } from "@/__tests__/helpers/test-data-helpers";
 * 
 * const book = await createTestBook({ totalPages: 300 });
 * const { book, session } = await createTestBookWithSession({ totalPages: 300 });
 * ```
 */

import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { NewBook } from "@/lib/db/schema/books";
import type { NewReadingSession } from "@/lib/db/schema/reading-sessions";
import type { NewProgressLog } from "@/lib/db/schema/progress-logs";

/**
 * Create a test book with sensible defaults
 */
export async function createTestBook(overrides?: Partial<NewBook>) {
  return bookRepository.create({
    calibreId: Math.floor(Math.random() * 1000000),
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    path: "Test Author/Test Book (1)",
    orphaned: false,
    ...overrides,
  });
}

/**
 * Create a test book with an active reading session
 */
export async function createTestBookWithSession(
  bookOverrides?: Partial<NewBook>,
  sessionOverrides?: Partial<NewReadingSession>
) {
  const book = await createTestBook(bookOverrides);
  
  const session = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "reading",
    isActive: true,
    ...sessionOverrides,
  });
  
  return { book, session };
}

/**
 * Create a test book with session and progress
 */
export async function createTestBookWithProgress(
  bookOverrides?: Partial<NewBook>,
  sessionOverrides?: Partial<NewReadingSession>,
  progressOverrides?: Partial<NewProgressLog>
) {
  const { book, session } = await createTestBookWithSession(bookOverrides, sessionOverrides);
  
  const progress = await progressRepository.create({
    sessionId: session.id,
    currentPage: 50,
    currentPercentage: book.totalPages ? Math.floor((50 / book.totalPages) * 100) : null,
    ...progressOverrides,
  });
  
  return { book, session, progress };
}

/**
 * Create multiple test books
 */
export async function createTestBooks(count: number, overrides?: Partial<NewBook>) {
  const books = [];
  for (let i = 0; i < count; i++) {
    const book = await createTestBook({
      calibreId: Math.floor(Math.random() * 1000000),
      title: `Test Book ${i + 1}`,
      ...overrides,
    });
    books.push(book);
  }
  return books;
}
