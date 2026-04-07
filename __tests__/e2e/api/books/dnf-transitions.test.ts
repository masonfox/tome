import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { createTestBook, createTestSession, createMockRequest } from "@/__tests__/fixtures/test-data";
import { POST } from "@/app/api/books/[id]/status/route";
import type { Book } from "@/lib/db/schema/books";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

/**
 * Mock Rationale: Prevent Calibre sync during tests (file system I/O).
 */
vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: () => {},
    readRating: () => null,
    updateTags: () => {},
    readTags: () => [],
  },
  CalibreService: class {},
}));

/**
 * Mock Rationale: Prevent streak rebuilding side effects during tests.
 */
vi.mock("@/lib/services/streak.service", () => ({
  streakService: {
    rebuildStreak: vi.fn(() => Promise.resolve()),
  },
}));

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
    const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
      status: "read-next"
    }) as NextRequest;
    const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });

    // ASSERT: API response (session properties spread at top level when archived)
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).not.toBe(dnfSession.id);
    expect(data.sessionNumber).toBe(2);
    expect(data.status).toBe("read-next");
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
    const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
      status: "to-read"
    }) as NextRequest;
    const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });

    // ASSERT: API response (session properties spread at top level when archived)
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).not.toBe(dnfSession.id);
    expect(data.sessionNumber).toBe(2);
    expect(data.status).toBe("to-read");
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
    const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
      status: "reading"
    }) as NextRequest;
    const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });

    // ASSERT: API response (session properties spread at top level when archived)
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).not.toBe(dnfSession.id);
    expect(data.sessionNumber).toBe(2);
    expect(data.status).toBe("reading");
    expect(data.startedDate).toBeTruthy(); // Auto-set today
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
    const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
      status: "read"
    }) as NextRequest;
    const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });

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
    const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
      status: "read-next"
    }) as NextRequest;
    const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });

    // ASSERT: Success response
    expect(response.status).toBe(200);

    // Verify original completedDate preserved in database
    const archived = await sessionRepository.findById(dnfSession.id);
    expect(archived?.completedDate).toBe(originalCompletedDate);
    expect(archived?.status).toBe("dnf");
  });

  describe("terminal state behavior (E2E)", () => {
    test("should set isActive=false when transitioning to 'read' status", async () => {
      // ARRANGE: Active reading session
      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2026-01-01",
      }));

      // ACT: Mark as read via API
      const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: "2026-01-15",
      }) as NextRequest;
      const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });
      const data = await response.json();

      // ASSERT: Response successful
      expect(response.status).toBe(200);
      expect(data.status).toBe("read");
      expect(data.isActive).toBe(false); // Terminal "read" status archives session (ADR-004/008)

      // ASSERT: Database reflects change
      const updated = await sessionRepository.findById(activeSession.id);
      expect(updated?.isActive).toBe(false);
      expect(updated?.status).toBe("read");
      expect(updated?.completedDate).toBe("2026-01-15");
    });

    test("should handle DNF → reading transition with archived DNF session", async () => {
      // ARRANGE: Archived DNF session (correct post-terminal-state state)
      const dnfSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-01",
        completedDate: "2026-01-10",
      }));

      // ACT: Restart reading via API
      const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "reading",
      }) as NextRequest;
      const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });
      const data = await response.json();

      // ASSERT: New session created
      expect(response.status).toBe(200);
      expect(data.sessionArchived).toBe(true);
      expect(data.id).toBeDefined(); // Flattened response structure
      expect(data.sessionNumber).toBe(2);
      expect(data.status).toBe("reading");
      expect(data.isActive).toBe(true);

      // ASSERT: DNF session still archived
      const archived = await sessionRepository.findById(dnfSession.id);
      expect(archived?.isActive).toBe(false);
    });

    test("should assign proper readNextOrder for DNF → read-next transition", async () => {
      // ARRANGE: Archived DNF session
      const dnfSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-01",
        completedDate: "2026-01-10",
      }));

      // ACT: Transition to read-next via API
      const request = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read-next",
      }) as NextRequest;
      const response = await POST(request, { params: Promise.resolve({ id: testBook.id.toString() }) });
      const data = await response.json();

      // ASSERT: New session created with proper ordering
      expect(response.status).toBe(200);
      expect(data.sessionArchived).toBe(true);
      expect(data.sessionNumber).toBe(2);
      expect(data.status).toBe("read-next");
      expect(data.readNextOrder).toBeGreaterThanOrEqual(0); // Verifies readNextOrder is assigned (0 for first read-next book)

      // ASSERT: DNF session still archived
      const archived = await sessionRepository.findById(dnfSession.id);
      expect(archived?.isActive).toBe(false);
    });
  });
});
