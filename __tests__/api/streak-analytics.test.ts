import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/streak/analytics/route";
import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";

/**
 * Test suite for /api/streak/analytics endpoint
 * 
 * Focus areas:
 * 1. Missing days filled with zero values in chart data
 * 2. Chart trimmed to start from earliest progress date (not full requested timeframe)
 * 3. Proper handling of different time period parameters
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

// Helper to get relative dates (works regardless of current date)
function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0); // Noon UTC
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

describe("GET /api/streak/analytics - Missing Days Fill", () => {
  test("should fill in missing days with zero values", async () => {
    // Create a book and session
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

    // Use relative dates: 3 days ago, 2 days ago, today (skip 1 day ago)
    const day3Ago = getDaysAgo(3);
    const day2Ago = getDaysAgo(2);
    const today = getDaysAgo(0);
    const day1Ago = getDaysAgo(1);

    // Create streak record
    await streakRepository.create({
      currentStreak: 3,
      longestStreak: 3,
      lastActivityDate: today,
      dailyThreshold: 1,
      totalDaysActive: 3,
    });

    // Create progress on day3, day2, today (skip day1 - the missing day)
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: day3Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: day2Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: today,
      pagesRead: 50,
    });

    // Request 7 days of data
    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.dailyReadingHistory).toBeDefined();

    // Find the records for our test days
    const history = data.data.dailyReadingHistory;
    const day3Data = history.find((h: any) => h.date === formatDate(day3Ago));
    const day2Data = history.find((h: any) => h.date === formatDate(day2Ago));
    const day1Data = history.find((h: any) => h.date === formatDate(day1Ago));
    const todayData = history.find((h: any) => h.date === formatDate(today));

    // All 4 days should exist in the response
    expect(day3Data).toBeDefined();
    expect(day2Data).toBeDefined();
    expect(day1Data).toBeDefined(); // This is the missing day
    expect(todayData).toBeDefined();

    // Check that day1 (missing day) has 0 pages (filled in)
    expect(day3Data.pagesRead).toBe(50);
    expect(day2Data.pagesRead).toBe(50);
    expect(day1Data.pagesRead).toBe(0); // Missing day filled with 0
    expect(todayData.pagesRead).toBe(50);

    // Check threshold met flags
    expect(day3Data.thresholdMet).toBe(true);
    expect(day2Data.thresholdMet).toBe(true);
    expect(day1Data.thresholdMet).toBe(false); // 0 pages doesn't meet threshold
    expect(todayData.thresholdMet).toBe(true);
  });

  test("should fill multiple consecutive missing days", async () => {
    // Create a book and session
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Sporadic Book",
      authors: ["Author Two"],
      totalPages: 400,
      tags: [],
      path: "Author Two/Sporadic Book (2)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Use relative dates: 5 days ago and today (4 day gap)
    const day5Ago = getDaysAgo(5);
    const today = getDaysAgo(0);

    // Create streak
    await streakRepository.create({
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: today,
      dailyThreshold: 10,
      totalDaysActive: 2,
    });

    // Create progress only on day5 and today (4 day gap)
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 25.0,
      progressDate: day5Ago,
      pagesRead: 100,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 50.0,
      progressDate: today,
      pagesRead: 100,
    });

    // Request 7 days of data
    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);

    const history = data.data.dailyReadingHistory;
    
    // Find all days from day5 to today
    const day5Data = history.find((h: any) => h.date === formatDate(day5Ago));
    const day4Data = history.find((h: any) => h.date === formatDate(getDaysAgo(4)));
    const day3Data = history.find((h: any) => h.date === formatDate(getDaysAgo(3)));
    const day2Data = history.find((h: any) => h.date === formatDate(getDaysAgo(2)));
    const day1Data = history.find((h: any) => h.date === formatDate(getDaysAgo(1)));
    const todayData = history.find((h: any) => h.date === formatDate(today));

    // All days should exist
    expect(day5Data).toBeDefined();
    expect(day4Data).toBeDefined();
    expect(day3Data).toBeDefined();
    expect(day2Data).toBeDefined();
    expect(day1Data).toBeDefined();
    expect(todayData).toBeDefined();

    // Check values
    expect(day5Data.pagesRead).toBe(100);
    expect(day4Data.pagesRead).toBe(0);
    expect(day3Data.pagesRead).toBe(0);
    expect(day2Data.pagesRead).toBe(0);
    expect(day1Data.pagesRead).toBe(0);
    expect(todayData.pagesRead).toBe(100);
  });
});

describe("GET /api/streak/analytics - Chart Trimming", () => {
  test("should trim chart to start from earliest progress date", async () => {
    // Create a book and session
    const book = await bookRepository.create({
      calibreId: 3,
      title: "Recent Book",
      authors: ["Author Three"],
      totalPages: 300,
      tags: [],
      path: "Author Three/Recent Book (3)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // User only started tracking 3 days ago
    const day3Ago = getDaysAgo(3);
    const day2Ago = getDaysAgo(2);
    const day1Ago = getDaysAgo(1);
    const today = getDaysAgo(0);

    // Create streak
    await streakRepository.create({
      currentStreak: 4,
      longestStreak: 4,
      lastActivityDate: today,
      dailyThreshold: 1,
      totalDaysActive: 4,
    });

    // Create progress for last 4 days
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: day3Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: day2Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: day1Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 66.67,
      progressDate: today,
      pagesRead: 50,
    });

    // Request 90 days of data (but user only has 4 days)
    const request = createMockRequest("GET", "/api/streak/analytics?days=90");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);

    const history = data.data.dailyReadingHistory;

    // Chart should only show 4 days, not 90 days with 86 empty days before
    expect(history.length).toBe(4);

    // First day should be day3Ago (earliest progress)
    expect(history[0].date).toBe(formatDate(day3Ago));
    expect(history[0].pagesRead).toBe(50);

    // Last day should be today
    expect(history[3].date).toBe(formatDate(today));
    expect(history[3].pagesRead).toBe(50);
  });

  test("should not trim if earliest progress is before requested start", async () => {
    // Create a book and session
    const book = await bookRepository.create({
      calibreId: 4,
      title: "Long History Book",
      authors: ["Author Four"],
      totalPages: 500,
      tags: [],
      path: "Author Four/Long History Book (4)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // User has been tracking for 60 days
    const day60Ago = getDaysAgo(60);
    const today = getDaysAgo(0);

    // Create streak
    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    // Create progress 60 days ago and today
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 10.0,
      progressDate: day60Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 20.0,
      progressDate: today,
      pagesRead: 50,
    });

    // Request only 7 days of data
    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);

    const history = data.data.dailyReadingHistory;

    // Should show 8 days (7 days requested + today)
    expect(history.length).toBe(8);

    // Should NOT trim - should start from 7 days ago, not from 60 days ago
    const firstDate = new Date(history[0].date);
    const lastDate = new Date(history[history.length - 1].date);
    const daysDiff = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(daysDiff).toBe(7); // 7 day span, not 60
  });

  test("should handle edge case where earliest progress is today", async () => {
    // Create a book and session
    const book = await bookRepository.create({
      calibreId: 5,
      title: "Brand New Book",
      authors: ["Author Five"],
      totalPages: 200,
      tags: [],
      path: "Author Five/Brand New Book (5)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const today = getDaysAgo(0);

    // Create streak
    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    // User just started today
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 25.0,
      progressDate: today,
      pagesRead: 50,
    });

    // Request 30 days of data
    const request = createMockRequest("GET", "/api/streak/analytics?days=30");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);

    const history = data.data.dailyReadingHistory;

    // Should only show 1 day (today)
    expect(history.length).toBe(1);
    expect(history[0].date).toBe(formatDate(today));
    expect(history[0].pagesRead).toBe(50);
  });
});

describe("GET /api/streak/analytics - Time Period Parameters", () => {
  test("should handle numeric days parameter", async () => {
    // Create minimal data
    const book = await bookRepository.create({
      calibreId: 6,
      title: "Param Test Book",
      authors: ["Author Six"],
      totalPages: 300,
      tags: [],
      path: "Author Six/Param Test Book (6)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: new Date(),
      pagesRead: 50,
    });

    const request = createMockRequest("GET", "/api/streak/analytics?days=14");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test("should handle 'this-year' parameter", async () => {
    const book = await bookRepository.create({
      calibreId: 7,
      title: "Year Test Book",
      authors: ["Author Seven"],
      totalPages: 300,
      tags: [],
      path: "Author Seven/Year Test Book (7)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: new Date(),
      pagesRead: 50,
    });

    const request = createMockRequest("GET", "/api/streak/analytics?days=this-year");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test("should handle 'all-time' parameter", async () => {
    const book = await bookRepository.create({
      calibreId: 8,
      title: "All Time Book",
      authors: ["Author Eight"],
      totalPages: 300,
      tags: [],
      path: "Author Eight/All Time Book (8)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: new Date(),
      pagesRead: 50,
    });

    const request = createMockRequest("GET", "/api/streak/analytics?days=all-time");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test("should return 400 for invalid days parameter", async () => {
    const request = createMockRequest("GET", "/api/streak/analytics?days=invalid");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_PARAMETER");
  });

  test("should return empty history when no progress exists", async () => {
    // Create a streak but no progress logs
    await streakRepository.create({
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: getDaysAgo(0),
      dailyThreshold: 1,
      totalDaysActive: 0,
    });

    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Should return empty history or all zeros since no progress exists
    expect(data.data.dailyReadingHistory).toBeDefined();
  });
});
