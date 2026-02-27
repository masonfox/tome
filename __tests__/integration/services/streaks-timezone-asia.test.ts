import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { streakService } from "@/lib/services/streak.service";
import {
  bookRepository,
  sessionRepository,
  progressRepository,
  streakRepository,
} from "@/lib/repositories";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";
import { formatInTimeZone } from "date-fns-tz";
import { toProgressDate, toSessionDate } from "../../test-utils";

/**
 * Streak Timezone Tests - Asia/* Scenarios
 *
 * Tests that streak calculations work correctly for timezones far from UTC (Asia/*)
 * This ensures ADR-014 compliance: calendar-day strings should not shift with timezone changes
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

describe("StreakService - Asia/* Timezone Handling (ADR-014 Compliance)", () => {
  test("should store correct calendar day for Asia/Tokyo timezone (UTC+9)", async () => {
    // Set user timezone to Tokyo
    await streakRepository.upsert(null, {
      userTimezone: "Asia/Tokyo",
      currentStreak: 0,
      longestStreak: 0,
      totalDaysActive: 0,
    });

    // Create a book and session
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      startedDate: toSessionDate(new Date()),
    });

    // Log progress for "today" in Tokyo timezone
    const now = new Date();
    const todayInTokyo = formatInTimeZone(now, "Asia/Tokyo", "yyyy-MM-dd");

    await progressRepository.create({
      sessionId: session.id,
      bookId: book.id,
      currentPage: 50,
      pagesRead: 50,
      progressDate: todayInTokyo, // Store as user-timezone calendar day (ADR-014)
    });

    // Update streak - should recognize today's progress
    const streak = await streakService.updateStreaks(null);

    // Verify streak was created with correct date (not UTC-shifted)
    expect(streak.currentStreak).toBe(1);
    expect(streak.lastActivityDate).toBe(todayInTokyo);

    // Date should match user's calendar day, not UTC day
    console.log(`Today in Tokyo: ${todayInTokyo}`);
    console.log(`Stored lastActivityDate: ${streak.lastActivityDate}`);
  });

  test("should handle same-day threshold changes in Asia/Shanghai timezone (UTC+8)", async () => {
    // Set user timezone to Shanghai
    await streakRepository.upsert(null, {
      userTimezone: "Asia/Shanghai",
      dailyThreshold: 10,
      currentStreak: 0,
      longestStreak: 0,
      totalDaysActive: 0,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      startedDate: toSessionDate(new Date()),
    });

    // Log progress that meets threshold
    const now = new Date();
    const todayInShanghai = formatInTimeZone(
      now,
      "Asia/Shanghai",
      "yyyy-MM-dd",
    );

    await progressRepository.create({
      sessionId: session.id,
      bookId: book.id,
      currentPage: 10,
      pagesRead: 10,
      progressDate: todayInShanghai, // Store as user-timezone calendar day (ADR-014)
    });

    // First update - should meet threshold
    let streak = await streakService.updateStreaks(null);
    expect(streak.currentStreak).toBe(1);
    expect(streak.lastActivityDate).toBe(todayInShanghai);

    // Raise threshold on the same day
    await streakRepository.update(streak.id, {
      dailyThreshold: 20,
    } as any);

    // Update again - should reset to 0 (threshold no longer met)
    streak = await streakService.updateStreaks(null);
    expect(streak.currentStreak).toBe(0);
    expect(streak.lastActivityDate).toBe(todayInShanghai); // Date should remain the same
  });

  test("should correctly query today's progress in Asia/Kolkata timezone (UTC+5:30)", async () => {
    // Set user timezone to Kolkata (half-hour offset)
    await streakRepository.upsert(null, {
      userTimezone: "Asia/Kolkata",
      currentStreak: 0,
      longestStreak: 0,
      totalDaysActive: 0,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      startedDate: toSessionDate(new Date()),
    });

    // Log progress for today
    const now = new Date();
    const todayInKolkata = formatInTimeZone(now, "Asia/Kolkata", "yyyy-MM-dd");

    await progressRepository.create({
      sessionId: session.id,
      bookId: book.id,
      currentPage: 25,
      pagesRead: 25,
      progressDate: todayInKolkata, // Store as user-timezone calendar day (ADR-014)
    });

    // Update streak - should find today's progress without off-by-one error
    const streak = await streakService.updateStreaks(null);

    expect(streak.currentStreak).toBe(1);
    expect(streak.lastActivityDate).toBe(todayInKolkata);
    expect(streak.totalDaysActive).toBe(1);
  });

  test("should not include tomorrow's progress when querying today (Asia/Tokyo)", async () => {
    // Set user timezone to Tokyo
    await streakRepository.upsert(null, {
      userTimezone: "Asia/Tokyo",
      currentStreak: 0,
      longestStreak: 0,
      totalDaysActive: 0,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      startedDate: toSessionDate(new Date()),
    });

    const now = new Date();
    const todayInTokyo = formatInTimeZone(now, "Asia/Tokyo", "yyyy-MM-dd");

    // Calculate tomorrow's date in Tokyo timezone
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowInTokyo = formatInTimeZone(
      tomorrow,
      "Asia/Tokyo",
      "yyyy-MM-dd",
    );

    // Log progress for TODAY
    await progressRepository.create({
      sessionId: session.id,
      bookId: book.id,
      currentPage: 10,
      pagesRead: 10,
      progressDate: todayInTokyo, // Today
    });

    // Log progress for TOMORROW (simulating future-dated progress)
    await progressRepository.create({
      sessionId: session.id,
      bookId: book.id,
      currentPage: 20,
      pagesRead: 10,
      progressDate: tomorrowInTokyo, // Tomorrow
    });

    // Update streak - should only count today's 10 pages, not tomorrow's 10 pages
    const streak = await streakService.updateStreaks(null);

    // Verify only today's progress is counted
    expect(streak.currentStreak).toBe(1);
    expect(streak.lastActivityDate).toBe(todayInTokyo);

    // Get today's progress directly to verify query behavior
    const todayProgress = await progressRepository.getProgressForDate(
      todayInTokyo,
      todayInTokyo,
    );
    expect(todayProgress.pagesRead).toBe(10); // Only today's progress
  });

  test("activity calendar should have correct date bounds for Asia/Dubai (UTC+4)", async () => {
    // Set user timezone to Dubai
    await streakRepository.upsert(null, {
      userTimezone: "Asia/Dubai",
      currentStreak: 0,
      longestStreak: 0,
      totalDaysActive: 0,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      startedDate: toSessionDate(new Date()),
    });

    // Log progress for January 15, 2026
    await progressRepository.create({
      sessionId: session.id,
      bookId: book.id,
      currentPage: 50,
      pagesRead: 50,
      progressDate: "2026-01-15",
    });

    // Get activity calendar for January 2026
    const calendar = await streakService.getActivityCalendar(null, 2026, 0);

    // Should include January 15
    const jan15 = calendar.find((day) => day.date === "2026-01-15");
    expect(jan15).toBeDefined();
    expect(jan15?.pagesRead).toBe(50);

    // Calendar should have correct boundaries (no off-by-one from server timezone)
    const dates = calendar.map((day) => day.date);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    // First date should be in January
    expect(firstDate?.startsWith("2026-01")).toBe(true);

    // Last date should be in January (not bleeding into Feb or Dec)
    expect(lastDate?.startsWith("2026-01")).toBe(true);
  });
});
