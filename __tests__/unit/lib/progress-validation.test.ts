import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";
import {
  validateProgressTimeline,
  validateProgressEdit,
} from "@/lib/services/progress-validation";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { type NewBook } from "@/lib/db/schema/books";

describe("Progress Validation Service", () => {
  // Test book data
  const testBook: NewBook = {
    calibreId: 1,
    title: "Test Book",
    path: "Test Author/Test Book (1)",
    totalPages: 400,
    authors: ["Test Author"],
  };

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("validateProgressTimeline", () => {
    test("should allow first progress entry for a session", async () => {
      // Setup: Create book and session
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      // Test: First entry should always be valid
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-01"),
        100, // 100 pages
        false // using pages, not percentage
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should allow progress that increases from previous entry", async () => {
      // Setup: Create book, session, and initial progress
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Progress on later date with higher page count should be valid
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        200, // 200 pages (increased from 100)
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should reject progress that is less than previous entry", async () => {
      // Setup: Create book, session, and initial progress
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Progress on later date with LOWER page count should be invalid
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        100, // 100 pages (less than previous 200)
        false
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least page 200");
      expect(result.error).toContain("Nov 5, 2025");
      expect(result.conflictingEntry).toBeDefined();
      expect(result.conflictingEntry?.type).toBe("before");
      expect(result.conflictingEntry?.progress).toBe(200);
    });

    test("should reject progress that exceeds future entry", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      // Create progress on Nov 15
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 75,
        pagesRead: 300,
        progressDate: new Date("2025-11-15"),
      });

      // Test: Adding progress on Nov 10 that exceeds Nov 15's progress should fail
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        350, // 350 pages (more than future entry's 300)
        false
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot exceed page 300");
      expect(result.error).toContain("Nov 15, 2025");
      expect(result.conflictingEntry).toBeDefined();
      expect(result.conflictingEntry?.type).toBe("after");
      expect(result.conflictingEntry?.progress).toBe(300);
    });

    test("should allow progress between two existing entries", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      // Create progress on Nov 5 (100 pages)
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      // Create progress on Nov 15 (300 pages)
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 75,
        pagesRead: 200,
        progressDate: new Date("2025-11-15"),
      });

      // Test: Adding progress on Nov 10 between 100 and 300 should be valid
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        200, // Between 100 and 300
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should validate using percentage instead of pages", async () => {
      // Setup: Create book, session, and initial progress
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25.0,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Progress with lower percentage should fail
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        20.0, // 20% (less than previous 25%)
        true // Use percentage
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least 25.0%");
      expect(result.error).toContain("Nov 5, 2025");
    });

    test("should allow equal progress on later date", async () => {
      // Setup: Create book, session, and initial progress
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Same progress on later date should be valid (e.g., no reading happened)
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        100, // Same as previous
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should handle multiple entries and find maximum before date", async () => {
      // Setup: Create book, session, and multiple progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 150,
        currentPercentage: 37.5,
        pagesRead: 50,
        progressDate: new Date("2025-11-08"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: new Date("2025-11-10"),
      });

      // Test: New entry on Nov 12 must be >= 200 (the max before that date)
      const resultValid = await validateProgressTimeline(
        session.id,
        new Date("2025-11-12"),
        250,
        false
      );
      expect(resultValid.valid).toBe(true);

      const resultInvalid = await validateProgressTimeline(
        session.id,
        new Date("2025-11-12"),
        180, // Less than 200
        false
      );
      expect(resultInvalid.valid).toBe(false);
      expect(resultInvalid.error).toContain("must be at least page 200");
      expect(resultInvalid.error).toContain("Nov 10, 2025");
    });
  });

  describe("validateProgressEdit", () => {
    test("should allow editing entry when new values maintain temporal order", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 100,
        progressDate: new Date("2025-11-10"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 75,
        pagesRead: 100,
        progressDate: new Date("2025-11-15"),
      });

      // Test: Edit middle entry to 220 pages (between 100 and 300) should be valid
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-10"),
        220,
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should reject edit that violates temporal order with previous entry", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 150,
        currentPercentage: 37.5,
        pagesRead: 150,
        progressDate: new Date("2025-11-05"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: new Date("2025-11-10"),
      });

      // Test: Edit to 100 pages (less than previous 150) should fail
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-10"),
        100,
        false
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least page 150");
      expect(result.error).toContain("Nov 5, 2025");
    });

    test("should reject edit that violates temporal order with future entry", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-10"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 250,
        currentPercentage: 62.5,
        pagesRead: 50,
        progressDate: new Date("2025-11-15"),
      });

      // Test: Edit to 300 pages (more than future 250) should fail
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-10"),
        300,
        false
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot exceed page 250");
      expect(result.error).toContain("Nov 15, 2025");
    });

    test("should exclude the entry being edited from validation", async () => {
      // Setup: Create book, session, and single progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-10"),
      });

      // Test: Editing the only entry should always be valid (nothing to compare against)
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-10"),
        100, // Even reducing progress should be OK when it's the only entry
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should allow changing date of entry if progress still valid", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 100,
        progressDate: new Date("2025-11-10"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 75,
        pagesRead: 100,
        progressDate: new Date("2025-11-15"),
      });

      // Test: Moving entry from Nov 10 to Nov 12 with same progress should be valid
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-12"), // Changed date
        200, // Same progress
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should validate using percentage for edit", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25.0,
        pagesRead: 100,
        progressDate: new Date("2025-11-05"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50.0,
        pagesRead: 100,
        progressDate: new Date("2025-11-10"),
      });

      // Test: Edit to percentage less than previous entry should fail
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-10"),
        20.0, // 20% (less than previous 25%)
        true // Use percentage
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least 25.0%");
    });

    test("should handle edge case of editing to same values", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      const entryToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-10"),
      });

      // Test: "Editing" to same values should always be valid
      const result = await validateProgressEdit(
        entryToEdit.id,
        session.id,
        new Date("2025-11-10"), // Same date
        200, // Same progress
        false
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Error message formatting", () => {
    test("should format dates in user-friendly way", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-05T12:30:00.000Z"),
      });

      // Test: Error message should format date nicely
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        100,
        false
      );

      expect(result.error).toContain("Nov 5, 2025");
    });

    test("should show page number with 'page' prefix", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Error for pages should show "page 200"
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        100,
        false
      );

      expect(result.error).toContain("page 200");
    });

    test("should show percentage with % suffix", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50.5,
        pagesRead: 200,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Error for percentage should show "50.5%"
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        40.0,
        true // Use percentage
      );

      expect(result.error).toContain("50.5%");
    });
  });

  describe("Conflicting entry information", () => {
    test("should return conflicting entry details for 'before' validation failures", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      const previousEntry = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-05"),
      });

      // Test: Conflicting entry should include ID and details
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        100,
        false
      );

      expect(result.valid).toBe(false);
      expect(result.conflictingEntry).toBeDefined();
      expect(result.conflictingEntry?.id).toBe(previousEntry.id);
      expect(result.conflictingEntry?.type).toBe("before");
      expect(result.conflictingEntry?.progress).toBe(200);
      expect(result.conflictingEntry?.date).toBe("Nov 5, 2025");
    });

    test("should return conflicting entry details for 'after' validation failures", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      const futureEntry = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 200,
        progressDate: new Date("2025-11-15"),
      });

      // Test: Conflicting entry should include ID and details
      const result = await validateProgressTimeline(
        session.id,
        new Date("2025-11-10"),
        300,
        false
      );

      expect(result.valid).toBe(false);
      expect(result.conflictingEntry).toBeDefined();
      expect(result.conflictingEntry?.id).toBe(futureEntry.id);
      expect(result.conflictingEntry?.type).toBe("after");
      expect(result.conflictingEntry?.progress).toBe(200);
      expect(result.conflictingEntry?.date).toBe("Nov 15, 2025");
    });
  });
});
