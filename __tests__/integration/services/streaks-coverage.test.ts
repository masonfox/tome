import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { 
  updateStreaks, 
  checkAndResetStreakIfNeeded, 
  getActivityCalendar,
  rebuildStreak 
} from "@/lib/streaks";
import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { toProgressDate, toSessionDate } from "../../test-utils";
import { toDateString } from "@/utils/dateHelpers.server";

/**
 * Streak Coverage Tests
 * 
 * Focus on improving coverage for lib/streaks.ts uncovered lines:
 * - Lines 112-329 (rebuildStreak edge cases)
 * - Lines 378-388 (getActivityCalendar)
 */

function getStreakDate(daysOffset: number = 0): Date {
  const userTimezone = 'America/New_York';
  const now = new Date();
  const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
  
  const targetDate = new Date(todayInUserTz);
  targetDate.setDate(targetDate.getDate() + daysOffset);
  
  return fromZonedTime(targetDate, userTimezone);
}

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("lib/streaks.ts - Coverage Improvement", () => {
  describe("rebuildStreak - Edge Cases", () => {
    test("should handle empty progress array", async () => {
      // No progress logs created
      const streak = await rebuildStreak();
      
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(0);
    });

    test("should rebuild streak with custom currentDate parameter", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create progress 2 days ago
      const twoDaysAgo = getStreakDate(-2);
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(twoDaysAgo),
      });

      // Rebuild with custom date (yesterday)
      const yesterday = getStreakDate(-1);
      const streak = await rebuildStreak(null, yesterday);
      
      // Streak should be 1 (last activity was yesterday from current date perspective)
      expect(streak.currentStreak).toBe(1);
    });

    test("should rebuild streak with enableStreak parameter", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(getStreakDate(0)),
      });

      // Rebuild with streak disabled
      const streak = await rebuildStreak(null, undefined, false);
      
      expect(streak.streakEnabled).toBe(false);
    });

    test("should calculate streak with progress below daily threshold", async () => {
      // Create streak with threshold of 20
      await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: toDateString(new Date()),
        streakStartDate: toDateString(new Date()),
        totalDaysActive: 0,
        dailyThreshold: 20,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create progress with only 10 pages (below threshold)
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 10,
        currentPercentage: 3.33,
        pagesRead: 10,
        progressDate: toProgressDate(getStreakDate(0)),
      });

      const streak = await rebuildStreak();
      
      // Should not count this day as qualifying
      expect(streak.currentStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(0);
    });

    test("should handle progress logs with zero pagesRead", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create progress with 0 pages read
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 0,
        currentPercentage: 0,
        pagesRead: 0, // Zero progress
        progressDate: toProgressDate(getStreakDate(0)),
      });

      const streak = await rebuildStreak();
      
      // Zero-page progress should not count
      expect(streak.currentStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(0);
    });

    test("should handle multiple progress logs on same day aggregating to meet threshold", async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: toDateString(new Date()),
        streakStartDate: toDateString(new Date()),
        totalDaysActive: 0,
        dailyThreshold: 15,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const today = getStreakDate(0);

      // Multiple logs same day: 5 + 5 + 5 = 15 (meets threshold)
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 5,
        currentPercentage: 1.67,
        pagesRead: 5,
        progressDate: toProgressDate(today),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 10,
        currentPercentage: 3.33,
        pagesRead: 5,
        progressDate: toProgressDate(today),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 15,
        currentPercentage: 5.0,
        pagesRead: 5,
        progressDate: toProgressDate(today),
      });

      const streak = await rebuildStreak();
      
      expect(streak.currentStreak).toBe(1);
      expect(streak.totalDaysActive).toBe(1);
    });

    test("should calculate longest streak from historical data", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create 10-day streak in past
      for (let i = 20; i >= 11; i--) {
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 21 - i,
          currentPercentage: 0,
          pagesRead: 1,
          progressDate: toProgressDate(getStreakDate(-i)),
        });
      }

      // Gap of 3 days

      // Create 5-day streak recently
      for (let i = 7; i >= 3; i--) {
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 20 + (8 - i),
          currentPercentage: 0,
          pagesRead: 1,
          progressDate: toProgressDate(getStreakDate(-i)),
        });
      }

      const streak = await rebuildStreak();
      
      expect(streak.longestStreak).toBe(10);
      expect(streak.currentStreak).toBe(0); // Broken since day 3
    });

    test("should handle date parsing edge case with first date", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Single progress log
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(getStreakDate(-5)),
      });

      const streak = await rebuildStreak();
      
      // Streak broken (more than 1 day ago)
      expect(streak.currentStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(1);
    });
  });

  describe("getActivityCalendar", () => {
    test("should return activity calendar for current year", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create progress for current month
      const today = getStreakDate(0);
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(today),
      });

      const currentYear = today.getFullYear();
      const calendar = await getActivityCalendar(null, currentYear);
      
      expect(Array.isArray(calendar)).toBe(true);
      expect(calendar.length).toBeGreaterThan(0);
    });

    test("should return activity calendar for specific month", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const today = getStreakDate(0);
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(today),
      });

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-11
      
      const calendar = await getActivityCalendar(null, currentYear, currentMonth);
      
      expect(Array.isArray(calendar)).toBe(true);
    });

    test("should return empty calendar for year with no activity", async () => {
      const calendar = await getActivityCalendar(null, 2020);
      
      expect(Array.isArray(calendar)).toBe(true);
      expect(calendar.length).toBe(0);
    });

    test("should handle userId parameter", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        userId: null,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(getStreakDate(0)),
      });

      const currentYear = new Date().getFullYear();
      const calendar = await getActivityCalendar(null, currentYear);
      
      expect(Array.isArray(calendar)).toBe(true);
    });
  });

  describe("checkAndResetStreakIfNeeded", () => {
    test("should reset streak when more than 1 day has passed", async () => {
      // Create streak with last activity 3 days ago
      const threeDaysAgo = getStreakDate(-3);
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: toDateString(threeDaysAgo),
        streakStartDate: toDateString(getStreakDate(-8)),
        totalDaysActive: 5,
      });

      const wasReset = await checkAndResetStreakIfNeeded();
      
      expect(wasReset).toBe(true);
      
      const streak = await streakRepository.findByUserId(null);
      expect(streak?.currentStreak).toBe(0);
    });

    test("should not reset when within grace period (same day)", async () => {
      const today = getStreakDate(0);
      await streakRepository.create({
        userId: null,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: toDateString(today),
        streakStartDate: toDateString(getStreakDate(-3)),
        totalDaysActive: 3,
      });

      const wasReset = await checkAndResetStreakIfNeeded();
      
      expect(wasReset).toBe(false);
      
      const streak = await streakRepository.findByUserId(null);
      expect(streak?.currentStreak).toBe(3);
    });

    test("should not reset when within grace period (yesterday)", async () => {
      const yesterday = getStreakDate(-1);
      await streakRepository.create({
        userId: null,
        currentStreak: 2,
        longestStreak: 5,
        lastActivityDate: toDateString(yesterday),
        streakStartDate: toDateString(getStreakDate(-2)),
        totalDaysActive: 2,
      });

      const wasReset = await checkAndResetStreakIfNeeded();
      
      expect(wasReset).toBe(false);
      
      const streak = await streakRepository.findByUserId(null);
      expect(streak?.currentStreak).toBe(2);
    });

    test("should be idempotent (skip check if already checked today)", async () => {
      const today = getStreakDate(0);
      await streakRepository.create({
        userId: null,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: toDateString(getStreakDate(-1)),
        streakStartDate: toDateString(getStreakDate(-3)),
        totalDaysActive: 3,
        lastCheckedDate: toDateString(today), // Already checked today
      });

      const wasReset = await checkAndResetStreakIfNeeded();
      
      expect(wasReset).toBe(false); // Idempotent check
    });

    test("should not reset when currentStreak is already 0", async () => {
      const threeDaysAgo = getStreakDate(-3);
      await streakRepository.create({
        userId: null,
        currentStreak: 0, // Already reset
        longestStreak: 10,
        lastActivityDate: toDateString(threeDaysAgo),
        streakStartDate: toDateString(threeDaysAgo),
        totalDaysActive: 5,
      });

      const wasReset = await checkAndResetStreakIfNeeded();
      
      expect(wasReset).toBe(false); // Already 0, no reset needed
    });
  });

  describe("updateStreaks - Edge Cases", () => {
    test("should handle same-day activity when threshold not yet met", async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: toDateString(getStreakDate(0)),
        streakStartDate: toDateString(getStreakDate(0)),
        totalDaysActive: 0,
        dailyThreshold: 100, // High threshold
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Read only 50 pages (below threshold)
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: toProgressDate(getStreakDate(0)),
      });

      const streak = await updateStreaks();
      
      // Threshold not met, streak remains 0
      expect(streak.currentStreak).toBe(0);
    });

    test("should handle threshold change mid-day (threshold no longer met)", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        path: "/test/path",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create progress with 10 pages
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 10,
        currentPercentage: 3.33,
        pagesRead: 10,
        progressDate: toProgressDate(getStreakDate(0)),
      });

      // Set threshold to 10 (exactly met)
      let streak = await updateStreaks();
      expect(streak.currentStreak).toBe(1);

      // Raise threshold to 15 (no longer met)
      await streakRepository.update(streak.id, {
        dailyThreshold: 15,
      } as any);

      // Update streak again
      streak = await updateStreaks();
      
      // Should reset to 0 (threshold raised, no longer met)
      expect(streak.currentStreak).toBe(0);
    });
  });
});
