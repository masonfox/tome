import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { PATCH, DELETE } from "@/app/api/reading-goals/[id]/route";
import { readingGoalRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Reading Goals [ID] API Tests - /api/reading-goals/[id]
 * 
 * Tests the individual goal endpoint for:
 * - PATCH: Updating an existing reading goal
 * - DELETE: Deleting a reading goal
 * 
 * Coverage:
 * - Success cases (200)
 * - Error cases (400, 404, 500)
 * - Input validation (ID and booksGoal)
 * - Business logic (past year protection)
 * 
 * Note: revalidatePath is mocked to avoid Next.js cache dependencies in tests
 */

// Mock Next.js cache revalidation
mock.module("next/cache", () => ({ revalidatePath: () => {} }));

describe("Reading Goals [ID] API - PATCH /api/reading-goals/[id]", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("PATCH - Success cases", () => {
    test("returns 200 and updates goal with valid data", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(goal.id);
      expect(data.data.booksGoal).toBe(50);

      // Verify in database
      const updated = await readingGoalRepository.findById(goal.id);
      expect(updated?.booksGoal).toBe(50);
    });

    test("allows updating to minimum value (1)", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 1,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.booksGoal).toBe(1);
    });

    test("allows updating to large value", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 500,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.booksGoal).toBe(500);
    });

    test("allows updating future year goal", async () => {
      const futureYear = new Date().getFullYear() + 1;
      const goal = await readingGoalRepository.create({ userId: null, year: futureYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 40,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("PATCH - Validation errors", () => {
    test("returns 400 for invalid goal ID (non-numeric)", async () => {
      const request = createMockRequest("PATCH", "/api/reading-goals/invalid", {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: "invalid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_ID");
      expect(data.error.message).toContain("positive integer");
    });

    test("returns 400 for negative goal ID", async () => {
      const request = createMockRequest("PATCH", "/api/reading-goals/-1", {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: "-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_ID");
    });

    test("returns 400 for zero goal ID", async () => {
      const request = createMockRequest("PATCH", "/api/reading-goals/0", {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: "0" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_ID");
    });

    test("returns 400 when booksGoal is missing", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {});
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("MISSING_FIELD");
      expect(data.error.message).toContain("booksGoal is required");
    });

    test("returns 400 when booksGoal is not a number", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: "50",
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_TYPE");
      expect(data.error.message).toContain("booksGoal must be a number");
    });

    test("returns 400 for booksGoal less than 1", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 0,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_INPUT");
    });

    test("returns 400 for negative booksGoal", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: -10,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_INPUT");
    });

    test("returns 400 for excessively large booksGoal", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 10000,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_INPUT");
    });
  });

  describe("PATCH - Business logic errors", () => {
    test("returns 404 when goal not found", async () => {
      const request = createMockRequest("PATCH", "/api/reading-goals/999", {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: "999" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toContain("not found");
    });

    test("returns 400 when trying to update past year goal", async () => {
      const pastYear = new Date().getFullYear() - 1;
      const goal = await readingGoalRepository.create({ userId: null, year: pastYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("PAST_YEAR_READONLY");
      expect(data.error.message).toContain("past years");
    });
  });

  describe("PATCH - Error handling", () => {
    test("returns 500 on internal error", async () => {
      const originalUpdate = readingGoalRepository.update;
      readingGoalRepository.update = mock(() => {
        throw new Error("Database connection failed");
      });

      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("PATCH", `/api/reading-goals/${goal.id}`, {
        booksGoal: 50,
      });
      const response = await PATCH(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error).toHaveProperty("errorId");

      // Restore
      readingGoalRepository.update = originalUpdate;
    });
  });
});

describe("Reading Goals [ID] API - DELETE /api/reading-goals/[id]", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("DELETE - Success cases", () => {
    test("returns 200 and deletes goal", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`);
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify deletion in database
      const deleted = await readingGoalRepository.findById(goal.id);
      expect(deleted).toBeUndefined();
    });

    test("allows deleting future year goal", async () => {
      const futureYear = new Date().getFullYear() + 1;
      const goal = await readingGoalRepository.create({ userId: null, year: futureYear, booksGoal: 30 });

      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`);
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });

      expect(response.status).toBe(200);
      
      // Verify deletion
      const deleted = await readingGoalRepository.findById(goal.id);
      expect(deleted).toBeUndefined();
    });

    test("allows deleting current year goal", async () => {
      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`);
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("DELETE - Validation errors", () => {
    test("returns 400 for invalid goal ID (non-numeric)", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/invalid");
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: "invalid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_ID");
      expect(data.error.message).toContain("positive integer");
    });

    test("returns 400 for negative goal ID", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/-1");
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: "-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_ID");
    });

    test("returns 400 for zero goal ID", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/0");
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: "0" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_ID");
    });
  });

  describe("DELETE - Business logic errors", () => {
    test("returns 404 when goal not found", async () => {
      const request = createMockRequest("DELETE", "/api/reading-goals/999");
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: "999" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toContain("not found");
    });

    test("returns 400 when trying to delete past year goal", async () => {
      const pastYear = new Date().getFullYear() - 1;
      const goal = await readingGoalRepository.create({ userId: null, year: pastYear, booksGoal: 30 });

      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`);
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("PAST_YEAR_READONLY");
      expect(data.error.message).toContain("past years");
    });
  });

  describe("DELETE - Error handling", () => {
    test("returns 500 on internal error", async () => {
      const originalDelete = readingGoalRepository.delete;
      readingGoalRepository.delete = mock(() => {
        throw new Error("Database connection failed");
      });

      const currentYear = new Date().getFullYear();
      const goal = await readingGoalRepository.create({ userId: null, year: currentYear, booksGoal: 30 });

      const request = createMockRequest("DELETE", `/api/reading-goals/${goal.id}`);
      const response = await DELETE(request as NextRequest, {
        params: Promise.resolve({ id: goal.id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error).toHaveProperty("errorId");

      // Restore
      readingGoalRepository.delete = originalDelete;
    });
  });
});
