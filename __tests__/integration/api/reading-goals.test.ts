import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { readingGoalRepository, bookRepository, sessionRepository } from "@/lib/repositories";
import { GET as GET_GOALS, POST as CREATE_GOAL } from "@/app/api/reading-goals/route";
import { PATCH as UPDATE_GOAL, DELETE as DELETE_GOAL } from "@/app/api/reading-goals/[id]/route";
import { GET as GET_MONTHLY } from "@/app/api/reading-goals/monthly/route";
import { createMockRequest } from "../../fixtures/test-data";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

// Mock Next.js cache revalidation - required for integration tests
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("Integration: Reading Goals API", () => {
  describe("Goal Creation Flow", () => {
    test("should create a new goal for current year", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: currentYear,
        booksGoal: 50,
      }) as any;
      
      const response = await CREATE_GOAL(request);
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(currentYear);
      expect(data.data.booksGoal).toBe(50);
    });

    test("should reject duplicate goal for same year", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create first goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Try to create duplicate
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: currentYear,
        booksGoal: 40,
      }) as any;
      
      const response = await CREATE_GOAL(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain("already have a goal");
    });

    test("should validate goal is positive number", async () => {
      const currentYear = new Date().getFullYear();
      
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: currentYear,
        booksGoal: -5,
      }) as any;
      
      const response = await CREATE_GOAL(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe("Goal Update Flow", () => {
    test("should update existing goal", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Update goal
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 60,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.booksGoal).toBe(60);
      expect(data.data.year).toBe(currentYear); // Year should not change
    });

    test("should return 404 for non-existent goal", async () => {
      const request = createMockRequest("PATCH", "/api/reading-goals/99999", {
        booksGoal: 60,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: "99999" }) });
      expect(response.status).toBe(404);
    });

    test("should validate updated goal is positive", async () => {
      const currentYear = new Date().getFullYear();
      
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 0,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
    });
  });

  describe("Goal Deletion Flow", () => {
    test("should delete existing goal", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Delete goal
      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`) as any;
      const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // Verify deletion
      const deletedGoal = await readingGoalRepository.findById(goal.id);
      expect(deletedGoal).toBeUndefined();
    });

    test("should return 404 for non-existent goal", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/99999") as any;
      const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: "99999" }) });
      expect(response.status).toBe(404);
    });
  });

  describe("Goal Retrieval with Progress", () => {
    test("should get goal with zero progress", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Get goal
      const request = createMockRequest("GET", `/api/reading-goals?year=${currentYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.goal.year).toBe(currentYear);
      expect(data.data.progress.booksCompleted).toBe(0);
      expect(data.data.progress.booksRemaining).toBe(50);
      expect(data.data.progress.completionPercentage).toBe(0);
    });

    test("should calculate progress with completed books", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Create books completed this year
      const completedDate = new Date();
      for (let i = 0; i < 15; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        // Create completed session
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(),
          completedDate,
          isActive: false,
        });
      }
      
      // Get goal with progress
      const request = createMockRequest("GET", `/api/reading-goals?year=${currentYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.progress.booksCompleted).toBe(15);
      expect(data.data.progress.booksRemaining).toBe(35);
      expect(data.data.progress.completionPercentage).toBe(30);
    });

    test("should handle goal exceeded (>100%)", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 10,
      });
      
      // Create 15 completed books (exceeds goal of 10)
      const completedDate = new Date();
      for (let i = 0; i < 15; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(),
          completedDate,
          isActive: false,
        });
      }
      
      // Get goal with progress
      const request = createMockRequest("GET", `/api/reading-goals?year=${currentYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.progress.booksCompleted).toBe(15);
      expect(data.data.progress.booksRemaining).toBe(0); // Should be 0, not negative
      expect(data.data.progress.completionPercentage).toBe(100); // Capped at 100
    });

    test("should return 404 when no goal exists for year", async () => {
      const futureYear = new Date().getFullYear() + 2;
      
      const request = createMockRequest("GET", `/api/reading-goals?year=${futureYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe("Monthly Breakdown", () => {
    test("should return all 12 months with zero counts when no books completed", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Get monthly data
      const request = createMockRequest("GET", `/api/reading-goals/monthly?year=${currentYear}`) as any;
      const response = await GET_MONTHLY(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.monthlyData).toHaveLength(12);
      expect(data.data.monthlyData.every((m: any) => m.count === 0)).toBe(true);
    });

    test("should aggregate books by completion month", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Create books completed in different months
      // 3 books in January
      for (let i = 0; i < 3; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(currentYear, 0, 1),
          completedDate: new Date(currentYear, 0, 15), // January
          isActive: false,
        });
      }
      
      // 5 books in June
      for (let i = 3; i < 8; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(currentYear, 5, 1),
          completedDate: new Date(currentYear, 5, 15), // June
          isActive: false,
        });
      }
      
      // Get monthly data
      const request = createMockRequest("GET", `/api/reading-goals/monthly?year=${currentYear}`) as any;
      const response = await GET_MONTHLY(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.monthlyData).toHaveLength(12);
      
      // Check January (month 1)
      const january = data.data.monthlyData.find((m: any) => m.month === 1);
      expect(january.count).toBe(3);
      
      // Check June (month 6)
      const june = data.data.monthlyData.find((m: any) => m.month === 6);
      expect(june.count).toBe(5);
      
      // Check other months are zero
      const otherMonths = data.data.monthlyData.filter((m: any) => m.month !== 1 && m.month !== 6);
      expect(otherMonths.every((m: any) => m.count === 0)).toBe(true);
    });

    test("should work without a goal (shows data even if no goal set)", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create books completed this year (without creating a goal)
      for (let i = 0; i < 3; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(currentYear, 0, 1),
          completedDate: new Date(currentYear, 0, 15), // January
          isActive: false,
        });
      }
      
      // Get monthly data
      const request = createMockRequest("GET", `/api/reading-goals/monthly?year=${currentYear}`) as any;
      const response = await GET_MONTHLY(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.goal).toBeNull();
      expect(data.data.monthlyData).toHaveLength(12);
      
      const january = data.data.monthlyData.find((m: any) => m.month === 1);
      expect(january.count).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    test("should handle mid-year goal creation with existing completed books", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create books completed BEFORE goal was created
      const januaryDate = new Date(currentYear, 0, 15);
      for (let i = 0; i < 5; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(currentYear, 0, 1),
          completedDate: januaryDate,
          isActive: false,
        });
      }
      
      // Create goal in June (mid-year)
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Get goal - should count all books completed this year
      const request = createMockRequest("GET", `/api/reading-goals?year=${currentYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.progress.booksCompleted).toBe(5);
    });

    test("should handle multiple sessions for same book (re-reads)", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create goal
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 20,
      });
      
      // Create book with 2 completed sessions (read twice this year)
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Test Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      // First read in January
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date(currentYear, 0, 1),
        completedDate: new Date(currentYear, 0, 15),
        isActive: false,
      });
      
      // Second read (re-read) in June
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        startedDate: new Date(currentYear, 5, 1),
        completedDate: new Date(currentYear, 5, 15),
        isActive: false,
      });
      
      // Get goal - should count both sessions as separate completions
      const request = createMockRequest("GET", `/api/reading-goals?year=${currentYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.progress.booksCompleted).toBe(2); // Both sessions counted
    });

    test("should not count books completed in different years", async () => {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      // Create goal for current year
      await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Create books completed LAST YEAR
      for (let i = 0; i < 10; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Test Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(lastYear, 0, 1),
          completedDate: new Date(lastYear, 11, 31), // Last year
          isActive: false,
        });
      }
      
      // Get goal - should have zero progress
      const request = createMockRequest("GET", `/api/reading-goals?year=${currentYear}`) as any;
      const response = await GET_GOALS(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.progress.booksCompleted).toBe(0);
    });
  });
});
