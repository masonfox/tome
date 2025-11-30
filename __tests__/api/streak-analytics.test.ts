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

    // Create streak record
    await streakRepository.create({
      currentStreak: 3,
      longestStreak: 3,
      lastActivityDate: new Date("2024-11-30"),
      dailyThreshold: 1,
      totalDaysActive: 3,
    });

    // Create progress on Nov 27, 28, 30 (skip Nov 29)
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: new Date("2024-11-27T12:00:00Z"),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: new Date("2024-11-28T12:00:00Z"),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: new Date("2024-11-30T12:00:00Z"),
      pagesRead: 50,
    });

    // Request 7 days of data
    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.dailyReadingHistory).toBeDefined();

    // Find the records for Nov 27-30
    const history = data.data.dailyReadingHistory;
    const nov27 = history.find((h: any) => h.date === "2024-11-27");
    const nov28 = history.find((h: any) => h.date === "2024-11-28");
    const nov29 = history.find((h: any) => h.date === "2024-11-29");
    const nov30 = history.find((h: any) => h.date === "2024-11-30");

    // All 4 days should exist in the response
    expect(nov27).toBeDefined();
    expect(nov28).toBeDefined();
    expect(nov29).toBeDefined(); // This is the missing day
    expect(nov30).toBeDefined();

    // Check that Nov 29 has 0 pages (filled in)
    expect(nov27.pagesRead).toBe(50);
    expect(nov28.pagesRead).toBe(50);
    expect(nov29.pagesRead).toBe(0); // Missing day filled with 0
    expect(nov30.pagesRead).toBe(50);

    // Check threshold met flags
    expect(nov27.thresholdMet).toBe(true);
    expect(nov28.thresholdMet).toBe(true);
    expect(nov29.thresholdMet).toBe(false); // 0 pages doesn't meet threshold
    expect(nov30.thresholdMet).toBe(true);
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

    // Create streak
    await streakRepository.create({
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: new Date("2024-11-30"),
      dailyThreshold: 10,
      totalDaysActive: 2,
    });

    // Create progress only on Nov 25 and Nov 30 (5 day gap)
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 25.0,
      progressDate: new Date("2024-11-25T12:00:00Z"),
      pagesRead: 100,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 50.0,
      progressDate: new Date("2024-11-30T12:00:00Z"),
      pagesRead: 100,
    });

    // Request 7 days of data
    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);

    const history = data.data.dailyReadingHistory;
    
    // Find all days from Nov 25-30
    const nov25 = history.find((h: any) => h.date === "2024-11-25");
    const nov26 = history.find((h: any) => h.date === "2024-11-26");
    const nov27 = history.find((h: any) => h.date === "2024-11-27");
    const nov28 = history.find((h: any) => h.date === "2024-11-28");
    const nov29 = history.find((h: any) => h.date === "2024-11-29");
    const nov30 = history.find((h: any) => h.date === "2024-11-30");

    // All days should exist
    expect(nov25).toBeDefined();
    expect(nov26).toBeDefined();
    expect(nov27).toBeDefined();
    expect(nov28).toBeDefined();
    expect(nov29).toBeDefined();
    expect(nov30).toBeDefined();

    // Check values
    expect(nov25.pagesRead).toBe(100);
    expect(nov26.pagesRead).toBe(0);
    expect(nov27.pagesRead).toBe(0);
    expect(nov28.pagesRead).toBe(0);
    expect(nov29.pagesRead).toBe(0);
    expect(nov30.pagesRead).toBe(100);
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

    // Create streak
    await streakRepository.create({
      currentStreak: 4,
      longestStreak: 4,
      lastActivityDate: new Date("2024-11-30"),
      dailyThreshold: 1,
      totalDaysActive: 4,
    });

    // User only started tracking 4 days ago (Nov 27-30)
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: new Date("2024-11-27T12:00:00Z"),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: new Date("2024-11-28T12:00:00Z"),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: new Date("2024-11-29T12:00:00Z"),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 66.67,
      progressDate: new Date("2024-11-30T12:00:00Z"),
      pagesRead: 50,
    });

    // Request 90 days of data (but user only has 4 days)
    const request = createMockRequest("GET", "/api/streak/analytics?days=90");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);

    const history = data.data.dailyReadingHistory;

    // Chart should only show 4 days (Nov 27-30), not 90 days with 86 empty days before
    expect(history.length).toBe(4);

    // First day should be Nov 27 (earliest progress)
    expect(history[0].date).toBe("2024-11-27");
    expect(history[0].pagesRead).toBe(50);

    // Last day should be Nov 30 (today)
    expect(history[3].date).toBe("2024-11-30");
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

    // Create streak
    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date("2024-11-30"),
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    // User has been tracking for 60 days
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 10.0,
      progressDate: new Date("2024-10-01T12:00:00Z"), // 60 days ago
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 20.0,
      progressDate: new Date("2024-11-30T12:00:00Z"), // Today
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

    // Should NOT trim - should start from 7 days ago, not from Oct 1
    const firstDate = new Date(history[0].date);
    const today = new Date("2024-11-30");
    const daysDiff = Math.round((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(daysDiff).toBe(7); // Started 7 days ago, not 60
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

    // Create streak
    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date("2024-11-30"),
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    // User just started today
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 25.0,
      progressDate: new Date("2024-11-30T12:00:00Z"),
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
    expect(history[0].date).toBe("2024-11-30");
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

  test("should return 404 when no streak exists", async () => {
    // Don't create any streak record
    const request = createMockRequest("GET", "/api/streak/analytics?days=7");
    const response = await GET(request as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("STREAK_NOT_FOUND");
  });
});
