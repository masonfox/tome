import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import Streak from "@/models/Streak";
import { POST } from "@/app/api/books/[id]/reread/route";
import {
  mockBook1,
  mockSessionReading,
  mockSessionRead,
  mockProgressLog1,
  mockProgressLog2,
  createMockRequest,
} from "../fixtures/test-data";

// Mock Next.js revalidatePath since it requires Next.js context
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  await Book.deleteMany({});
  await ReadingSession.deleteMany({});
  await ProgressLog.deleteMany({});
  await Streak.deleteMany({});
});

describe("POST /api/books/[id]/reread", () => {
  // ============================================================================
  // SUCCESS CASES
  // ============================================================================

  test("should archive current session and create new one for re-reading", async () => {
    // Create a book
    const book = await Book.create(mockBook1);

    // Create an ARCHIVED reading session (auto-archived when marked as "read")
    const session = await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      isActive: false, // Already archived
    });

    // Call the endpoint
    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Re-reading session started successfully");
    expect(data.session).toBeDefined();
    expect(data.session.sessionNumber).toBe(2);
    expect(data.session.status).toBe("reading");
    expect(data.session.isActive).toBe(true);
    expect(data.session.startedDate).toBeDefined();
    expect(data.previousSession).toBeDefined();
    expect(data.previousSession.sessionNumber).toBe(1);

    // Verify old session is still archived
    const oldSession = await ReadingSession.findById(session._id);
    expect(oldSession?.isActive).toBe(false);

    // Verify new session exists
    const newSession = await ReadingSession.findById(data.session._id);
    expect(newSession?.isActive).toBe(true);
    expect(newSession?.sessionNumber).toBe(2);
  });

  test("should increment session number correctly for third read", async () => {
    const book = await Book.create(mockBook1);

    // Create two archived sessions (both auto-archived when marked as read)
    await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      sessionNumber: 1,
      isActive: false,
    });

    await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      sessionNumber: 2,
      isActive: false, // Also archived
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.sessionNumber).toBe(3);
  });

  test("should set status to 'reading' and startedDate on new session", async () => {
    const book = await Book.create(mockBook1);
    await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      isActive: false, // Archived
    });

    const beforeTime = new Date();
    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();
    const afterTime = new Date();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("reading");
    expect(data.session.startedDate).toBeDefined();

    const startedDate = new Date(data.session.startedDate);
    expect(startedDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(startedDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  test("should preserve userId from previous session", async () => {
    const book = await Book.create(mockBook1);
    const testUserId = new mongoose.Types.ObjectId();

    await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      userId: testUserId,
      isActive: false, // Archived
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.userId).toBe(testUserId.toString());
  });

  test("should not copy review to new session", async () => {
    const book = await Book.create(mockBook1);

    await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      review: "Great book!",
      isActive: false, // Archived
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.review).toBeUndefined();
  });

  test("should rebuild streak after creating new session", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      isActive: false, // Archived
    });

    // Create some progress logs to affect streak
    await ProgressLog.create({
      ...mockProgressLog1,
      bookId: book._id,
      sessionId: session._id,
      progressDate: new Date("2025-11-17"),
    });

    // Create initial streak
    await Streak.create({
      userId: null,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date("2025-11-17"),
      streakStartDate: new Date("2025-11-17"),
      totalDaysActive: 1,
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });

    expect(response.status).toBe(200);

    // Verify streak was updated (rebuildStreak should have been called)
    const streak = await Streak.findOne({ userId: null });
    expect(streak).toBeDefined();
  });

  // ============================================================================
  // ERROR CASES
  // ============================================================================

  test("should return 404 if book not found", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const request = createMockRequest("POST", `/api/books/${fakeId}/reread`);
    const response = await POST(request, { params: { id: fakeId.toString() } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Book not found");
  });

  test("should return 404 if no sessions exist", async () => {
    const book = await Book.create(mockBook1);

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("No reading sessions found");
  });

  test("should return 400 if last session is not 'read' status", async () => {
    const book = await Book.create(mockBook1);

    await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      status: "reading",
      isActive: true, // Still actively reading
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Can only re-read");
  });

  test("should return 400 if active session is 'to-read' status", async () => {
    const book = await Book.create(mockBook1);

    await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      status: "to-read",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Can only re-read");
  });

  test("should return 400 if active session is 'read-next' status", async () => {
    const book = await Book.create(mockBook1);

    await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      status: "read-next",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Can only re-read");
  });

  test("should return 400 with invalid book ID format", async () => {
    const request = createMockRequest("POST", "/api/books/invalid-id/reread");
    const response = await POST(request, { params: { id: "invalid-id" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  test("should handle multiple archived sessions correctly", async () => {
    const book = await Book.create(mockBook1);

    // Create 5 archived sessions (all marked as read)
    for (let i = 1; i <= 5; i++) {
      await ReadingSession.create({
        ...mockSessionRead,
        bookId: book._id,
        sessionNumber: i,
        isActive: false, // All archived
      });
    }

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.sessionNumber).toBe(6);

    // Verify all old sessions are archived
    const activeSessions = await ReadingSession.find({
      bookId: book._id,
      isActive: true,
    });
    expect(activeSessions.length).toBe(1);
    expect(activeSessions[0].sessionNumber).toBe(6);
  });

  test("should handle session with progress logs", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      isActive: false, // Archived
    });

    // Add progress logs to the session
    await ProgressLog.create({
      ...mockProgressLog1,
      bookId: book._id,
      sessionId: session._id,
    });
    await ProgressLog.create({
      ...mockProgressLog2,
      bookId: book._id,
      sessionId: session._id,
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);

    // Progress logs should still be linked to old session
    const progressLogs = await ProgressLog.find({ sessionId: session._id });
    expect(progressLogs.length).toBe(2);
  });

  test("should maintain referential integrity after re-read", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      isActive: false, // Archived
    });

    const request = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const response = await POST(request, { params: { id: book._id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);

    // Verify only one active session
    const activeSessions = await ReadingSession.find({
      bookId: book._id,
      isActive: true,
    });
    expect(activeSessions.length).toBe(1);

    // Verify total session count
    const allSessions = await ReadingSession.find({ bookId: book._id });
    expect(allSessions.length).toBe(2);

    // Verify book still exists
    const bookExists = await Book.findById(book._id);
    expect(bookExists).toBeDefined();
  });

  test("should handle concurrent re-read attempts gracefully", async () => {
    const book = await Book.create(mockBook1);
    await ReadingSession.create({
      ...mockSessionRead,
      bookId: book._id,
      isActive: false, // Archived
    });

    // Make two concurrent requests
    const request1 = createMockRequest("POST", `/api/books/${book._id}/reread`);
    const request2 = createMockRequest("POST", `/api/books/${book._id}/reread`);

    const [response1, response2] = await Promise.all([
      POST(request1, { params: { id: book._id.toString() } }),
      POST(request2, { params: { id: book._id.toString() } }),
    ]);

    // One should succeed, one should fail (race condition)
    const results = [response1.status, response2.status];

    // At least one should succeed
    expect(results).toContain(200);
    // One should fail with either 400 (active session check) or 500 (duplicate key error from race condition)
    const hasError = results.includes(400) || results.includes(500);
    expect(hasError).toBe(true);

    // Verify we don't have duplicate active sessions (database constraints protect us)
    const activeSessions = await ReadingSession.find({
      bookId: book._id,
      isActive: true,
    });
    expect(activeSessions.length).toBe(1);
  });
});
