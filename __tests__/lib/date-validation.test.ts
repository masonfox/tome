import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  validateDateString, 
  getTodayDateString, 
  isFutureDate, 
  formatDateToString 
} from '@/lib/utils/date-validation';

/**
 * Date Validation Unit Tests
 * 
 * Tests the validation utilities that are the GATEKEEPERS preventing bad data from entering the system.
 * 
 * ## Purpose
 * 
 * These functions validate date strings at the API boundary. If these fail, corrupt data enters the database.
 * 
 * ## What We Test
 * 
 * 1. **validateDateString()** - The primary gatekeeper
 *    - Format validation (YYYY-MM-DD)
 *    - Calendar date validation (no Feb 31)
 *    - Leap year handling
 *    
 * 2. **isFutureDate()** - Prevents logging progress for tomorrow
 *    - Comparison logic
 *    - Edge cases (today, yesterday, tomorrow)
 *    
 * 3. **getTodayDateString()** - Server-side "today" generation
 *    - Format correctness
 *    - Timezone handling
 *    
 * 4. **formatDateToString()** - Date object → string conversion
 *    - Format correctness
 *    - Edge cases (midnight, leap years)
 */

describe("validateDateString", () => {
  describe("Valid Date Formats", () => {
    test("accepts valid YYYY-MM-DD date", () => {
      expect(validateDateString("2025-01-08")).toBe(true);
    });

    test("accepts date with leading zeros", () => {
      expect(validateDateString("2025-01-01")).toBe(true);
      expect(validateDateString("2025-01-09")).toBe(true);
    });

    test("accepts end of month dates", () => {
      expect(validateDateString("2025-01-31")).toBe(true); // 31 days
      expect(validateDateString("2025-04-30")).toBe(true); // 30 days
      expect(validateDateString("2025-02-28")).toBe(true); // 28 days (non-leap)
    });

    test("accepts leap year February 29", () => {
      expect(validateDateString("2024-02-29")).toBe(true); // 2024 is leap year
      expect(validateDateString("2000-02-29")).toBe(true); // 2000 is leap year (divisible by 400)
    });

    test("accepts edge dates (year boundaries)", () => {
      expect(validateDateString("2025-01-01")).toBe(true);
      expect(validateDateString("2025-12-31")).toBe(true);
    });

    test("accepts old dates", () => {
      expect(validateDateString("2000-01-01")).toBe(true);
      expect(validateDateString("1990-06-15")).toBe(true);
    });
  });

  describe("Invalid Format", () => {
    test("rejects date without zero padding", () => {
      expect(validateDateString("2025-1-8")).toBe(false);
      expect(validateDateString("2025-01-8")).toBe(false);
      expect(validateDateString("2025-1-01")).toBe(false);
    });

    test("rejects US format (MM/DD/YYYY)", () => {
      expect(validateDateString("01/08/2025")).toBe(false);
    });

    test("rejects ISO timestamp", () => {
      expect(validateDateString("2025-01-08T10:30:00.000Z")).toBe(false);
    });

    test("rejects human-readable format", () => {
      expect(validateDateString("Jan 8, 2025")).toBe(false);
      expect(validateDateString("January 8 2025")).toBe(false);
    });

    test("rejects 2-digit year", () => {
      expect(validateDateString("25-01-08")).toBe(false);
    });

    test("rejects empty string", () => {
      expect(validateDateString("")).toBe(false);
    });

    test("rejects nonsense strings", () => {
      expect(validateDateString("not-a-date")).toBe(false);
      expect(validateDateString("invalid")).toBe(false);
      expect(validateDateString("2025-13-45")).toBe(false);
    });

    test("rejects dates with extra characters", () => {
      expect(validateDateString("2025-01-08 extra")).toBe(false);
      expect(validateDateString("2025-01-08T")).toBe(false);
    });
  });

  describe("Invalid Calendar Dates", () => {
    test("rejects February 30 and 31", () => {
      expect(validateDateString("2025-02-30")).toBe(false);
      expect(validateDateString("2025-02-31")).toBe(false);
    });

    test("rejects February 29 in non-leap years", () => {
      expect(validateDateString("2025-02-29")).toBe(false); // 2025 not leap
      expect(validateDateString("2023-02-29")).toBe(false); // 2023 not leap
      expect(validateDateString("1900-02-29")).toBe(false); // 1900 not leap (not divisible by 400)
    });

    test("rejects invalid months", () => {
      expect(validateDateString("2025-00-01")).toBe(false); // Month 00
      expect(validateDateString("2025-13-01")).toBe(false); // Month 13
      expect(validateDateString("2025-99-01")).toBe(false); // Month 99
    });

    test("rejects invalid days", () => {
      expect(validateDateString("2025-01-00")).toBe(false); // Day 00
      expect(validateDateString("2025-01-32")).toBe(false); // Jan has 31 days
      expect(validateDateString("2025-04-31")).toBe(false); // Apr has 30 days
      expect(validateDateString("2025-06-31")).toBe(false); // Jun has 30 days
    });

    test("rejects 31st day for 30-day months", () => {
      expect(validateDateString("2025-04-31")).toBe(false); // April
      expect(validateDateString("2025-06-31")).toBe(false); // June
      expect(validateDateString("2025-09-31")).toBe(false); // September
      expect(validateDateString("2025-11-31")).toBe(false); // November
    });
  });

  describe("Leap Year Edge Cases", () => {
    test("correctly identifies leap years", () => {
      // Divisible by 4 = leap year
      expect(validateDateString("2024-02-29")).toBe(true);
      expect(validateDateString("2020-02-29")).toBe(true);
      
      // Divisible by 100 = NOT leap year (unless also divisible by 400)
      expect(validateDateString("1900-02-29")).toBe(false);
      expect(validateDateString("2100-02-29")).toBe(false);
      
      // Divisible by 400 = IS leap year
      expect(validateDateString("2000-02-29")).toBe(true);
      expect(validateDateString("2400-02-29")).toBe(true);
    });

    test("Feb 28 always valid", () => {
      expect(validateDateString("2024-02-28")).toBe(true); // Leap year
      expect(validateDateString("2025-02-28")).toBe(true); // Non-leap year
    });
  });
});

describe("getTodayDateString", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns date in YYYY-MM-DD format", () => {
    vi.setSystemTime(new Date("2025-01-10T15:30:00Z"));
    
    const result = getTodayDateString();
    
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("zero-pads single-digit months and days", () => {
    vi.setSystemTime(new Date("2025-01-05T12:00:00Z"));
    
    const result = getTodayDateString();
    
    expect(result).toBe("2025-01-05");
  });

  test("handles end of month", () => {
    vi.setSystemTime(new Date("2025-01-31T12:00:00Z"));
    
    const result = getTodayDateString();
    
    expect(result).toBe("2025-01-31");
  });

  test("handles end of year", () => {
    vi.setSystemTime(new Date("2024-12-31T12:00:00Z"));
    
    const result = getTodayDateString();
    
    expect(result).toBe("2024-12-31");
  });

  test("handles start of year", () => {
    vi.setSystemTime(new Date("2025-01-01T00:30:00Z"));
    
    const result = getTodayDateString();
    
    expect(result).toBe("2025-01-01");
  });

  test("produces format that passes validateDateString", () => {
    vi.setSystemTime(new Date("2025-01-10T15:30:00Z"));
    
    const result = getTodayDateString();
    
    expect(validateDateString(result)).toBe(true);
  });

  test("consistent throughout entire day", () => {
    // All these times on Jan 10 should return "2025-01-10"
    const times = [
      new Date("2025-01-10T00:00:00Z"),
      new Date("2025-01-10T06:00:00Z"),
      new Date("2025-01-10T12:00:00Z"),
      new Date("2025-01-10T18:00:00Z"),
      new Date("2025-01-10T23:59:59Z"),
    ];

    const results = times.map(time => {
      vi.setSystemTime(time);
      return getTodayDateString();
    });

    expect(results).toEqual([
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
    ]);
  });
});

describe("isFutureDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns false for past dates", () => {
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));
    
    expect(isFutureDate("2025-01-09")).toBe(false);
    expect(isFutureDate("2025-01-01")).toBe(false);
    expect(isFutureDate("2024-12-31")).toBe(false);
  });

  test("returns false for today", () => {
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));
    
    expect(isFutureDate("2025-01-10")).toBe(false);
  });

  test("returns true for future dates", () => {
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));
    
    expect(isFutureDate("2025-01-11")).toBe(true);
    expect(isFutureDate("2025-01-15")).toBe(true);
    expect(isFutureDate("2025-12-31")).toBe(true);
    expect(isFutureDate("2026-01-01")).toBe(true);
  });

  test("uses string comparison (lexicographic)", () => {
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));
    
    // YYYY-MM-DD sorts lexicographically correct
    expect("2025-01-11" > "2025-01-10").toBe(true);
    expect("2025-01-09" < "2025-01-10").toBe(true);
    
    expect(isFutureDate("2025-01-11")).toBe(true);
    expect(isFutureDate("2025-01-09")).toBe(false);
  });

  test("handles year boundaries correctly", () => {
    // Dec 31 should not consider Jan 1 of next year as "future" if we're already past it
    vi.setSystemTime(new Date("2024-12-31T12:00:00Z"));
    
    expect(isFutureDate("2025-01-01")).toBe(true); // Tomorrow
    expect(isFutureDate("2024-12-31")).toBe(false); // Today
    expect(isFutureDate("2024-12-30")).toBe(false); // Yesterday
  });

  test("consistent throughout the day", () => {
    // At any time on Jan 10, tomorrow (Jan 11) is future, yesterday (Jan 9) is not
    const times = [
      new Date("2025-01-10T00:00:01Z"),
      new Date("2025-01-10T12:00:00Z"),
      new Date("2025-01-10T23:59:59Z"),
    ];

    times.forEach(time => {
      vi.setSystemTime(time);
      expect(isFutureDate("2025-01-11")).toBe(true);
      expect(isFutureDate("2025-01-10")).toBe(false);
      expect(isFutureDate("2025-01-09")).toBe(false);
    });
  });
});

describe("formatDateToString", () => {
  test("converts Date object to YYYY-MM-DD string", () => {
    const date = new Date("2025-01-10T15:30:00Z");
    
    const result = formatDateToString(date);
    
    expect(result).toBe("2025-01-10");
  });

  test("zero-pads single-digit months and days", () => {
    const date = new Date("2025-01-05T12:00:00Z");
    
    const result = formatDateToString(date);
    
    expect(result).toBe("2025-01-05");
  });

  test("handles midnight", () => {
    const date = new Date("2025-01-10T00:00:00Z");
    
    const result = formatDateToString(date);
    
    expect(result).toBe("2025-01-10");
  });

  test("handles end of day", () => {
    const date = new Date("2025-01-10T23:59:59Z");
    
    const result = formatDateToString(date);
    
    expect(result).toBe("2025-01-10");
  });

  test("handles leap year dates", () => {
    const date = new Date("2024-02-29T12:00:00Z");
    
    const result = formatDateToString(date);
    
    expect(result).toBe("2024-02-29");
  });

  test("handles year boundaries", () => {
    const endOfYear = new Date("2024-12-31T12:00:00Z");
    const startOfYear = new Date("2025-01-01T12:00:00Z");
    
    expect(formatDateToString(endOfYear)).toBe("2024-12-31");
    expect(formatDateToString(startOfYear)).toBe("2025-01-01");
  });

  test("produces format that passes validateDateString", () => {
    const date = new Date("2025-01-10T15:30:00Z");
    
    const result = formatDateToString(date);
    
    expect(validateDateString(result)).toBe(true);
  });

  test("roundtrip: Date → string → Date preserves date", () => {
    const originalDate = new Date("2025-01-10T15:30:00Z");
    
    const dateString = formatDateToString(originalDate);
    const parsedDate = new Date(dateString + "T00:00:00Z");
    
    // Should be same date (ignoring time)
    expect(parsedDate.getUTCFullYear()).toBe(originalDate.getUTCFullYear());
    expect(parsedDate.getUTCMonth()).toBe(originalDate.getUTCMonth());
    expect(parsedDate.getUTCDate()).toBe(originalDate.getUTCDate());
  });
});

describe("Integration - Validation Pipeline", () => {
  test("getTodayDateString output passes validateDateString", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-10T15:30:00Z"));
    
    const today = getTodayDateString();
    
    expect(validateDateString(today)).toBe(true);
    
    vi.useRealTimers();
  });

  test("formatDateToString output passes validateDateString", () => {
    const date = new Date("2025-01-10T15:30:00Z");
    
    const dateString = formatDateToString(date);
    
    expect(validateDateString(dateString)).toBe(true);
  });

  test("isFutureDate works with getTodayDateString", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));
    
    const today = getTodayDateString();
    
    expect(isFutureDate(today)).toBe(false); // Today is not future
    
    vi.useRealTimers();
  });

  test("complete pipeline: Date → string → validation → future check", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));
    
    // 1. Convert Date to string
    const pastDate = new Date("2025-01-08T10:00:00Z");
    const pastDateString = formatDateToString(pastDate);
    
    // 2. Validate format
    expect(validateDateString(pastDateString)).toBe(true);
    
    // 3. Check if future
    expect(isFutureDate(pastDateString)).toBe(false);
    
    // 4. Future date
    const futureDate = new Date("2025-01-12T10:00:00Z");
    const futureDateString = formatDateToString(futureDate);
    
    expect(validateDateString(futureDateString)).toBe(true);
    expect(isFutureDate(futureDateString)).toBe(true);
    
    vi.useRealTimers();
  });
});
