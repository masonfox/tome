import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { createTestBook, createTestSession } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";

describe("DNF Status Transitions (E2E API)", () => {
  let testBook: Book;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test book
    testBook = await bookRepository.create(createTestBook({
      calibreId: 888,
      title: "DNF E2E Test",
      authors: ["Test Author"],
      path: "/test/dnf-e2e",
      totalPages: 400,
    }));
  });

  test("POST /api/books/[id]/status - DNF to read-next creates new session", async () => {
    // ARRANGE: Book with DNF session
    const dnfSession = await sessionRepository.create(createTestSession({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-01",
      completedDate: "2026-01-10",
    }));

    // ACT: Call status update API
    const response = await fetch(`http://localhost:3000/api/books/${testBook.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read-next" }),
    });

    // ASSERT: API response
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.session.id).not.toBe(dnfSession.id);
    expect(data.session.sessionNumber).toBe(2);
    expect(data.session.status).toBe("read-next");
    expect(data.sessionArchived).toBe(true);
    expect(data.archivedSessionNumber).toBe(1);

    // Verify database state
    const allSessions = await sessionRepository.findAllByBookId(testBook.id);
    expect(allSessions).toHaveLength(2);
    
    const archived = allSessions.find(s => s.sessionNumber === 1);
    expect(archived?.status).toBe("dnf");
    expect(archived?.isActive).toBe(false);
    
    const active = allSessions.find(s => s.sessionNumber === 2);
    expect(active?.status).toBe("read-next");
    expect(active?.isActive).toBe(true);
  });

  test("POST /api/books/[id]/status - DNF to to-read creates new session", async () => {
    // ARRANGE: Book with DNF session
    const dnfSession = await sessionRepository.create(createTestSession({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-01",
      completedDate: "2026-01-10",
    }));

    // ACT: Call status update API
    const response = await fetch(`http://localhost:3000/api/books/${testBook.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "to-read" }),
    });

    // ASSERT: API response
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.session.id).not.toBe(dnfSession.id);
    expect(data.session.sessionNumber).toBe(2);
    expect(data.session.status).toBe("to-read");
    expect(data.sessionArchived).toBe(true);

    // Verify database state
    const allSessions = await sessionRepository.findAllByBookId(testBook.id);
    expect(allSessions).toHaveLength(2);
  });

  test("POST /api/books/[id]/status - DNF to reading creates new session", async () => {
    // ARRANGE: Book with DNF session
    const dnfSession = await sessionRepository.create(createTestSession({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-01",
      completedDate: "2026-01-10",
    }));

    // ACT: Call status update API
    const response = await fetch(`http://localhost:3000/api/books/${testBook.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reading" }),
    });

    // ASSERT: API response
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.session.id).not.toBe(dnfSession.id);
    expect(data.session.sessionNumber).toBe(2);
    expect(data.session.status).toBe("reading");
    expect(data.session.startedDate).toBeTruthy(); // Auto-set today
    expect(data.sessionArchived).toBe(true);

    // Verify DNF session preserved
    const archived = await sessionRepository.findById(dnfSession.id);
    expect(archived?.status).toBe("dnf");
    expect(archived?.completedDate).toBe("2026-01-10");
    expect(archived?.isActive).toBe(false);
  });

  test("POST /api/books/[id]/status - DNF to read returns 400 error", async () => {
    // ARRANGE: Book with DNF session
    await sessionRepository.create(createTestSession({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-01",
      completedDate: "2026-01-10",
    }));

    // ACT: Try to mark as read
    const response = await fetch(`http://localhost:3000/api/books/${testBook.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read" }),
    });

    // ASSERT: Should return 400 error
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Cannot mark DNF book as read directly");
  });

  test("POST /api/books/[id]/status - DNF completedDate is preserved when archiving", async () => {
    // ARRANGE: Book with DNF session with specific completedDate
    const originalCompletedDate = "2026-01-20";
    const dnfSession = await sessionRepository.create(createTestSession({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "dnf",
      isActive: false,
      startedDate: "2026-01-10",
      completedDate: originalCompletedDate,
    }));

    // ACT: Transition to read-next via API
    const response = await fetch(`http://localhost:3000/api/books/${testBook.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read-next" }),
    });

    // ASSERT: Success response
    expect(response.status).toBe(200);

    // Verify original completedDate preserved in database
    const archived = await sessionRepository.findById(dnfSession.id);
    expect(archived?.completedDate).toBe(originalCompletedDate);
    expect(archived?.status).toBe("dnf");
  });
});
