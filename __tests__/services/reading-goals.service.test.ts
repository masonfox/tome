import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { readingGoalsService } from "@/lib/services";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../helpers/db-setup";
import type { TestDatabaseInstance } from "../helpers/db-setup";

let testDb: TestDatabaseInstance;

beforeAll(async () => {
  testDb = await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(testDb);
});

afterEach(async () => {
  await clearTestDatabase(testDb);
});

describe("ReadingGoalsService", () => {
  describe("createGoal()", () => {
    test("creates goal with valid data", async () => {
      const goal = await readingGoalsService.createGoal(null, 2026, 40);

      expect(goal).toBeDefined();
      expect(goal.id).toBeGreaterThan(0);
      expect(goal.year).toBe(2026);
      expect(goal.booksGoal).toBe(40);
    });

    test("rejects duplicate year", async () => {
      await readingGoalsService.createGoal(null, 2026, 40);

      expect(
        readingGoalsService.createGoal(null, 2026, 50)
      ).rejects.toThrow("already have a goal");
    });

    test("rejects goal less than 1", async () => {
      expect(
        readingGoalsService.createGoal(null, 2026, 0)
      ).rejects.toThrow("at least 1 book");
    });

    test("rejects goal greater than 9999", async () => {
      expect(
        readingGoalsService.createGoal(null, 2026, 10000)
      ).rejects.toThrow("less than 10,000 books");
    });

    test("rejects year less than 1900", async () => {
      expect(
        readingGoalsService.createGoal(null, 1899, 40)
      ).rejects.toThrow("between 1900 and 9999");
    });

    test("rejects year greater than 9999", async () => {
      expect(
        readingGoalsService.createGoal(null, 10000, 40)
      ).rejects.toThrow("between 1900 and 9999");
    });

    test("rejects non-integer year", async () => {
      expect(
        readingGoalsService.createGoal(null, 2026.5, 40)
      ).rejects.toThrow("between 1900 and 9999");
    });

    test("rejects non-integer goal", async () => {
      expect(
        readingGoalsService.createGoal(null, 2026, 40.5)
      ).rejects.toThrow("at least 1 book");
    });
  });

  describe("updateGoal()", () => {
    test("updates goal for current year", async () => {
      const currentYear = new Date().getFullYear();
      const created = await readingGoalsService.createGoal(null, currentYear, 40);

      const updated = await readingGoalsService.updateGoal(created.id, 50);

      expect(updated.booksGoal).toBe(50);
      expect(updated.year).toBe(currentYear);
    });

    test("updates goal for future year", async () => {
      const futureYear = new Date().getFullYear() + 1;
      const created = await readingGoalsService.createGoal(null, futureYear, 40);

      const updated = await readingGoalsService.updateGoal(created.id, 60);

      expect(updated.booksGoal).toBe(60);
    });

    test("rejects update for past year", async () => {
      const pastYear = new Date().getFullYear() - 1;
      const created = await readingGoalsService.createGoal(null, pastYear, 40);

      expect(
        readingGoalsService.updateGoal(created.id, 50)
      ).rejects.toThrow("past years");
    });

    test("rejects update for non-existent goal", async () => {
      expect(
        readingGoalsService.updateGoal(99999, 50)
      ).rejects.toThrow("not found");
    });

    test("rejects invalid goal value", async () => {
      const currentYear = new Date().getFullYear();
      const created = await readingGoalsService.createGoal(null, currentYear, 40);

      expect(
        readingGoalsService.updateGoal(created.id, 0)
      ).rejects.toThrow("at least 1 book");
    });
  });

  describe("deleteGoal()", () => {
    test("deletes goal for current year", async () => {
      const currentYear = new Date().getFullYear();
      const created = await readingGoalsService.createGoal(null, currentYear, 40);

      await readingGoalsService.deleteGoal(created.id);

      const retrieved = await readingGoalsService.getGoal(null, currentYear);
      expect(retrieved).toBeNull();
    });

    test("deletes goal for future year", async () => {
      const futureYear = new Date().getFullYear() + 1;
      const created = await readingGoalsService.createGoal(null, futureYear, 40);

      await readingGoalsService.deleteGoal(created.id);

      const retrieved = await readingGoalsService.getGoal(null, futureYear);
      expect(retrieved).toBeNull();
    });

    test("rejects delete for past year", async () => {
      const pastYear = new Date().getFullYear() - 1;
      const created = await readingGoalsService.createGoal(null, pastYear, 40);

      expect(
        readingGoalsService.deleteGoal(created.id)
      ).rejects.toThrow("past years");
    });

    test("rejects delete for non-existent goal", async () => {
      expect(
        readingGoalsService.deleteGoal(99999)
      ).rejects.toThrow("not found");
    });
  });

  describe("getGoal()", () => {
    test("returns goal with progress", async () => {
      const currentYear = new Date().getFullYear();
      await readingGoalsService.createGoal(null, currentYear, 40);

      const goalWithProgress = await readingGoalsService.getGoal(null, currentYear);

      expect(goalWithProgress).toBeDefined();
      expect(goalWithProgress?.goal.year).toBe(currentYear);
      expect(goalWithProgress?.goal.booksGoal).toBe(40);
      expect(goalWithProgress?.progress).toBeDefined();
      expect(goalWithProgress?.progress.booksCompleted).toBeGreaterThanOrEqual(0);
    });

    test("returns null for non-existent goal", async () => {
      const goalWithProgress = await readingGoalsService.getGoal(null, 2099);
      expect(goalWithProgress).toBeNull();
    });
  });

  describe("getCurrentYearGoal()", () => {
    test("returns current year goal", async () => {
      const currentYear = new Date().getFullYear();
      await readingGoalsService.createGoal(null, currentYear, 40);

      const goalWithProgress = await readingGoalsService.getCurrentYearGoal(null);

      expect(goalWithProgress).toBeDefined();
      expect(goalWithProgress?.goal.year).toBe(currentYear);
    });

    test("returns null when no current year goal", async () => {
      const goalWithProgress = await readingGoalsService.getCurrentYearGoal(null);
      expect(goalWithProgress).toBeNull();
    });
  });

  describe("getAllGoals()", () => {
    test("returns all goals ordered by year descending", async () => {
      const currentYear = new Date().getFullYear();
      await readingGoalsService.createGoal(null, currentYear - 1, 30);
      await readingGoalsService.createGoal(null, currentYear, 40);
      await readingGoalsService.createGoal(null, currentYear + 1, 50);

      const goals = await readingGoalsService.getAllGoals(null);

      expect(goals).toHaveLength(3);
      expect(goals[0].year).toBe(currentYear + 1);
      expect(goals[1].year).toBe(currentYear);
      expect(goals[2].year).toBe(currentYear - 1);
    });

    test("returns empty array when no goals exist", async () => {
      const goals = await readingGoalsService.getAllGoals(null);
      expect(goals).toEqual([]);
    });
  });

  describe("calculateProgress()", () => {
    test("calculates progress correctly with zero books", async () => {
      const currentYear = new Date().getFullYear();
      const goalCreatedAt = new Date(currentYear, 0, 1); // Jan 1
      const progress = await readingGoalsService.calculateProgress(null, currentYear, 40, goalCreatedAt);

      expect(progress.booksCompleted).toBe(0);
      expect(progress.booksRemaining).toBe(40);
      expect(progress.completionPercentage).toBe(0);
      expect(progress.daysElapsed).toBeGreaterThanOrEqual(0);
    });

    test("caps completion percentage at 100", async () => {
      const currentYear = new Date().getFullYear();
      const goalCreatedAt = new Date(currentYear, 0, 1); // Jan 1
      // Mock scenario: would need actual books to test realistically
      const progress = await readingGoalsService.calculateProgress(null, currentYear, 1, goalCreatedAt);

      expect(progress.completionPercentage).toBeLessThanOrEqual(100);
    });

    test("calculates pace status based on expected progress", async () => {
      const currentYear = new Date().getFullYear();
      const goalCreatedAt = new Date(currentYear, 0, 1); // Jan 1
      const progress = await readingGoalsService.calculateProgress(null, currentYear, 40, goalCreatedAt);

      expect(["ahead", "on-track", "behind"]).toContain(progress.paceStatus);
    });

    test("shows on-track status for newly created mid-year goals", async () => {
      const currentYear = new Date().getFullYear();
      const goalCreatedAt = new Date(); // Today
      const progress = await readingGoalsService.calculateProgress(null, currentYear, 40, goalCreatedAt);

      // Should show on-track for brand new goals (0 days elapsed)
      expect(progress.paceStatus).toBe("on-track");
      expect(progress.booksAheadBehind).toBe(0);
    });
  });

  describe("getYearsSummary()", () => {
    test("returns empty array when no books completed", async () => {
      const summary = await readingGoalsService.getYearsSummary(null);
      expect(summary).toEqual([]);
    });

    // Note: Testing with actual completed books would require integration tests
  });
});
