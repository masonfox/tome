import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { GET, POST } from "@/app/api/reading-goals/route";
import { readingGoalRepository, bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest, createTestBook } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Reading Goals API Tests - /api/reading-goals
 * 
 * Tests the main reading goals endpoint for:
 * - GET: Retrieving all goals or a specific year's goal
 * - POST: Creating new reading goals
 * 
 * Coverage:
 * - Success cases (200, 201)
 * - Error cases (400, 404, 500)
 * - Input validation
 * - Business logic validation
 * 
 * Note: revalidatePath is mocked to avoid Next.js cache dependencies in tests
 */

// Mock Next.js cache revalidation
mock.module("next/cache", () => ({ revalidatePath: () => {} }));

describe("Reading Goals API - GET /api/reading-goals", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("GET - Get all goals", () => {
    test("returns 200 and empty array when no goals exist", async () => {
      const request = createMockRequest("GET", "/api/reading-goals");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });

    test("returns all goals for user", async () => {
      // Create test goals for different years
      await readingGoalRepository.create({ userId: null, year: 2023, booksGoal: 20 });
      await readingGoalRepository.create({ userId: null, year: 2024, booksGoal: 30 });
      await readingGoalRepository.create({ userId: null, year: 2025, booksGoal: 40 });

      const request = createMockRequest("GET", "/api/reading-goals");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(3);
      // Goals are returned in descending order (newest first)
      expect(data.data[0].year).toBe(2025);
      expect(data.data[0].booksGoal).toBe(40);
      expect(data.data[1].year).toBe(2024);
      expect(data.data[1].booksGoal).toBe(30);
      expect(data.data[2].year).toBe(2023);
      expect(data.data[2].booksGoal).toBe(20);
    });
  });

  describe("GET - Get specific year goal", () => {
    test("returns 200 and goal data with progress for valid year", async () => {
      // Create goal for 2024
      await readingGoalRepository.create({ userId: null, year: 2024, booksGoal: 25 });

      // Create some completed books in 2024
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        path: "Book1",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2024-01-15"),
        completedDate: new Date("2024-01-20"),
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("goal");
      expect(data.data).toHaveProperty("progress");
      expect(data.data.goal.year).toBe(2024);
      expect(data.data.goal.booksGoal).toBe(25);
      expect(data.data.progress).toHaveProperty("booksCompleted");
      expect(data.data.progress).toHaveProperty("booksRemaining");
      expect(data.data.progress).toHaveProperty("completionPercentage");
      expect(data.data.progress).toHaveProperty("paceStatus");
    });

    test("returns 404 when goal not found for year", async () => {
      const request = createMockRequest("GET", "/api/reading-goals?year=2023");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toContain("No goal found for year 2023");
    });

    test("returns 400 for invalid year parameter", async () => {
      const request = createMockRequest("GET", "/api/reading-goals?year=invalid");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("Year must be a valid number");
    });

    test("returns 400 for non-numeric year parameter", async () => {
      const request = createMockRequest("GET", "/api/reading-goals?year=abc");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
    });

    test("returns 200 with all goals for empty year parameter", async () => {
      // Empty year parameter should be treated as "get all goals"
      await readingGoalRepository.create({ userId: null, year: 2024, booksGoal: 25 });
      
      const request = createMockRequest("GET", "/api/reading-goals?year=");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });
  });

  describe("GET - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock the service to throw an error
      const originalGetAllGoals = readingGoalRepository.findByUserId;
      readingGoalRepository.findByUserId = mock(() => {
        throw new Error("Database connection failed");
      });

      const request = createMockRequest("GET", "/api/reading-goals");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error).toHaveProperty("errorId");

      // Restore original function
      readingGoalRepository.findByUserId = originalGetAllGoals;
    });
  });
});

describe("Reading Goals API - POST /api/reading-goals", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("POST - Create new goal", () => {
    test("returns 201 and creates goal with valid data", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 50,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("id");
      expect(data.data.year).toBe(2025);
      expect(data.data.booksGoal).toBe(50);

      // Verify goal was actually created in database
      const goals = await readingGoalRepository.findByUserId(null);
      expect(goals).toHaveLength(1);
      expect(goals[0].year).toBe(2025);
      expect(goals[0].booksGoal).toBe(50);
    });

    test("creates goal with minimum valid booksGoal", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 1,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.booksGoal).toBe(1);
    });

    test("creates goal with large booksGoal value", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 365,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.booksGoal).toBe(365);
    });
  });

  describe("POST - Validation errors", () => {
    test("returns 400 when year is missing", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        booksGoal: 50,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_FIELD");
      expect(data.error.message).toContain("year and booksGoal are required");
    });

    test("returns 400 when booksGoal is missing", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_FIELD");
      expect(data.error.message).toContain("year and booksGoal are required");
    });

    test("returns 400 when both fields are missing", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {});
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_FIELD");
    });

    test("returns 400 when year is not a number", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: "2025",
        booksGoal: 50,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
      expect(data.error.message).toContain("year and booksGoal must be numbers");
    });

    test("returns 400 when booksGoal is not a number", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: "50",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
      expect(data.error.message).toContain("year and booksGoal must be numbers");
    });

    test("returns 400 when both fields have wrong types", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: "2025",
        booksGoal: "50",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
    });
  });

  describe("POST - Business logic validation", () => {
    test("returns 400 when goal already exists for year", async () => {
      // Create existing goal
      await readingGoalRepository.create({ userId: null, year: 2025, booksGoal: 30 });

      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 50,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("GOAL_EXISTS");
      expect(data.error.message).toContain("already have a goal");
    });

    test("returns 400 for booksGoal less than 1", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 0,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
      expect(data.error.message).toMatch(/must be|between/);
    });

    test("returns 400 for negative booksGoal", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: -5,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
    });

    test("returns 400 for excessively large booksGoal", async () => {
      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 10000,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
    });

    test("allows creating goals for different years", async () => {
      // Create goal for 2024
      const request1 = createMockRequest("POST", "/api/reading-goals", {
        year: 2024,
        booksGoal: 30,
      });
      const response1 = await POST(request1 as NextRequest);
      expect(response1.status).toBe(201);

      // Create goal for 2025 (should succeed)
      const request2 = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 50,
      });
      const response2 = await POST(request2 as NextRequest);
      expect(response2.status).toBe(201);

      const goals = await readingGoalRepository.findByUserId(null);
      expect(goals).toHaveLength(2);
    });
  });

  describe("POST - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock the repository to throw an unexpected error
      const originalCreate = readingGoalRepository.create;
      readingGoalRepository.create = mock(() => {
        throw new Error("Database connection failed");
      });

      const request = createMockRequest("POST", "/api/reading-goals", {
        year: 2025,
        booksGoal: 50,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error).toHaveProperty("errorId");

      // Restore original function
      readingGoalRepository.create = originalCreate;
    });

    test("handles malformed JSON body", async () => {
      const request = new Request("http://localhost/api/reading-goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ invalid json",
      }) as NextRequest;

      // Add nextUrl property
      (request as any).nextUrl = new URL("http://localhost/api/reading-goals");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
