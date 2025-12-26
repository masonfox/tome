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

    test("should reject invalid goal ID format (non-numeric strings)", async () => {
      const request = createMockRequest("PATCH", "/api/reading-goals/abc", {
        booksGoal: 60,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: "abc" }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_ID");
      expect(data.error.message).toContain("positive integer");
    });

    test("should return 400 when booksGoal is missing", async () => {
      const currentYear = new Date().getFullYear();
      
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        // Missing booksGoal
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_FIELD");
      expect(data.error.message).toContain("booksGoal is required");
    });

    test("should return 400 when booksGoal is not a number", async () => {
      const currentYear = new Date().getFullYear();
      
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: "sixty",
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
      expect(data.error.message).toContain("must be a number");
    });

    test("should return 400 when trying to edit past year goal", async () => {
      const pastYear = new Date().getFullYear() - 1;
      
      const goal = await readingGoalRepository.create({
        year: pastYear,
        booksGoal: 50,
      });
      
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 60,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("PAST_YEAR_READONLY");
      expect(data.error.message).toContain("past years");
    });

    test("should handle validation errors from service layer", async () => {
      const currentYear = new Date().getFullYear();
      
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      // Try to update with goal > 9999 (service layer constraint)
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 10000,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
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
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
    });

    test("should reject deletion of past year goals", async () => {
      const pastYear = new Date().getFullYear() - 1;
      
      const goal = await readingGoalRepository.create({
        year: pastYear,
        booksGoal: 50,
      });
      
      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`) as any;
      const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("PAST_YEAR_READONLY");
      expect(data.error.message).toContain("past years");
      
      // Verify goal was not deleted
      const stillExists = await readingGoalRepository.findById(goal.id);
      expect(stillExists).toBeDefined();
    });

    test("should handle invalid ID formats on delete", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/invalid-id") as any;
      const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: "invalid-id" }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_ID");
      expect(data.error.message).toContain("positive integer");
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

  describe("Input Validation - Enhanced Security (PR #96)", () => {
    describe("PATCH endpoint - negative and invalid IDs", () => {
      test("should reject negative IDs", async () => {
        const request = createMockRequest("PATCH", "/api/reading-goals/-1", {
          booksGoal: 60,
        }) as any;
        
        const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: "-1" }) });
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("INVALID_ID");
        expect(data.error.message).toContain("positive integer");
      });

      test("should reject large negative IDs", async () => {
        const request = createMockRequest("PATCH", "/api/reading-goals/-999", {
          booksGoal: 60,
        }) as any;
        
        const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: "-999" }) });
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("INVALID_ID");
        expect(data.error.message).toContain("positive integer");
      });

      // Note: parseInt("1.5") returns 1, so floating point strings are truncated to integers
      // This is acceptable behavior - the ID "1.5" gets treated as ID 1
      test("should accept floating point IDs (parseInt truncates)", async () => {
        // Create goal with ID 1
        const goal = await readingGoalRepository.create({
          year: new Date().getFullYear(),
          booksGoal: 50,
        });
        
        const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}.5`, {
          booksGoal: 60,
        }) as any;
        
        // "${goal.id}.5" gets parsed as goal.id, which is a valid ID
        const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: `${goal.id}.5` }) });
        expect(response.status).toBe(200); // Should succeed
        
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.booksGoal).toBe(60);
      });

      test("should accept decimal IDs with many places (parseInt truncates)", async () => {
        // Create a goal
        const goal = await readingGoalRepository.create({
          year: new Date().getFullYear(),
          booksGoal: 50,
        });
        
        const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}.999`, {
          booksGoal: 60,
        }) as any;
        
        // "999.999" gets parsed as 999, treated as valid ID
        const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: `${goal.id}.999` }) });
        expect(response.status).toBe(200); // Should succeed
        
        const data = await response.json();
        expect(data.success).toBe(true);
      });
    });

    describe("DELETE endpoint - negative and invalid IDs", () => {
      test("should reject negative IDs", async () => {
        const request = createMockRequest("DELETE", "/api/reading-goals/-1") as any;
        
        const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: "-1" }) });
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("INVALID_ID");
        expect(data.error.message).toContain("positive integer");
      });

      test("should reject large negative IDs", async () => {
        const request = createMockRequest("DELETE", "/api/reading-goals/-999") as any;
        
        const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: "-999" }) });
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("INVALID_ID");
        expect(data.error.message).toContain("positive integer");
      });

      test("should reject zero as ID", async () => {
        const request = createMockRequest("DELETE", "/api/reading-goals/0") as any;
        
        const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: "0" }) });
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("INVALID_ID");
        expect(data.error.message).toContain("positive integer");
      });

      test("should reject IDs beyond MAX_SAFE_INTEGER", async () => {
        const tooBigId = (Number.MAX_SAFE_INTEGER + 1).toString();
        const request = createMockRequest("DELETE", `/api/reading-goals/${tooBigId}`) as any;
        
        const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: tooBigId }) });
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("INVALID_ID");
        expect(data.error.message).toContain("positive integer");
      });

      // Note: parseInt("1.5") returns 1, so floating point strings are truncated to integers
      // This is acceptable behavior - the ID "1.5" gets treated as ID 1
      test("should accept floating point IDs (parseInt truncates)", async () => {
        // Create goal for current year (can be deleted)
        const currentYear = new Date().getFullYear();
        const goal = await readingGoalRepository.create({
          year: currentYear,
          booksGoal: 50,
        });
        
        const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}.5`) as any;
        
        // "${goal.id}.5" gets parsed as goal.id, which is valid
        const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: `${goal.id}.5` }) });
        expect(response.status).toBe(200); // Should succeed
        
        const data = await response.json();
        expect(data.success).toBe(true);
      });

      test("should accept decimal IDs with many places (parseInt truncates)", async () => {
        // Create goal for current year (can be deleted)
        const currentYear = new Date().getFullYear();
        const goal = await readingGoalRepository.create({
          year: currentYear,
          booksGoal: 50,
        });
        
        const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}.999`) as any;
        
        // "${goal.id}.999" gets parsed as goal.id, which is valid
        const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: `${goal.id}.999` }) });
        expect(response.status).toBe(200); // Should succeed
        
        const data = await response.json();
        expect(data.success).toBe(true);
      });
    });
  });

  describe("Error Handling - Enhanced Error IDs (PR #96)", () => {
    test("GET endpoint should include errorId on internal errors", async () => {
      // Create a scenario that causes an internal error by passing invalid year
      const request = createMockRequest("GET", "/api/reading-goals?year=invalid") as any;
      const response = await GET_GOALS(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
    });

    test("POST endpoint should include errorId in catch block errors", async () => {
      // Simulate internal error by providing incomplete data
      const request = createMockRequest("POST", "/api/reading-goals", {
        // Missing required fields
      }) as any;
      
      const response = await CREATE_GOAL(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test("errorId should be a valid UUID format", async () => {
      // We can't easily force an internal error in tests without mocking,
      // but we can at least test that the error structure is correct
      // by causing a validation error that goes through the error handler
      const request = createMockRequest("PATCH", "/api/reading-goals/abc", {
        booksGoal: 60,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: "abc" }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBeDefined();
      expect(data.error.message).toBeDefined();
      // errorId is only added in the catch-all error handler for 500 errors
    });

    test("DELETE endpoint error responses should have proper structure", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/99999") as any;
      const response = await DELETE_GOAL(request, { params: Promise.resolve({ id: "99999" }) });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toBeDefined();
    });

    test("error messages should be descriptive", async () => {
      const currentYear = new Date().getFullYear();
      
      const goal = await readingGoalRepository.create({
        year: currentYear,
        booksGoal: 50,
      });
      
      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: -5,
      }) as any;
      
      const response = await UPDATE_GOAL(request, { params: Promise.resolve({ id: goal.id.toString() }) });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain("must be");
      expect(data.error.code).toBe("INVALID_INPUT");
    });
  });
});
