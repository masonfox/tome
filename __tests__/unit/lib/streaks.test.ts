import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { updateStreaks, getStreak, getOrCreateStreak, rebuildStreak } from "@/lib/streaks";
import Streak from "@/models/Streak";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { mockStreakInitial, createTestDate, mockBook1, mockSessionReading } from "@/__tests__/fixtures/test-data";
import { startOfDay } from "date-fns";

/**
 * Streak Logic Tests
 * Using real MongoDB (mongodb-memory-server) for accurate testing
 */

describe("updateStreaks", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test("creates new streak when no existing streak found", async () => {
    // Act
    const result = await updateStreaks();

    // Assert
    expect(result).toBeDefined();
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);

    // Verify it was saved to database
    const found = await Streak.findById(result._id);
    expect(found).toBeDefined();
  });

  test("initializes streak to 1 when currentStreak is 0 on same day", async () => {
    // Arrange - Create streak with 0 values (edge case from getOrCreateStreak)
    const existingStreak = await Streak.create({
      userId: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: startOfDay(new Date()),
      streakStartDate: startOfDay(new Date()),
      totalDaysActive: 0,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);
  });

  test("returns unchanged streak when activity on same day with existing streak", async () => {
    // Arrange - Create active streak from today
    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: startOfDay(new Date()),
      streakStartDate: createTestDate(5),
      totalDaysActive: 15,
    });

    // Act
    const result = await updateStreaks();

    // Assert - Should return without changes
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
    expect(result.totalDaysActive).toBe(15);
  });

  test("initializes streak when daysDiff is 1 but currentStreak is 0", async () => {
    // Arrange - Streak created yesterday with 0 values
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Streak.create({
      userId: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: yesterday,
      streakStartDate: yesterday,
      totalDaysActive: 0,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);
  });

  test("increments streak on consecutive day activity", async () => {
    // Arrange - Active streak from yesterday
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sixDaysAgo = new Date(today);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: yesterday,
      streakStartDate: sixDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(10); // Unchanged, not a new record
    expect(result.totalDaysActive).toBe(16);
  });

  test("updates longestStreak when current exceeds it", async () => {
    // Arrange - Current streak about to exceed longest
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const elevenDaysAgo = new Date(today);
    elevenDaysAgo.setDate(elevenDaysAgo.getDate() - 11);

    await Streak.create({
      userId: null,
      currentStreak: 10,
      longestStreak: 10,
      lastActivityDate: yesterday,
      streakStartDate: elevenDaysAgo,
      totalDaysActive: 20,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(11);
    expect(result.longestStreak).toBe(11); // Should be updated
    expect(result.totalDaysActive).toBe(21);
  });

  test("resets streak to 1 when gap is more than 1 day", async () => {
    // Arrange - Last activity was 3 days ago
    const today = startOfDay(new Date());
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    await Streak.create({
      userId: null,
      currentStreak: 7,
      longestStreak: 10,
      lastActivityDate: threeDaysAgo,
      streakStartDate: tenDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(1); // Reset
    expect(result.longestStreak).toBe(10); // Unchanged
    expect(result.totalDaysActive).toBe(16); // Incremented
  });

  test("handles totalDaysActive = 0 on broken streak", async () => {
    // Arrange - Broken streak with no previous activity
    const today = startOfDay(new Date());
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await Streak.create({
      userId: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: threeDaysAgo,
      streakStartDate: threeDaysAgo,
      totalDaysActive: 0,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.totalDaysActive).toBe(1);
  });
});

describe("getStreak", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test("returns streak when found", async () => {
    // Arrange
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: today,
      streakStartDate: fiveDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await getStreak();

    // Assert
    expect(result).toBeDefined();
    expect(result?.currentStreak).toBe(5);
    expect(result?.longestStreak).toBe(10);
  });

  test("returns null when streak not found", async () => {
    // Act
    const result = await getStreak();

    // Assert
    expect(result).toBeNull();
  });
});

describe("getOrCreateStreak", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test("returns existing streak if found", async () => {
    // Arrange
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: today,
      streakStartDate: fiveDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await getOrCreateStreak();

    // Assert
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
  });

  test("creates new streak with 0 values if not found", async () => {
    // Act
    const result = await getOrCreateStreak();

    // Assert
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalDaysActive).toBe(0);

    // Verify it was saved
    const found = await Streak.findById(result._id);
    expect(found).toBeDefined();
  });
});

describe("rebuildStreak", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  // ============================================================================
  // BASIC FUNCTIONALITY
  // ============================================================================

  test("should create new streak when no progress logs exist", async () => {
    const result = await rebuildStreak();

    expect(result).toBeDefined();
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalDaysActive).toBe(0);

    // Verify it was saved to database
    const found = await Streak.findById(result._id);
    expect(found).toBeDefined();
  });

  test("should calculate streak from single day of progress", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create progress log for today
    await ProgressLog.create({
      bookId: book._id,
      sessionId: session._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T05:00:00.000Z"), // Today
    });

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);
  });

  test("should calculate streak from consecutive days", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create 5 consecutive days of progress ending today (2025-11-19)
    const dates = ["2025-11-15", "2025-11-16", "2025-11-17", "2025-11-18", "2025-11-19"];
    for (const date of dates) {
      await ProgressLog.create({
        bookId: book._id,
        sessionId: session._id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: new Date(date + "T05:00:00.000Z"),
      });
    }

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(5);
    expect(result.totalDaysActive).toBe(5);
  });

  test("should handle broken streak (gap in days)", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create progress with a gap: 3 days, gap, 2 days (ending today 2025-11-19)
    const dates = [
      "2025-11-12", // 3 consecutive days
      "2025-11-13",
      "2025-11-14",
      // GAP: 15th, 16th, 17th
      "2025-11-18", // 2 consecutive days (current streak)
      "2025-11-19",
    ];

    for (const date of dates) {
      await ProgressLog.create({
        bookId: book._id,
        sessionId: session._id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: new Date(date + "T05:00:00.000Z"),
      });
    }

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(2); // Last 2 consecutive days
    expect(result.longestStreak).toBe(3); // The initial 3 consecutive days
    expect(result.totalDaysActive).toBe(5); // Total unique days
  });

  test("should reset current streak if last activity > 1 day ago", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create progress ending 3 days ago
    const dates = ["2025-11-11", "2025-11-12", "2025-11-13", "2025-11-14"];
    for (const date of dates) {
      await ProgressLog.create({
        bookId: book._id,
        sessionId: session._id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: new Date(date + "T05:00:00.000Z"),
      });
    }

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(0); // Broken streak (last activity was 14th, today is 17th)
    expect(result.longestStreak).toBe(4); // The 4 consecutive days
    expect(result.totalDaysActive).toBe(4);
  });

  // ============================================================================
  // MULTI-SESSION SCENARIOS
  // ============================================================================

  test("should count progress from multiple sessions for the same book", async () => {
    const book = await Book.create(mockBook1);

    // Session 1
    const session1 = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: false,
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session1._id,
      currentPage: 100,
      currentPercentage: 10,
      pagesRead: 100,
      progressDate: new Date("2025-11-17T05:00:00.000Z"),
    });

    // Session 2
    const session2 = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 2,
      isActive: true,
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session2._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-18T05:00:00.000Z"),
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session2._id,
      currentPage: 100,
      currentPercentage: 10,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T05:00:00.000Z"),
    });

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.totalDaysActive).toBe(3);
  });

  test("should count progress from multiple books", async () => {
    const book1 = await Book.create(mockBook1);
    const book2 = await Book.create({ ...mockBook1, calibreId: 999, title: "Other Book" });

    const session1 = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book1._id,
      sessionNumber: 1,
      isActive: true,
    });

    const session2 = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book2._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Alternating days between books (ending today 2025-11-19)
    await ProgressLog.create({
      bookId: book1._id,
      sessionId: session1._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-17T05:00:00.000Z"),
    });

    await ProgressLog.create({
      bookId: book2._id,
      sessionId: session2._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-18T05:00:00.000Z"),
    });

    await ProgressLog.create({
      bookId: book1._id,
      sessionId: session1._id,
      currentPage: 100,
      currentPercentage: 10,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T05:00:00.000Z"),
    });

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.totalDaysActive).toBe(3);
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  test("should handle multiple progress logs on the same day", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create multiple logs on the same day (today 2025-11-19)
    await ProgressLog.create({
      bookId: book._id,
      sessionId: session._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T05:00:00.000Z"),
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session._id,
      currentPage: 100,
      currentPercentage: 10,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T12:00:00.000Z"), // Same day, different time
    });

    await ProgressLog.create({
      bookId: book._id,
      sessionId: session._id,
      currentPage: 150,
      currentPercentage: 15,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T18:00:00.000Z"), // Same day, different time
    });

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(1); // Should only count as 1 day
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);
  });

  test("should update existing streak record", async () => {
    // Create an existing streak
    const existingStreak = await Streak.create({
      userId: null,
      currentStreak: 10,
      longestStreak: 20,
      lastActivityDate: new Date("2025-11-10"),
      streakStartDate: new Date("2025-11-01"),
      totalDaysActive: 50,
    });

    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Add new progress (today 2025-11-19)
    await ProgressLog.create({
      bookId: book._id,
      sessionId: session._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T05:00:00.000Z"),
    });

    const result = await rebuildStreak();

    // Should rebuild from scratch, not use old values
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);

    // Verify same streak record was updated
    expect(result._id.toString()).toBe(existingStreak._id.toString());
  });

  test("should find longest streak in multiple separate streaks", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create multiple streaks: 2 days, gap, 5 days (longest), gap, 3 days (current, ending today 2025-11-19)
    const dates = [
      "2025-11-03", // Streak 1: 2 days
      "2025-11-04",
      // Gap
      "2025-11-07", // Streak 2: 5 days (longest)
      "2025-11-08",
      "2025-11-09",
      "2025-11-10",
      "2025-11-11",
      // Gap
      "2025-11-17", // Streak 3: 3 days (current)
      "2025-11-18",
      "2025-11-19",
    ];

    for (const date of dates) {
      await ProgressLog.create({
        bookId: book._id,
        sessionId: session._id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: new Date(date + "T05:00:00.000Z"),
      });
    }

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(3); // Current streak
    expect(result.longestStreak).toBe(5); // Longest streak
    expect(result.totalDaysActive).toBe(10); // Total unique days
  });

  test("should handle progress logs without sessionId (legacy data)", async () => {
    const book = await Book.create(mockBook1);

    // Create legacy progress logs without sessionId (ending today 2025-11-19)
    await ProgressLog.create({
      bookId: book._id,
      currentPage: 50,
      currentPercentage: 5,
      pagesRead: 50,
      progressDate: new Date("2025-11-18T05:00:00.000Z"),
    });

    await ProgressLog.create({
      bookId: book._id,
      currentPage: 100,
      currentPercentage: 10,
      pagesRead: 50,
      progressDate: new Date("2025-11-19T05:00:00.000Z"),
    });

    const result = await rebuildStreak();

    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
    expect(result.totalDaysActive).toBe(2);
  });

  test("should correctly set lastActivityDate and streakStartDate", async () => {
    const book = await Book.create(mockBook1);
    const session = await ReadingSession.create({
      ...mockSessionReading,
      bookId: book._id,
      sessionNumber: 1,
      isActive: true,
    });

    const dates = ["2025-11-17", "2025-11-18", "2025-11-19"];
    for (const date of dates) {
      await ProgressLog.create({
        bookId: book._id,
        sessionId: session._id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: new Date(date + "T05:00:00.000Z"),
      });
    }

    const result = await rebuildStreak();

    // Last activity should be the most recent day
    const lastActivity = startOfDay(new Date(result.lastActivityDate));
    expect(lastActivity.toISOString()).toBe(new Date("2025-11-19T00:00:00.000Z").toISOString());

    // Streak start should be first day of current streak
    const streakStart = startOfDay(new Date(result.streakStartDate));
    expect(streakStart.toISOString()).toBe(new Date("2025-11-17T00:00:00.000Z").toISOString());
  });
});
