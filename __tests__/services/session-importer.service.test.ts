import { describe, test, expect, beforeAll, beforeEach, afterAll, mock } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { SessionImporterService } from "@/lib/services/session-importer.service";
import { createTestBook, createTestSession } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";
import type { MatchResult } from "@/lib/services/book-matcher.service";

/**
 * Mock Calibre write operations to avoid side effects during tests
 */
mock.module("@/lib/db/calibre-write", () => ({
  updateCalibreRating: mock(() => {}),
}));

describe("SessionImporterService - Session Update vs Create Logic", () => {
  let sessionImporter: SessionImporterService;
  let book1: Book;
  let book2: Book;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    sessionImporter = new SessionImporterService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test books with unique calibre IDs
    book1 = await bookRepository.create(createTestBook({
      calibreId: 1001,
      title: "Test Book 1",
      authors: ["Author 1"],
      isbn: "9780123456789",
    }));

    book2 = await bookRepository.create(createTestBook({
      calibreId: 1002,
      title: "Test Book 2",
      authors: ["Author 2"],
      isbn: "9780987654321",
    }));
  });

  describe("Status Progression: Update Existing Session", () => {
    test("should UPDATE session when progressing from to-read to reading", async () => {
      // Create initial to-read session
      const initialSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      // Import with "currently-reading" status
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "currently-reading",
            completedDate: null,
            startedDate: new Date("2024-01-01"),
            rating: null,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      // Verify session was updated, not created
      expect(result.sessionsCreated).toBe(1); // Count includes updates

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(1); // Still only 1 session
      expect(sessions[0].id).toBe(initialSession.id); // Same session ID
      expect(sessions[0].status).toBe("reading"); // Updated status
      expect(sessions[0].sessionNumber).toBe(1); // Same session number
      expect(sessions[0].isActive).toBe(true);
    });

    test("should UPDATE session when progressing from to-read to read", async () => {
      // Create initial to-read session
      const initialSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      // Import with "read" status
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-02-01"),
            startedDate: new Date("2024-01-01"),
            rating: 4,
            review: "Great book!",
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      expect(result.sessionsCreated).toBe(1);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(initialSession.id);
      expect(sessions[0].status).toBe("read");
      expect(sessions[0].sessionNumber).toBe(1);
      expect(sessions[0].isActive).toBe(false); // Completed reads are archived
      expect(sessions[0].completedDate).toBeTruthy();
      expect(sessions[0].review).toBe("Great book!");
    });

    test("should UPDATE session when progressing from reading to read", async () => {
      // Create initial reading session
      const initialSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2024-01-01"),
      }));

      // Import with "read" status
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-02-15"),
            startedDate: new Date("2024-01-01"),
            rating: 5,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      expect(result.sessionsCreated).toBe(1);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(initialSession.id);
      expect(sessions[0].status).toBe("read");
      expect(sessions[0].sessionNumber).toBe(1);
      expect(sessions[0].isActive).toBe(false);
      expect(sessions[0].completedDate).toBeTruthy();
    });

    test("should UPDATE session and preserve review if import has review", async () => {
      // Create initial to-read session with a review
      const initialSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
        review: "Looking forward to this",
      }));

      // Import with different review
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-02-01"),
            startedDate: null,
            rating: 4,
            review: "Actually finished and loved it!",
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      await sessionImporter.importSessions(matches);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions[0].review).toBe("Actually finished and loved it!");
    });
  });

  describe("Re-read Scenarios: Create New Session", () => {
    test("should CREATE new session when importing reading status for a completed book", async () => {
      // Create initial completed session
      const initialSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-12-01"),
      }));

      // Import with "currently-reading" status (re-reading)
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "currently-reading",
            completedDate: null,
            startedDate: new Date("2024-06-01"),
            rating: null,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      expect(result.sessionsCreated).toBe(1);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(2); // Now has 2 sessions

      // Find the new session
      const newSession = sessions.find(s => s.sessionNumber === 2);
      expect(newSession).toBeDefined();
      expect(newSession?.status).toBe("reading");
      expect(newSession?.isActive).toBe(true);

      // Original session should still exist and be archived
      const oldSession = sessions.find(s => s.id === initialSession.id);
      expect(oldSession).toBeDefined();
      expect(oldSession?.isActive).toBe(false);
    });

    test("should CREATE new session when importing completed read for a previously completed book", async () => {
      // Create initial completed session
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-12-01"),
      }));

      // Import with "read" status from different date (re-read)
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-06-15"),
            startedDate: new Date("2024-06-01"),
            rating: 5,
            review: "Even better the second time!",
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      // Note: Duplicate detection might skip this, so disable it
      const result = await sessionImporter.importSessions(matches, { skipDuplicates: false });

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(2); // Now has 2 sessions

      // Find the new session
      const newSession = sessions.find(s => s.sessionNumber === 2);
      expect(newSession).toBeDefined();
      expect(newSession?.status).toBe("read");
      expect(newSession?.isActive).toBe(false);
      expect(newSession?.review).toBe("Even better the second time!");
    });

    test("should ARCHIVE previous active session when creating re-read session", async () => {
      // Create initial reading session
      const activeSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2024-01-01"),
      }));

      // Manually mark it as completed
      await sessionRepository.update(activeSession.id, {
        status: "read",
        isActive: false,
        completedDate: new Date("2024-02-01"),
      });

      // Import with "reading" status again (re-reading)
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "currently-reading",
            completedDate: null,
            startedDate: new Date("2024-07-01"),
            rating: null,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      await sessionImporter.importSessions(matches);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(2);

      // Both sessions should be archived or one active
      const activeSessions = sessions.filter(s => s.isActive);
      expect(activeSessions.length).toBe(1); // Only new session is active
      expect(activeSessions[0].sessionNumber).toBe(2);
    });
  });

  describe("First Import: Create New Session", () => {
    test("should CREATE new session when no existing session exists", async () => {
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-01-15"),
            startedDate: new Date("2024-01-01"),
            rating: 4,
            review: "Great book!",
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      expect(result.sessionsCreated).toBe(1);
      expect(result.sessionsSkipped).toBe(0);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionNumber).toBe(1);
      expect(sessions[0].status).toBe("read");
      expect(sessions[0].isActive).toBe(false);
    });

    test("should CREATE new session with to-read status", async () => {
      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "to-read",
            completedDate: null,
            startedDate: null,
            rating: null,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      expect(result.sessionsCreated).toBe(1);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions.length).toBe(1);
      expect(sessions[0].status).toBe("to-read");
      expect(sessions[0].isActive).toBe(true);
      expect(sessions[0].startedDate).toBeNull();
      expect(sessions[0].completedDate).toBeNull();
    });
  });

  describe("Multiple Books Import", () => {
    test("should handle updates and creates for different books independently", async () => {
      // Book 1: Existing to-read session (will be updated)
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      // Book 2: No existing session (will be created)

      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "currently-reading",
            completedDate: null,
            startedDate: new Date("2024-01-01"),
            rating: null,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
        {
          importRecord: {
            rowNumber: 2,
            title: "Test Book 2",
            author: "Author 2",
            isbn13: "9780987654321",
            status: "read",
            completedDate: new Date("2024-02-01"),
            startedDate: new Date("2024-01-15"),
            rating: 5,
            review: null,
          },
          matchedBook: book2,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      const result = await sessionImporter.importSessions(matches);

      expect(result.sessionsCreated).toBe(2);

      // Book 1 should have 1 session (updated)
      const book1Sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(book1Sessions.length).toBe(1);
      expect(book1Sessions[0].status).toBe("reading");

      // Book 2 should have 1 session (created)
      const book2Sessions = await sessionRepository.findAllByBookId(book2.id);
      expect(book2Sessions.length).toBe(1);
      expect(book2Sessions[0].status).toBe("read");
    });
  });

  describe("Edge Cases", () => {
    test("should update dates when import provides them", async () => {
      // Create initial session without dates
      const initialSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-02-15"),
            startedDate: new Date("2024-02-01"),
            rating: 4,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      await sessionImporter.importSessions(matches);

      const sessions = await sessionRepository.findAllByBookId(book1.id);
      expect(sessions[0].startedDate).toBeTruthy();
      expect(sessions[0].completedDate).toBeTruthy();
    });

    test("should update rating when import provides it", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      const matches: MatchResult[] = [
        {
          importRecord: {
            rowNumber: 1,
            title: "Test Book 1",
            author: "Author 1",
            isbn13: "9780123456789",
            status: "read",
            completedDate: new Date("2024-02-01"),
            startedDate: null,
            rating: 5,
            review: null,
          },
          matchedBook: book1,
          confidence: 100,
          matchReason: "ISBN match",
        },
      ];

      await sessionImporter.importSessions(matches);

      // Check book rating was updated
      const updatedBook = await bookRepository.findById(book1.id);
      expect(updatedBook?.rating).toBe(5);
    });
  });
});
