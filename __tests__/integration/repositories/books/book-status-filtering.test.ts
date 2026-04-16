import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../../../fixtures/test-data";

/**
 * BookRepository Status Filtering Tests
 * 
 * Tests status filtering in findWithFilters() and findWithFiltersAndRelations() methods.
 * 
 * Key behaviors:
 * - "read" and "dnf" statuses are terminal states - should include all sessions (is_active can be 0 or 1)
 * - "to-read", "read-next", "reading" statuses should only include active sessions (is_active = 1)
 * 
 * This tests the fix for the DNF filter bug where DNF books were not showing up
 * because the code was requiring is_active = 1 for DNF status.
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("BookRepository Status Filter - Terminal States", () => {
  test("should filter books by 'read' status (terminal state)", async () => {
    // Arrange: Create books with different statuses
    const readBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Finished Book",
      authors: ["Author 1"],
      path: "Author 1/Finished Book (1)",
    }));

    const readingBook = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Currently Reading",
      authors: ["Author 2"],
      path: "Author 2/Currently Reading (2)",
    }));

    // Create read session (inactive)
    await sessionRepository.create({
      bookId: readBook.id,
      userId: null,
      sessionNumber: 1,
      status: "read",
      isActive: false, // Read sessions are inactive
      startedDate: "2026-01-01",
      completedDate: "2026-01-15",
    });

    // Create reading session (active)
    await sessionRepository.create({
      bookId: readingBook.id,
      userId: null,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Act: Filter by 'read' status
    const result = await bookRepository.findWithFilters({ status: "read" }, 50, 0);

    // Assert: Should only return the read book
    expect(result.books).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.books[0].id).toBe(readBook.id);
  });

  test("should filter books by 'dnf' status (terminal state)", async () => {
    // Arrange: Create books with different statuses
    const dnfBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "DNF Book",
      authors: ["Author 1"],
      path: "Author 1/DNF Book (1)",
    }));

    const readingBook = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Currently Reading",
      authors: ["Author 2"],
      path: "Author 2/Currently Reading (2)",
    }));

    // Create DNF session (inactive)
    await sessionRepository.create({
      bookId: dnfBook.id,
      userId: null,
      sessionNumber: 1,
      status: "dnf",
      isActive: false, // DNF sessions are inactive
      startedDate: "2026-01-01",
    });

    // Create reading session (active)
    await sessionRepository.create({
      bookId: readingBook.id,
      userId: null,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Act: Filter by 'dnf' status
    const result = await bookRepository.findWithFilters({ status: "dnf" }, 50, 0);

    // Assert: Should only return the DNF book
    expect(result.books).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.books[0].id).toBe(dnfBook.id);
  });

  test("should include DNF books even when is_active = 0", async () => {
    // Arrange: Create a DNF book with inactive session
    const dnfBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "DNF Book Inactive",
      authors: ["Author 1"],
      path: "Author 1/DNF Book Inactive (1)",
    }));

    // Create DNF session with is_active = 0 (archived)
    await sessionRepository.create({
      bookId: dnfBook.id,
      userId: null,
      sessionNumber: 1,
      status: "dnf",
      isActive: false, // This is the critical test - DNF sessions should be inactive
      startedDate: "2026-01-01",
    });

    // Act: Filter by 'dnf' status
    const result = await bookRepository.findWithFilters({ status: "dnf" }, 50, 0);

    // Assert: Should return the DNF book
    expect(result.books).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.books[0].id).toBe(dnfBook.id);
  });

  test("should handle book with both DNF and active session", async () => {
    // Arrange: Create a book that was DNF'd and then added back
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book with Multiple Sessions",
      authors: ["Author 1"],
      path: "Author 1/Book with Multiple Sessions (1)",
    }));

    // First session: DNF (inactive)
    await sessionRepository.create({
      bookId: book.id,
      userId: null,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-01",
    });

    // Second session: read-next (active)
    await sessionRepository.create({
      bookId: book.id,
      userId: null,
      sessionNumber: 2,
      status: "read-next",
      isActive: true,
    });

    // Act: Filter by 'dnf' status
    const dnfResult = await bookRepository.findWithFilters({ status: "dnf" }, 50, 0);

    // Assert: Should return the book (it has a DNF session)
    expect(dnfResult.books).toHaveLength(1);
    expect(dnfResult.total).toBe(1);
    expect(dnfResult.books[0].id).toBe(book.id);

    // Also verify it appears in read-next filter
    const readNextResult = await bookRepository.findWithFilters({ status: "read-next" }, 50, 0);
    expect(readNextResult.books).toHaveLength(1);
    expect(readNextResult.books[0].id).toBe(book.id);
  });
});

describe("BookRepository Status Filter - Active States", () => {
  test("should filter books by 'reading' status (only active sessions)", async () => {
    // Arrange: Create books
    const activeBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Active Reading",
      authors: ["Author 1"],
      path: "Author 1/Active Reading (1)",
    }));

    const inactiveBook = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Inactive Reading",
      authors: ["Author 2"],
      path: "Author 2/Inactive Reading (2)",
    }));

    // Create active reading session
    await sessionRepository.create({
      bookId: activeBook.id,
      userId: null,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create inactive reading session (edge case - shouldn't happen in practice)
    await sessionRepository.create({
      bookId: inactiveBook.id,
      userId: null,
      sessionNumber: 1,
      status: "reading",
      isActive: false,
    });

    // Act: Filter by 'reading' status
    const result = await bookRepository.findWithFilters({ status: "reading" }, 50, 0);

    // Assert: Should only return the active reading book
    expect(result.books).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.books[0].id).toBe(activeBook.id);
  });

  test("should filter books by 'to-read' status (only active sessions)", async () => {
    // Arrange
    const activeBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Active To-Read",
      authors: ["Author 1"],
      path: "Author 1/Active To-Read (1)",
    }));

    await sessionRepository.create({
      bookId: activeBook.id,
      userId: null,
      sessionNumber: 1,
      status: "to-read",
      isActive: true,
    });

    // Act
    const result = await bookRepository.findWithFilters({ status: "to-read" }, 50, 0);

    // Assert
    expect(result.books).toHaveLength(1);
    expect(result.books[0].id).toBe(activeBook.id);
  });

  test("should filter books by 'read-next' status (only active sessions)", async () => {
    // Arrange
    const activeBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Active Read-Next",
      authors: ["Author 1"],
      path: "Author 1/Active Read-Next (1)",
    }));

    await sessionRepository.create({
      bookId: activeBook.id,
      userId: null,
      sessionNumber: 1,
      status: "read-next",
      isActive: true,
    });

    // Act
    const result = await bookRepository.findWithFilters({ status: "read-next" }, 50, 0);

    // Assert
    expect(result.books).toHaveLength(1);
    expect(result.books[0].id).toBe(activeBook.id);
  });
});

describe("BookRepository Status Filter - findWithFiltersAndRelations()", () => {
  test("should filter books by 'dnf' status using findWithFiltersAndRelations", async () => {
    // Arrange: Create DNF book
    const dnfBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "DNF Book",
      authors: ["Author 1"],
      path: "Author 1/DNF Book (1)",
    }));

    await sessionRepository.create({
      bookId: dnfBook.id,
      userId: null,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-01",
    });

    // Act: Filter using findWithFiltersAndRelations
    const result = await bookRepository.findWithFiltersAndRelations({ status: "dnf" }, 50, 0);

    // Assert
    expect(result.books).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.books[0].id).toBe(dnfBook.id);
  });

  test("should filter books by 'read' status using findWithFiltersAndRelations", async () => {
    // Arrange: Create read book
    const readBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Read Book",
      authors: ["Author 1"],
      path: "Author 1/Read Book (1)",
    }));

    await sessionRepository.create({
      bookId: readBook.id,
      userId: null,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2026-01-01",
      completedDate: "2026-01-15",
    });

    // Act
    const result = await bookRepository.findWithFiltersAndRelations({ status: "read" }, 50, 0);

    // Assert
    expect(result.books).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.books[0].id).toBe(readBook.id);
  });
});
