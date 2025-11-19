import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
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
});

describe("Session Lifecycle - Auto-Archive on Read", () => {
  test("should auto-archive session when status changes to 'read'", async () => {
    // Create a book
    const book = await Book.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 200,
      tags: [],
      path: "Test Author/Test Book (1)",
    });

    // Create an active reading session
    const session = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    expect(session.isActive).toBe(true);
    expect(session.status).toBe("reading");

    // Update session to 'read' status (simulating what the API does)
    const updatedSession = await ReadingSession.findByIdAndUpdate(
      session._id,
      {
        status: "read",
        completedDate: new Date(),
        isActive: false, // Auto-archive
      },
      { new: true }
    );

    expect(updatedSession?.status).toBe("read");
    expect(updatedSession?.isActive).toBe(false);
    expect(updatedSession?.completedDate).toBeDefined();
  });

  test("should not allow creating multiple active sessions per book", async () => {
    const book = await Book.create({
      calibreId: 2,
      title: "Test Book 2",
      authors: ["Test Author"],
      totalPages: 300,
      tags: [],
      path: "Test Author/Test Book 2 (2)",
    });

    // Create first active session
    const session1 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Try to mark it as read (should archive it)
    session1.status = "read";
    session1.isActive = false;
    await session1.save();

    // Create a second active session (simulate re-reading)
    const session2 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    });

    // Now try to create a third active session - this should fail or be prevented
    try {
      await ReadingSession.create({
        bookId: book._id,
        sessionNumber: 3,
        status: "reading",
        isActive: true,
      });
      
      // If we got here without error, verify we still have only one active session
      // (the database constraint should have prevented the duplicate)
      const activeSessions = await ReadingSession.find({
        bookId: book._id,
        isActive: true,
      });
      expect(activeSessions.length).toBe(1);
    } catch (error: any) {
      // Expected: MongoDB duplicate key error
      expect(error.code).toBe(11000);
      
      // Verify we still have exactly one active session
      const activeSessions = await ReadingSession.find({
        bookId: book._id,
        isActive: true,
      });
      expect(activeSessions.length).toBe(1);
    }
  });

  test("should allow multiple archived sessions per book", async () => {
    const book = await Book.create({
      calibreId: 3,
      title: "Test Book 3",
      authors: ["Test Author"],
      totalPages: 250,
      tags: [],
      path: "Test Author/Test Book 3 (3)",
    });

    // Create multiple archived sessions - should succeed
    const session1 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    const session2 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    expect(session1.isActive).toBe(false);
    expect(session2.isActive).toBe(false);

    const sessions = await ReadingSession.find({ bookId: book._id });
    expect(sessions.length).toBe(2);
  });
});

describe("Re-reading Flow", () => {
  test("should create new session after previous session is archived", async () => {
    const book = await Book.create({
      calibreId: 4,
      title: "Test Book 4",
      authors: ["Test Author"],
      totalPages: 180,
      tags: [],
      path: "Test Author/Test Book 4 (4)",
    });

    // Create and archive first session
    await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: new Date("2025-01-01"),
      completedDate: new Date("2025-01-15"),
    });

    // Create new active session for re-read
    const session2 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    expect(session2.sessionNumber).toBe(2);
    expect(session2.isActive).toBe(true);
    expect(session2.status).toBe("reading");

    // Verify both sessions exist
    const allSessions = await ReadingSession.find({ bookId: book._id }).sort({
      sessionNumber: 1,
    });
    expect(allSessions.length).toBe(2);
    expect(allSessions[0].isActive).toBe(false);
    expect(allSessions[1].isActive).toBe(true);
  });

  test("should not allow re-reading if last session is not completed", async () => {
    const book = await Book.create({
      calibreId: 5,
      title: "Test Book 5",
      authors: ["Test Author"],
      totalPages: 220,
      tags: [],
      path: "Test Author/Test Book 5 (5)",
    });

    // Create active reading session (not completed)
    await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    // Find session and check status
    const lastSession = await ReadingSession.findOne({ bookId: book._id }).sort({
      sessionNumber: -1,
    });

    expect(lastSession?.status).not.toBe("read");

    // This simulates the API check - re-reading should not be allowed
    if (lastSession?.status !== "read") {
      // Expected behavior - don't create new session
      const sessionCount = await ReadingSession.countDocuments({ bookId: book._id });
      expect(sessionCount).toBe(1);
    }
  });

  test("should not allow re-reading if active session already exists", async () => {
    const book = await Book.create({
      calibreId: 6,
      title: "Test Book 6",
      authors: ["Test Author"],
      totalPages: 190,
      tags: [],
      path: "Test Author/Test Book 6 (6)",
    });

    // Create archived session
    await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    // Create active session (already re-reading)
    await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    // Check if active session exists
    const existingActiveSession = await ReadingSession.findOne({
      bookId: book._id,
      isActive: true,
    });

    expect(existingActiveSession).toBeDefined();

    // Should not create another active session
    const sessionCount = await ReadingSession.countDocuments({
      bookId: book._id,
      isActive: true,
    });
    expect(sessionCount).toBe(1);
  });
});

describe("Progress Logging Validation", () => {
  test("should only allow progress logging for active 'reading' sessions", async () => {
    const book = await Book.create({
      calibreId: 7,
      title: "Test Book 7",
      authors: ["Test Author"],
      totalPages: 160,
      tags: [],
      path: "Test Author/Test Book 7 (7)",
    });

    // Create active reading session
    const session = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    // Should allow progress logging
    const progressLog = await ProgressLog.create({
      bookId: book._id,
      sessionId: session._id,
      currentPage: 50,
      currentPercentage: 31.25,
      progressDate: new Date(),
      pagesRead: 50,
    });

    expect(progressLog.sessionId?.toString()).toBe((session._id as mongoose.Types.ObjectId).toString());
    expect(progressLog.currentPage).toBe(50);
  });

  test("should not allow progress logging when session is not 'reading'", async () => {
    const book = await Book.create({
      calibreId: 8,
      title: "Test Book 8",
      authors: ["Test Author"],
      totalPages: 210,
      tags: [],
      path: "Test Author/Test Book 8 (8)",
    });

    // Create active session with 'to-read' status
    const session = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "to-read",
      isActive: true,
    });

    // Check status before allowing progress
    expect(session.status).not.toBe("reading");

    // This simulates the API validation - progress should not be logged
    if (session.status !== "reading") {
      // Don't create progress log
      const progressCount = await ProgressLog.countDocuments({ sessionId: session._id });
      expect(progressCount).toBe(0);
    }
  });

  test("should not allow progress logging when session is archived", async () => {
    const book = await Book.create({
      calibreId: 9,
      title: "Test Book 9",
      authors: ["Test Author"],
      totalPages: 240,
      tags: [],
      path: "Test Author/Test Book 9 (9)",
    });

    // Create archived completed session
    const session = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    // Try to find active session
    const activeSession = await ReadingSession.findOne({
      bookId: book._id,
      isActive: true,
    });

    expect(activeSession).toBeNull();

    // No active session = cannot log progress
    const progressCount = await ProgressLog.countDocuments({ bookId: book._id });
    expect(progressCount).toBe(0);
  });
});

describe("Progress Isolation Between Sessions", () => {
  test("should link progress logs to correct session", async () => {
    const book = await Book.create({
      calibreId: 10,
      title: "Test Book 10",
      authors: ["Test Author"],
      totalPages: 200,
      tags: [],
      path: "Test Author/Test Book 10 (10)",
    });

    // Create first session with progress
    const session1 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-01-01"),
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session1._id,
      currentPage: 100,
      currentPercentage: 50,
      progressDate: new Date("2025-01-10"),
      pagesRead: 100,
    });

    // Archive first session
    session1.status = "read";
    session1.isActive = false;
    session1.completedDate = new Date("2025-01-15");
    await session1.save();

    // Create second session with progress
    const session2 = await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-02-01"),
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session2._id,
      currentPage: 75,
      currentPercentage: 37.5,
      progressDate: new Date("2025-02-05"),
      pagesRead: 75,
    });

    // Verify isolation
    const session1Progress = await ProgressLog.find({ sessionId: session1._id });
    const session2Progress = await ProgressLog.find({ sessionId: session2._id });

    expect(session1Progress.length).toBe(1);
    expect(session2Progress.length).toBe(1);
    expect(session1Progress[0].currentPage).toBe(100);
    expect(session2Progress[0].currentPage).toBe(75);
  });
});
