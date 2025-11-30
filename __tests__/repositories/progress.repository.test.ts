import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { progressRepository, bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

/**
 * Test suite for ProgressRepository
 * 
 * Focus area: Testing the getEarliestProgressDate() method added for chart trimming
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

describe("ProgressRepository.getEarliestProgressDate()", () => {
  test("should return null when no progress logs exist", async () => {
    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).toBeNull();
  });

  test("should return earliest date when single progress log exists", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author One"],
      totalPages: 300,
      tags: [],
      path: "Author One/Test Book (1)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create single progress log
    const targetDate = new Date("2024-11-27T12:00:00Z");
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: targetDate,
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    expect(earliest?.toISOString()).toBe(targetDate.toISOString());
  });

  test("should return earliest date from multiple progress logs", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Multiple Progress Book",
      authors: ["Author Two"],
      totalPages: 400,
      tags: [],
      path: "Author Two/Multiple Progress Book (2)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress logs in non-chronological order
    const nov29 = new Date("2024-11-29T12:00:00Z");
    const nov27 = new Date("2024-11-27T12:00:00Z"); // Earliest
    const nov28 = new Date("2024-11-28T12:00:00Z");

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 37.5,
      progressDate: nov29,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 12.5,
      progressDate: nov27,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 25.0,
      progressDate: nov28,
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    expect(earliest?.toISOString()).toBe(nov27.toISOString());
  });

  test("should return earliest date across multiple books", async () => {
    // Create two books
    const book1 = await bookRepository.create({
      calibreId: 3,
      title: "Book One",
      authors: ["Author Three"],
      totalPages: 300,
      tags: [],
      path: "Author Three/Book One (3)",
    });

    const book2 = await bookRepository.create({
      calibreId: 4,
      title: "Book Two",
      authors: ["Author Four"],
      totalPages: 400,
      tags: [],
      path: "Author Four/Book Two (4)",
    });

    // Create sessions
    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const session2 = await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Book 1 started Nov 28
    const nov28 = new Date("2024-11-28T12:00:00Z");
    await progressRepository.create({
      bookId: book1.id,
      sessionId: session1.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: nov28,
      pagesRead: 50,
    });

    // Book 2 started Nov 25 (earlier)
    const nov25 = new Date("2024-11-25T12:00:00Z");
    await progressRepository.create({
      bookId: book2.id,
      sessionId: session2.id,
      currentPage: 50,
      currentPercentage: 12.5,
      progressDate: nov25,
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    expect(earliest?.toISOString()).toBe(nov25.toISOString());
  });

  test("should handle progress logs on the same day", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 5,
      title: "Same Day Book",
      authors: ["Author Five"],
      totalPages: 300,
      tags: [],
      path: "Author Five/Same Day Book (5)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create multiple progress logs on the same day at different times
    const morning = new Date("2024-11-30T08:00:00Z");
    const afternoon = new Date("2024-11-30T14:00:00Z");
    const evening = new Date("2024-11-30T20:00:00Z");

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: afternoon,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: evening,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: morning,
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    expect(earliest?.toISOString()).toBe(morning.toISOString());
  });

  test("should return earliest across multiple sessions of same book", async () => {
    // Create book
    const book = await bookRepository.create({
      calibreId: 6,
      title: "Re-read Book",
      authors: ["Author Six"],
      totalPages: 350,
      tags: [],
      path: "Author Six/Re-read Book (6)",
    });

    // Create two sessions (first read and re-read)
    const session1 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date("2024-10-15"),
    });

    const session2 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    });

    // Session 1 progress (October)
    const oct10 = new Date("2024-10-10T12:00:00Z"); // Earliest
    await progressRepository.create({
      bookId: book.id,
      sessionId: session1.id,
      currentPage: 100,
      currentPercentage: 28.57,
      progressDate: oct10,
      pagesRead: 100,
    });

    // Session 2 progress (November)
    const nov27 = new Date("2024-11-27T12:00:00Z");
    await progressRepository.create({
      bookId: book.id,
      sessionId: session2.id,
      currentPage: 50,
      currentPercentage: 14.29,
      progressDate: nov27,
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    expect(earliest?.toISOString()).toBe(oct10.toISOString());
  });
});
