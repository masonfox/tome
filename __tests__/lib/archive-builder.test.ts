import { describe, test, expect } from "bun:test";
import {
  buildArchiveHierarchy,
  matchesDateKey,
  getDateKeys,
} from "@/lib/utils/archive-builder";

/**
 * Archive Builder Tests
 * 
 * Tests the utility functions that build the year/month/week hierarchy
 * for journal archive navigation.
 * 
 * Key behaviors to test:
 * - Week calculation: Math.ceil(day / 7) - Days 1-7 = week 1, 8-14 = week 2, etc.
 * - Date boundary handling (month/year transitions)
 * - Leap year support (Feb 29)
 * - Count aggregation
 * - Sorting (descending at all levels)
 * - matchesDateKey logic for filtering
 */

describe("buildArchiveHierarchy", () => {
  describe("basic hierarchy building", () => {
    test("should return empty array for empty input", () => {
      // Act
      const result = buildArchiveHierarchy([]);

      // Assert
      expect(result).toHaveLength(0);
    });

    test("should build single year node for single date", () => {
      // Arrange
      const dates = [new Date("2024-11-15T10:00:00.000Z")];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("year");
      expect(result[0].label).toBe("2024");
      expect(result[0].dateKey).toBe("2024");
      expect(result[0].count).toBe(1);
    });

    test("should build month nodes under year", () => {
      // Arrange: Two dates in same month
      const dates = [
        new Date("2024-11-15T10:00:00.000Z"),
        new Date("2024-11-20T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].type).toBe("month");
      expect(result[0].children![0].label).toBe("November");
      expect(result[0].children![0].dateKey).toBe("2024-11");
      expect(result[0].children![0].count).toBe(2);
    });

    test("should build week nodes under months", () => {
      // Arrange: Dates in same week
      const dates = [
        new Date("2024-11-01T10:00:00.000Z"), // Day 1
        new Date("2024-11-03T10:00:00.000Z"), // Day 3
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should have weeks under month
      const month = result[0].children![0];
      expect(month.children).toHaveLength(1);
      expect(month.children![0].type).toBe("week");
      expect(month.children![0].dateKey).toBe("2024-11-W1");
      expect(month.children![0].count).toBe(2);
    });
  });

  describe("week calculation", () => {
    test("should calculate week 1 for days 1-7", () => {
      // Arrange: Days 1, 4, and 7 of November
      const dates = [
        new Date("2024-11-01T10:00:00.000Z"),
        new Date("2024-11-04T10:00:00.000Z"),
        new Date("2024-11-07T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: All should be in week 1
      const weeks = result[0].children![0].children!;
      expect(weeks).toHaveLength(1);
      expect(weeks[0].dateKey).toBe("2024-11-W1");
      expect(weeks[0].count).toBe(3);
    });

    test("should calculate week 2 for days 8-14", () => {
      // Arrange: Days 8, 10, and 14 of November
      const dates = [
        new Date("2024-11-08T10:00:00.000Z"),
        new Date("2024-11-10T10:00:00.000Z"),
        new Date("2024-11-14T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: All should be in week 2
      const weeks = result[0].children![0].children!;
      expect(weeks).toHaveLength(1);
      expect(weeks[0].dateKey).toBe("2024-11-W2");
      expect(weeks[0].count).toBe(3);
    });

    test("should handle week boundary (day 7 vs day 8)", () => {
      // Arrange: Day 7 (week 1) and day 8 (week 2)
      const dates = [
        new Date("2024-11-07T10:00:00.000Z"), // Week 1
        new Date("2024-11-08T10:00:00.000Z"), // Week 2
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should create 2 separate weeks
      const weeks = result[0].children![0].children!;
      expect(weeks).toHaveLength(2);
      expect(weeks[1].dateKey).toBe("2024-11-W1"); // Sorted descending
      expect(weeks[0].dateKey).toBe("2024-11-W2");
    });

    test("should calculate week 5 for days 29-31", () => {
      // Arrange: Days 29, 30, 31 of a 31-day month
      const dates = [
        new Date("2024-01-29T10:00:00.000Z"),
        new Date("2024-01-30T10:00:00.000Z"),
        new Date("2024-01-31T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should be in week 5
      const weeks = result[0].children![0].children!;
      expect(weeks).toHaveLength(1);
      expect(weeks[0].dateKey).toBe("2024-01-W5");
      expect(weeks[0].count).toBe(3);
    });

    test("should create separate weeks across different week ranges", () => {
      // Arrange: Days from weeks 1, 2, 3, 4, 5
      const dates = [
        new Date("2024-11-01T10:00:00.000Z"), // W1 (day 1)
        new Date("2024-11-08T10:00:00.000Z"), // W2 (day 8)
        new Date("2024-11-15T10:00:00.000Z"), // W3 (day 15)
        new Date("2024-11-22T10:00:00.000Z"), // W4 (day 22)
        new Date("2024-11-29T10:00:00.000Z"), // W5 (day 29)
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should create 5 weeks
      const weeks = result[0].children![0].children!;
      expect(weeks).toHaveLength(5);
      expect(weeks[4].dateKey).toBe("2024-11-W1"); // Sorted descending
      expect(weeks[3].dateKey).toBe("2024-11-W2");
      expect(weeks[2].dateKey).toBe("2024-11-W3");
      expect(weeks[1].dateKey).toBe("2024-11-W4");
      expect(weeks[0].dateKey).toBe("2024-11-W5");
    });
  });

  describe("date boundary handling", () => {
    test("should handle dates across month boundaries", () => {
      // Arrange: Jan 31 and Feb 1
      const dates = [
        new Date("2024-01-31T10:00:00.000Z"),
        new Date("2024-02-01T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should have 1 year with 2 months
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children![0].dateKey).toBe("2024-02"); // Descending
      expect(result[0].children![1].dateKey).toBe("2024-01");
    });

    test("should handle dates across year boundaries", () => {
      // Arrange: Dec 31, 2023 and Jan 1, 2024
      const dates = [
        new Date("2023-12-31T10:00:00.000Z"),
        new Date("2024-01-01T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should create 2 separate years
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("2024"); // Most recent first
      expect(result[1].label).toBe("2023");
    });

    test("should handle leap year (Feb 29)", () => {
      // Arrange: Feb 29, 2024
      const dates = [new Date("2024-02-29T10:00:00.000Z")];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should correctly handle leap year
      expect(result[0].children![0].label).toBe("February");
      expect(result[0].children![0].endDate).toBe("2024-02-29");
    });

    test("should handle February in non-leap year (28 days)", () => {
      // Arrange: Feb 28, 2023 (non-leap year)
      const dates = [new Date("2023-02-28T10:00:00.000Z")];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should have endDate of Feb 28
      expect(result[0].children![0].endDate).toBe("2023-02-28");
    });

    test("should handle months with 30 days", () => {
      // Arrange: April (30 days)
      const dates = [new Date("2024-04-30T10:00:00.000Z")];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should have endDate of April 30
      expect(result[0].children![0].endDate).toBe("2024-04-30");
    });

    test("should handle months with 31 days", () => {
      // Arrange: January (31 days)
      const dates = [new Date("2024-01-31T10:00:00.000Z")];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should have endDate of Jan 31
      expect(result[0].children![0].endDate).toBe("2024-01-31");
    });
  });

  describe("sorting", () => {
    test("should sort years in descending order", () => {
      // Arrange: Create dates in 2022, 2023, 2024
      const dates = [
        new Date("2022-06-15T10:00:00.000Z"),
        new Date("2024-03-15T10:00:00.000Z"),
        new Date("2023-09-15T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should be sorted 2024, 2023, 2022
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe("2024");
      expect(result[1].label).toBe("2023");
      expect(result[2].label).toBe("2022");
    });

    test("should sort months in descending order", () => {
      // Arrange: Create dates in Jan, Mar, Nov of same year
      const dates = [
        new Date("2024-01-15T10:00:00.000Z"),
        new Date("2024-11-15T10:00:00.000Z"),
        new Date("2024-03-15T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should be sorted Nov, Mar, Jan
      const months = result[0].children!;
      expect(months[0].dateKey).toBe("2024-11");
      expect(months[1].dateKey).toBe("2024-03");
      expect(months[2].dateKey).toBe("2024-01");
    });

    test("should sort weeks in descending order", () => {
      // Arrange: Create dates in weeks 1, 3, 5
      const dates = [
        new Date("2024-11-01T10:00:00.000Z"), // W1
        new Date("2024-11-29T10:00:00.000Z"), // W5
        new Date("2024-11-15T10:00:00.000Z"), // W3
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Should be sorted W5, W3, W1
      const weeks = result[0].children![0].children!;
      expect(weeks[0].dateKey).toBe("2024-11-W5");
      expect(weeks[1].dateKey).toBe("2024-11-W3");
      expect(weeks[2].dateKey).toBe("2024-11-W1");
    });
  });

  describe("count aggregation", () => {
    test("should aggregate counts correctly at year level", () => {
      // Arrange: 3 entries in Nov, 2 in Dec
      const dates = [
        new Date("2024-11-01T10:00:00.000Z"),
        new Date("2024-11-10T10:00:00.000Z"),
        new Date("2024-11-20T10:00:00.000Z"),
        new Date("2024-12-05T10:00:00.000Z"),
        new Date("2024-12-15T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Year count should be 5
      expect(result[0].count).toBe(5);
    });

    test("should aggregate counts correctly at month level", () => {
      // Arrange: 4 entries in November
      const dates = [
        new Date("2024-11-01T10:00:00.000Z"),
        new Date("2024-11-10T10:00:00.000Z"),
        new Date("2024-11-20T10:00:00.000Z"),
        new Date("2024-11-25T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Month count should be 4
      expect(result[0].children![0].count).toBe(4);
    });

    test("should aggregate counts correctly at week level", () => {
      // Arrange: 3 entries in week 2
      const dates = [
        new Date("2024-11-08T10:00:00.000Z"),
        new Date("2024-11-10T10:00:00.000Z"),
        new Date("2024-11-12T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Week count should be 3
      expect(result[0].children![0].children![0].count).toBe(3);
    });
  });

  describe("week label formatting", () => {
    test("should format single-day week label correctly", () => {
      // Arrange: Only one entry in week
      const dates = [new Date("2024-11-15T10:00:00.000Z")];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Label should be "Week 3 (Nov 15)"
      const week = result[0].children![0].children![0];
      expect(week.label).toBe("Week 3 (Nov 15)");
    });

    test("should format multi-day week label correctly", () => {
      // Arrange: Multiple days in same week
      const dates = [
        new Date("2024-11-15T10:00:00.000Z"),
        new Date("2024-11-17T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Label should show range "Week 3 (Nov 15-17)"
      const week = result[0].children![0].children![0];
      expect(week.label).toBe("Week 3 (Nov 15-17)");
    });
  });

  describe("start and end dates", () => {
    test("should set correct startDate and endDate for week", () => {
      // Arrange: Days 10 and 12 in week 2
      const dates = [
        new Date("2024-11-10T10:00:00.000Z"),
        new Date("2024-11-12T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Week should span from first to last actual date
      const week = result[0].children![0].children![0];
      expect(week.startDate).toBe("2024-11-10");
      expect(week.endDate).toBe("2024-11-12");
    });

    test("should set correct startDate and endDate for month", () => {
      // Arrange: Any dates in November
      const dates = [
        new Date("2024-11-10T10:00:00.000Z"),
        new Date("2024-11-20T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Month should span full month
      const month = result[0].children![0];
      expect(month.startDate).toBe("2024-11-01");
      expect(month.endDate).toBe("2024-11-30");
    });

    test("should set correct startDate and endDate for year", () => {
      // Arrange: Any dates in 2024
      const dates = [
        new Date("2024-03-15T10:00:00.000Z"),
        new Date("2024-09-20T10:00:00.000Z"),
      ];

      // Act
      const result = buildArchiveHierarchy(dates);

      // Assert: Year should span Jan 1 to Dec 31
      expect(result[0].startDate).toBe("2024-01-01");
      expect(result[0].endDate).toBe("2024-12-31");
    });
  });
});

describe("matchesDateKey", () => {
  describe("year matching", () => {
    test("should match date with year key", () => {
      // Assert
      expect(matchesDateKey("2024-11-15", "2024")).toBe(true);
      expect(matchesDateKey("2024-01-01", "2024")).toBe(true);
      expect(matchesDateKey("2024-12-31", "2024")).toBe(true);
    });

    test("should not match date with different year", () => {
      // Assert
      expect(matchesDateKey("2024-11-15", "2023")).toBe(false);
      expect(matchesDateKey("2025-01-01", "2024")).toBe(false);
    });
  });

  describe("month matching", () => {
    test("should match date with month key", () => {
      // Assert
      expect(matchesDateKey("2024-11-15", "2024-11")).toBe(true);
      expect(matchesDateKey("2024-11-01", "2024-11")).toBe(true);
      expect(matchesDateKey("2024-11-30", "2024-11")).toBe(true);
    });

    test("should not match date with different month", () => {
      // Assert
      expect(matchesDateKey("2024-11-15", "2024-10")).toBe(false);
      expect(matchesDateKey("2024-12-01", "2024-11")).toBe(false);
    });
  });

  describe("week matching", () => {
    test("should match dates in week 1 (days 1-7)", () => {
      // Assert
      expect(matchesDateKey("2024-11-01", "2024-11-W1")).toBe(true);
      expect(matchesDateKey("2024-11-04", "2024-11-W1")).toBe(true);
      expect(matchesDateKey("2024-11-07", "2024-11-W1")).toBe(true);
    });

    test("should match dates in week 2 (days 8-14)", () => {
      // Assert
      expect(matchesDateKey("2024-11-08", "2024-11-W2")).toBe(true);
      expect(matchesDateKey("2024-11-10", "2024-11-W2")).toBe(true);
      expect(matchesDateKey("2024-11-14", "2024-11-W2")).toBe(true);
    });

    test("should match dates in week 5 (days 29-31)", () => {
      // Assert
      expect(matchesDateKey("2024-11-29", "2024-11-W5")).toBe(true);
      expect(matchesDateKey("2024-11-30", "2024-11-W5")).toBe(true);
    });

    test("should not match dates in different weeks", () => {
      // Assert
      expect(matchesDateKey("2024-11-07", "2024-11-W2")).toBe(false); // Day 7 is W1
      expect(matchesDateKey("2024-11-08", "2024-11-W1")).toBe(false); // Day 8 is W2
      expect(matchesDateKey("2024-11-15", "2024-11-W2")).toBe(false); // Day 15 is W3
    });

    test("should not match dates in different months with same week number", () => {
      // Assert
      expect(matchesDateKey("2024-10-08", "2024-11-W2")).toBe(false);
      expect(matchesDateKey("2024-12-08", "2024-11-W2")).toBe(false);
    });
  });

  describe("boundary cases", () => {
    test("should handle week boundary correctly (day 7 vs 8)", () => {
      // Assert: Day 7 is last day of week 1, day 8 is first day of week 2
      expect(matchesDateKey("2024-11-07", "2024-11-W1")).toBe(true);
      expect(matchesDateKey("2024-11-08", "2024-11-W1")).toBe(false);
      expect(matchesDateKey("2024-11-08", "2024-11-W2")).toBe(true);
    });

    test("should handle invalid date keys", () => {
      // Assert: Should return false for malformed keys
      expect(matchesDateKey("2024-11-15", "invalid")).toBe(false);
      expect(matchesDateKey("2024-11-15", "20-11")).toBe(false);
    });
  });
});

describe("getDateKeys", () => {
  test("should extract year, month, and week from date", () => {
    // Act
    const result = getDateKeys("2024-11-15");

    // Assert
    expect(result.year).toBe("2024");
    expect(result.month).toBe("2024-11");
    expect(result.week).toBe("2024-11-W3"); // Day 15 is in week 3
  });

  test("should calculate week 1 for day 1", () => {
    // Act
    const result = getDateKeys("2024-11-01");

    // Assert
    expect(result.week).toBe("2024-11-W1");
  });

  test("should calculate week 1 for day 7", () => {
    // Act
    const result = getDateKeys("2024-11-07");

    // Assert
    expect(result.week).toBe("2024-11-W1");
  });

  test("should calculate week 2 for day 8", () => {
    // Act
    const result = getDateKeys("2024-11-08");

    // Assert
    expect(result.week).toBe("2024-11-W2");
  });

  test("should calculate week 5 for day 29", () => {
    // Act
    const result = getDateKeys("2024-11-29");

    // Assert
    expect(result.week).toBe("2024-11-W5");
  });

  test("should handle leap year date (Feb 29)", () => {
    // Act
    const result = getDateKeys("2024-02-29");

    // Assert
    expect(result.year).toBe("2024");
    expect(result.month).toBe("2024-02");
    expect(result.week).toBe("2024-02-W5");
  });

  test("should handle year boundary dates", () => {
    // Act
    const dec31 = getDateKeys("2024-12-31");
    const jan01 = getDateKeys("2025-01-01");

    // Assert
    expect(dec31.year).toBe("2024");
    expect(dec31.month).toBe("2024-12");
    expect(jan01.year).toBe("2025");
    expect(jan01.month).toBe("2025-01");
  });
});
