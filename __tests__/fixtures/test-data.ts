import type { IStreak } from "@/models/Streak";
import type { IBook } from "@/models/Book";
import type { IProgressLog } from "@/models/ProgressLog";
import type { IReadingSession } from "@/models/ReadingSession";

/**
 * Test fixtures and utilities for tests
 */

// ============================================================================
// STREAK FIXTURES
// ============================================================================

export const mockStreakInitial: Partial<IStreak> = {
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: new Date("2025-11-17T05:00:00.000Z"),
  streakStartDate: new Date("2025-11-17T05:00:00.000Z"),
  totalDaysActive: 0,
  updatedAt: new Date("2025-11-17T05:00:00.000Z"),
};

export const mockStreakActive: Partial<IStreak> = {
  currentStreak: 5,
  longestStreak: 10,
  lastActivityDate: new Date("2025-11-16T05:00:00.000Z"),
  streakStartDate: new Date("2025-11-11T05:00:00.000Z"),
  totalDaysActive: 15,
  updatedAt: new Date("2025-11-16T05:00:00.000Z"),
};

export const mockStreakBroken: Partial<IStreak> = {
  currentStreak: 3,
  longestStreak: 5,
  lastActivityDate: new Date("2025-11-14T05:00:00.000Z"),
  streakStartDate: new Date("2025-11-12T05:00:00.000Z"),
  totalDaysActive: 8,
  updatedAt: new Date("2025-11-14T05:00:00.000Z"),
};

// ============================================================================
// BOOK FIXTURES
// ============================================================================

export const mockBook1: Partial<IBook> = {
  calibreId: 1,
  title: "A Dance with Dragons",
  authors: ["George R. R. Martin"],
  totalPages: 1040,
  publisher: "Bantam Books",
  pubDate: new Date("2011-07-12"),
  series: "A Song of Ice and Fire",
  tags: ["fantasy", "epic", "dragons"],
  isbn: "9780553801477",
  description: "In the aftermath of a colossal battle...",
  path: "George R. R. Martin/A Dance with Dragons (1)",
  orphaned: false,
};

export const mockBook2: Partial<IBook> = {
  calibreId: 2,
  title: "The Name of the Wind",
  authors: ["Patrick Rothfuss"],
  totalPages: 662,
  publisher: "DAW Books",
  pubDate: new Date("2007-03-27"),
  series: "The Kingkiller Chronicle",
  tags: ["fantasy", "magic"],
  isbn: "9780756404079",
  description: "Told in Kvothe's own voice...",
  path: "Patrick Rothfuss/The Name of the Wind (2)",
  orphaned: false,
};

export const mockOrphanedBook: Partial<IBook> = {
  calibreId: 999,
  title: "Orphaned Book",
  authors: ["Unknown Author"],
  totalPages: 300,
  path: "Unknown Author/Orphaned Book (999)",
  orphaned: true,
  orphanedAt: new Date("2025-11-01"),
};

// ============================================================================
// PROGRESS LOG FIXTURES
// ============================================================================

export const mockProgressLog1: Partial<IProgressLog> = {
  currentPage: 100,
  currentPercentage: 9.62, // 100/1040
  pagesRead: 100,
  progressDate: new Date("2025-11-15"),
  notes: "Great chapter!",
};

export const mockProgressLog2: Partial<IProgressLog> = {
  currentPage: 250,
  currentPercentage: 24.04, // 250/1040
  pagesRead: 150,
  progressDate: new Date("2025-11-16"),
  notes: "Plot thickens",
};

// ============================================================================
// READING STATUS FIXTURES (Removed - use ReadingSession instead)
// ============================================================================

// ============================================================================
// READING SESSION FIXTURES
// ============================================================================

export const mockSessionToRead: Partial<IReadingSession> = {
  sessionNumber: 1,
  status: "to-read",
  isActive: true,
};

export const mockSessionReadNext: Partial<IReadingSession> = {
  sessionNumber: 1,
  status: "read-next",
  isActive: true,
};

export const mockSessionReading: Partial<IReadingSession> = {
  sessionNumber: 1,
  status: "reading",
  startedDate: new Date("2025-11-15T05:00:00.000Z"),
  isActive: true,
};

export const mockSessionRead: Partial<IReadingSession> = {
  sessionNumber: 1,
  status: "read",
  startedDate: new Date("2025-11-01T05:00:00.000Z"),
  completedDate: new Date("2025-11-16T05:00:00.000Z"),
  review: "Amazing book!",
  isActive: true,
};

export const mockSessionArchived: Partial<IReadingSession> = {
  sessionNumber: 1,
  status: "read",
  startedDate: new Date("2025-10-01T05:00:00.000Z"),
  completedDate: new Date("2025-10-20T05:00:00.000Z"),
  review: "Great first read!",
  isActive: false,
};

export const mockSessionReread: Partial<IReadingSession> = {
  sessionNumber: 2,
  status: "reading",
  startedDate: new Date("2025-11-15T05:00:00.000Z"),
  isActive: true,
};

// ============================================================================
// CALIBRE BOOK FIXTURES (for Calibre DB tests)
// ============================================================================

export const mockCalibreBook = {
  id: 1,
  title: "A Dance with Dragons",
  authors: "George R. R. Martin",
  path: "George R. R. Martin/A Dance with Dragons (1)",
  has_cover: 1,
  isbn: "9780553801477",
  pubdate: "2011-07-12",
  publisher: "Bantam Books",
  series: "A Song of Ice and Fire",
  series_index: 5.0,
  timestamp: "2025-11-01 12:00:00",
  description: "In the aftermath of a colossal battle...",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to create dates for testing
 */
export function createTestDate(daysAgo: number, baseDate = "2025-11-17T05:00:00.000Z"): Date {
  const date = new Date(baseDate);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Helper to create a date at start of day (00:00:00)
 */
export function createTestDateStartOfDay(daysAgo: number): Date {
  const date = new Date("2025-11-17T00:00:00.000Z");
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Helper to create today's date at start of day
 */
export function getTodayStartOfDay(): Date {
  return new Date("2025-11-17T00:00:00.000Z");
}

/**
 * Helper to create a mock NextRequest for API route testing
 */
export function createMockRequest(
  method: string,
  url: string,
  body?: any
): Request & { nextUrl: URL } {
  const headers = new Headers({
    "content-type": "application/json",
  });

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  // Ensure we have a full URL (Request constructor requires it)
  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;

  const request = new Request(fullUrl, requestInit) as Request & { nextUrl: URL };

  // Add nextUrl property for Next.js compatibility
  request.nextUrl = new URL(fullUrl);

  return request;
}
