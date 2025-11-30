import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { readingGoalRepository } from "@/lib/repositories";
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

describe("ReadingGoalRepository", () => {
  describe("create()", () => {
    test("creates goal with valid data", async () => {
      const goal = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      expect(goal).toBeDefined();
      expect(goal.id).toBeGreaterThan(0);
      expect(goal.year).toBe(2026);
      expect(goal.booksGoal).toBe(40);
      expect(goal.userId).toBeNull();
    });

    test("prevents duplicate user-year combinations", async () => {
      await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      // Attempt to create duplicate
      expect(
        readingGoalRepository.create({
          userId: null,
          year: 2026,
          booksGoal: 50,
        })
      ).rejects.toThrow();
    });

    test("enforces minimum goal constraint", async () => {
      expect(
        readingGoalRepository.create({
          userId: null,
          year: 2026,
          booksGoal: 0,
        })
      ).rejects.toThrow();
    });

    test("enforces year range constraint", async () => {
      expect(
        readingGoalRepository.create({
          userId: null,
          year: 1899,
          booksGoal: 40,
        })
      ).rejects.toThrow();

      expect(
        readingGoalRepository.create({
          userId: null,
          year: 10000,
          booksGoal: 40,
        })
      ).rejects.toThrow();
    });
  });

  describe("findByUserAndYear()", () => {
    test("finds goal for specific year", async () => {
      const created = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const found = await readingGoalRepository.findByUserAndYear(null, 2026);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.year).toBe(2026);
      expect(found?.booksGoal).toBe(40);
    });

    test("returns undefined for non-existent year", async () => {
      const found = await readingGoalRepository.findByUserAndYear(null, 2099);
      expect(found).toBeUndefined();
    });

    test("returns undefined when no goals exist", async () => {
      const found = await readingGoalRepository.findByUserAndYear(null, 2026);
      expect(found).toBeUndefined();
    });
  });

  describe("findByUserId()", () => {
    test("returns all goals for user ordered by year descending", async () => {
      await readingGoalRepository.create({
        userId: null,
        year: 2024,
        booksGoal: 30,
      });

      await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 50,
      });

      await readingGoalRepository.create({
        userId: null,
        year: 2025,
        booksGoal: 40,
      });

      const goals = await readingGoalRepository.findByUserId(null);
      expect(goals).toHaveLength(3);
      expect(goals[0].year).toBe(2026);
      expect(goals[1].year).toBe(2025);
      expect(goals[2].year).toBe(2024);
    });

    test("returns empty array when no goals exist", async () => {
      const goals = await readingGoalRepository.findByUserId(null);
      expect(goals).toEqual([]);
    });
  });

  describe("update()", () => {
    test("updates goal successfully", async () => {
      const created = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const updated = await readingGoalRepository.update(created.id, {
        booksGoal: 50,
      });

      expect(updated).toBeDefined();
      expect(updated?.booksGoal).toBe(50);
      expect(updated?.year).toBe(2026); // Unchanged
    });

    test("returns undefined for non-existent goal", async () => {
      const updated = await readingGoalRepository.update(99999, {
        booksGoal: 50,
      });

      expect(updated).toBeUndefined();
    });
  });

  describe("delete()", () => {
    test("deletes goal successfully", async () => {
      const created = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const deleted = await readingGoalRepository.delete(created.id);
      expect(deleted).toBe(true);

      const found = await readingGoalRepository.findById(created.id);
      expect(found).toBeUndefined();
    });

    test("returns false for non-existent goal", async () => {
      const deleted = await readingGoalRepository.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe("getBooksCompletedInYear()", () => {
    test("returns zero when no books completed", async () => {
      const count = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      expect(count).toBe(0);
    });

    // Note: Testing with actual book data would require setting up books and sessions
    // This would be done in integration tests
  });

  describe("getYearsWithCompletedBooks()", () => {
    test("returns empty array when no books completed", async () => {
      const years = await readingGoalRepository.getYearsWithCompletedBooks(null);
      expect(years).toEqual([]);
    });

    // Note: Testing with actual book data would require setting up books and sessions
    // This would be done in integration tests
  });
});
