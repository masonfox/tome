import { toProgressDate } from '@/__tests__/test-utils';
import type { NewBook } from "@/lib/db/schema/books";
import type { NewReadingSession } from "@/lib/db/schema/reading-sessions";
import type { NewProgressLog } from "@/lib/db/schema/progress-logs";
import type { NewStreak } from "@/lib/db/schema/streaks";

/**
 * Test fixtures and utilities for tests
 */

// ============================================================================
// STREAK FIXTURES
// ============================================================================

export const mockStreakInitial: Partial<NewStreak> = {
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: new Date("2025-11-17T05:00:00.000Z"),
  streakStartDate: new Date("2025-11-17T05:00:00.000Z"),
  totalDaysActive: 0,
};

export const mockStreakActive: Partial<NewStreak> = {
  currentStreak: 5,
  longestStreak: 10,
  lastActivityDate: new Date("2025-11-16T05:00:00.000Z"),
  streakStartDate: new Date("2025-11-11T05:00:00.000Z"),
  totalDaysActive: 15,
};

export const mockStreakBroken: Partial<NewStreak> = {
  currentStreak: 3,
  longestStreak: 5,
  lastActivityDate: new Date("2025-11-14T05:00:00.000Z"),
  streakStartDate: new Date("2025-11-12T05:00:00.000Z"),
  totalDaysActive: 8,
};

// ============================================================================
// BOOK FIXTURES
// ============================================================================

export const mockBook1: Partial<NewBook> = {
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

export const mockBook2: Partial<NewBook> = {
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

export const mockOrphanedBook: Partial<NewBook> = {
  calibreId: 999,
  title: "Orphaned Book",
  authors: ["Unknown Author"],
  totalPages: 300,
  path: "Unknown Author/Orphaned Book (999)",
  tags: [],
  orphaned: true,
  orphanedAt: new Date("2025-11-01"),
};

// ============================================================================
// PROGRESS LOG FIXTURES
// ============================================================================

export const mockProgressLog1: Partial<NewProgressLog> = {
  currentPage: 100,
  currentPercentage: 9.62, // 100/1040
  pagesRead: 100,
  progressDate: "2025-11-15",
  notes: "Great chapter!",
};

export const mockProgressLog2: Partial<NewProgressLog> = {
  currentPage: 250,
  currentPercentage: 24.04, // 250/1040
  pagesRead: 150,
  progressDate: "2025-11-16",
  notes: "Plot thickens",
};

// ============================================================================
// READING SESSION FIXTURES
// ============================================================================

export const mockSessionToRead: Partial<NewReadingSession> = {
  sessionNumber: 1,
  status: "to-read",
  isActive: true,
};

export const mockSessionReadNext: Partial<NewReadingSession> = {
  sessionNumber: 1,
  status: "read-next",
  isActive: true,
  userId: null,
  bookId: 0, // Will be set in test
  createdAt: new Date("2025-11-01T05:00:00.000Z"),
  updatedAt: new Date("2025-11-01T05:00:00.000Z"),
};

export const mockSessionReading: Partial<NewReadingSession> = {
  sessionNumber: 1,
  status: "reading",
  startedDate: "2025-11-15",
  isActive: true,
  userId: null,
  bookId: 0, // Will be set in test
  createdAt: new Date("2025-11-15T05:00:00.000Z"),
  updatedAt: new Date("2025-11-15T05:00:00.000Z"),
};

export const mockSessionRead: Partial<NewReadingSession> = {
  sessionNumber: 1,
  status: "read",
  startedDate: "2025-11-01",
  completedDate: "2025-11-16",
  review: "Amazing book!",
  isActive: true,
  userId: null,
  bookId: 0, // Will be set in test
  createdAt: new Date("2025-11-01T05:00:00.000Z"),
  updatedAt: new Date("2025-11-16T05:00:00.000Z"),
};

export const mockSessionArchived: Partial<NewReadingSession> = {
  sessionNumber: 1,
  status: "read",
  startedDate: "2025-10-01",
  completedDate: "2025-10-20",
  review: "Great first read!",
  isActive: false,
  userId: null,
  bookId: 0, // Will be set in test
  createdAt: new Date("2025-10-01T05:00:00.000Z"),
  updatedAt: new Date("2025-10-20T05:00:00.000Z"),
};

export const mockSessionReread: Partial<NewReadingSession> = {
  sessionNumber: 2,
  status: "reading",
  startedDate: "2025-11-15",
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
  rating: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a properly typed test book with defaults
 * Usage: createTestBook({ title: "Custom Title", totalPages: 500 })
 */
export function createTestBook(overrides?: Partial<NewBook>): NewBook {
  return {
    calibreId: 1,
    source: 'calibre', // Default source for test books
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    path: "Test Author/Test Book (1)",
    orphaned: false,
    ...overrides,
  };
}

/**
 * Create a properly typed test session with defaults
 * Usage: createTestSession({ bookId: book.id, status: "reading" })
 */
export function createTestSession(overrides: Partial<NewReadingSession> & { bookId: number }): NewReadingSession {
  return {
    sessionNumber: 1,
    status: "to-read",
    isActive: true,
    userId: null,
    ...overrides,
  };
}

/**
 * Create a properly typed test progress log with defaults
 * Usage: createTestProgress({ bookId: book.id, sessionId: session.id, currentPage: 100 })
 */
export function createTestProgress(overrides: Partial<NewProgressLog> & { bookId: number; sessionId: number }): NewProgressLog {
  return {
    currentPage: 0,
    currentPercentage: 0,
    pagesRead: 0,
    progressDate: toProgressDate(new Date()),
    ...overrides,
  };
}

/**
 * Create a properly typed test streak with defaults
 * Usage: createTestStreak({ currentStreak: 5 })
 */
export function createTestStreak(overrides?: Partial<NewStreak>): NewStreak {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: new Date("2025-11-17T05:00:00.000Z"),
    streakStartDate: new Date("2025-11-17T05:00:00.000Z"),
    totalDaysActive: 0,
    ...overrides,
  };
}

/**
 * Helper to create dates for testing (returns Date object)
 */
export function createTestDate(daysAgo: number, baseDate = "2025-11-17T05:00:00.000Z"): Date {
  const date = new Date(baseDate);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Helper to create a date at start of day (00:00:00) (returns Date object)
 */
export function createTestDateStartOfDay(daysAgo: number): Date {
  const date = new Date("2025-11-17T00:00:00.000Z");
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Helper to create today's date at start of day (returns Date object)
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
  body?: any,
  customHeaders?: Record<string, string>
): Request & { nextUrl: URL } {
  const headers = new Headers({
    "content-type": "application/json",
  });

  // Add custom headers if provided
  if (customHeaders) {
    Object.entries(customHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

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
