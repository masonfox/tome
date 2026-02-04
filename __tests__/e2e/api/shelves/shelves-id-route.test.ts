import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../../helpers/db-setup";
import { bookRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { GET, PATCH, DELETE } from "@/app/api/shelves/[id]/route";
import { createMockRequest } from "../../../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

/**
 * API Route Tests: /api/shelves/[id]
 * 
 * Tests for GET, PATCH, and DELETE endpoints for individual shelves.
 * 
 * Coverage:
 * - GET: Retrieve shelf by ID (with and without books)
 * - GET: Query parameters (withBooks, orderBy, direction)
 * - GET: Error cases (invalid ID, not found)
 * - PATCH: Update shelf fields (name, description, color, icon)
 * - PATCH: Validation (duplicate names, empty names, length limits)
 * - PATCH: Error cases (invalid ID, not found, no fields)
 * - DELETE: Remove shelf
 * - DELETE: Error cases (invalid ID, not found)
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe('GET /api/shelves/[id]', () => {
  test('should return shelf by ID without books', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      description: "A test shelf",
      color: "#ff0000",
      icon: "📚",
      userId: null,
    });

    const request = createMockRequest("GET", `/api/shelves/${shelf.id}`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(shelf.id);
    expect(result.data.name).toBe("My Shelf");
    expect(result.data.description).toBe("A test shelf");
    expect(result.data.color).toBe("#ff0000");
    expect(result.data.icon).toBe("📚");
    expect(result.data.books).toBeUndefined();
  });

  test('should return shelf with books when withBooks=true', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const book1 = await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: [],
      path: "/path/1",
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "/path/2",
    });

    await shelfRepository.addBookToShelf(shelf.id, book1!.id);
    await shelfRepository.addBookToShelf(shelf.id, book2!.id);

    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(shelf.id);
    expect(result.data.books).toBeDefined();
    expect(result.data.books).toHaveLength(2);
  });

  test('should support orderBy and direction query parameters', async () => {
    const shelf = await shelfRepository.create({
      name: "Sorted Shelf",
      userId: null,
    });

    const bookZ = await bookRepository.create({
      calibreId: 1,
      title: "Zebra Book",
      authors: ["Author Z"],
      tags: [],
      path: "/path/1",
    });

    const bookA = await bookRepository.create({
      calibreId: 2,
      title: "Alpha Book",
      authors: ["Author A"],
      tags: [],
      path: "/path/2",
    });

    await shelfRepository.addBookToShelf(shelf.id, bookZ!.id);
    await shelfRepository.addBookToShelf(shelf.id, bookA!.id);

    // Test title ascending
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true&orderBy=title&direction=asc`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.books).toHaveLength(2);
    expect(result.data.books[0].title).toBe("Alpha Book");
    expect(result.data.books[1].title).toBe("Zebra Book");
  });

  test('should return 400 for invalid shelf ID', async () => {
    const request = createMockRequest("GET", `/api/shelves/invalid`) as NextRequest;
    const params = Promise.resolve({ id: "invalid" });
    const response = await GET(request, { params });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("INVALID_ID");
    expect(result.error.message).toContain("valid number");
  });

  test('should return 404 for non-existent shelf', async () => {
    const request = createMockRequest("GET", `/api/shelves/999`) as NextRequest;
    const params = Promise.resolve({ id: "999" });
    const response = await GET(request, { params });
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("not found");
  });

  test('should return 404 for non-existent shelf with withBooks=true', async () => {
    const request = createMockRequest("GET", `/api/shelves/999?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: "999" });
    const response = await GET(request, { params });
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe('PATCH /api/shelves/[id]', () => {
  test('should update shelf name', async () => {
    const shelf = await shelfRepository.create({
      name: "Old Name",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      name: "New Name",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(shelf.id);
    expect(result.data.name).toBe("New Name");
  });

  test('should update multiple fields at once', async () => {
    const shelf = await shelfRepository.create({
      name: "Original",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      name: "Updated Name",
      description: "Updated description",
      color: "#00ff00",
      icon: "⭐",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("Updated Name");
    expect(result.data.description).toBe("Updated description");
    expect(result.data.color).toBe("#00ff00");
    expect(result.data.icon).toBe("⭐");
  });

  test('should update description without changing name', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      description: "Old description",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      description: "New description",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.name).toBe("My Shelf");
    expect(result.data.description).toBe("New description");
  });

  test('should return 400 for invalid shelf ID', async () => {
    const request = createMockRequest("PATCH", `/api/shelves/invalid`, {
      name: "New Name",
    }) as NextRequest;
    const params = Promise.resolve({ id: "invalid" });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("INVALID_ID");
  });

  test('should return 400 when no fields provided', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {}) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.message).toContain("No valid fields");
  });

  test('should return 404 for non-existent shelf', async () => {
    const request = createMockRequest("PATCH", `/api/shelves/999`, {
      name: "New Name",
    }) as NextRequest;
    const params = Promise.resolve({ id: "999" });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  test('should return 400 for empty name', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      name: "",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.message).toContain("cannot be empty");
  });

  test('should return 400 for whitespace-only name', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      name: "   ",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  test('should return 409 for duplicate name', async () => {
    await shelfRepository.create({
      name: "Existing Shelf",
      userId: null,
    });

    const shelf2 = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf2.id}`, {
      name: "Existing Shelf",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf2.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("DUPLICATE_NAME");
    expect(result.error.message).toContain("already exists");
  });

  test('should return 409 for duplicate name (case-insensitive)', async () => {
    await shelfRepository.create({
      name: "Existing Shelf",
      userId: null,
    });

    const shelf2 = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf2.id}`, {
      name: "existing shelf",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf2.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("DUPLICATE_NAME");
  });

  test('should allow updating shelf with its own name', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      description: "Old description",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      name: "My Shelf",
      description: "New description",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("My Shelf");
    expect(result.data.description).toBe("New description");
  });

  test('should trim whitespace from name', async () => {
    const shelf = await shelfRepository.create({
      name: "My Shelf",
      userId: null,
    });

    const request = createMockRequest("PATCH", `/api/shelves/${shelf.id}`, {
      name: "  Trimmed Name  ",
    }) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await PATCH(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.name).toBe("Trimmed Name");
  });
});

describe('DELETE /api/shelves/[id]', () => {
  test('should delete empty shelf', async () => {
    const shelf = await shelfRepository.create({
      name: "Shelf to Delete",
      userId: null,
    });

    const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await DELETE(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.deleted).toBe(true);

    // Verify shelf is deleted
    const found = await shelfRepository.findById(shelf.id);
    expect(found).toBeUndefined();
  });

  test('should delete shelf with books (cascade)', async () => {
    const shelf = await shelfRepository.create({
      name: "Shelf with Books",
      userId: null,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author"],
      tags: [],
      path: "/path/1",
    });

    await shelfRepository.addBookToShelf(shelf.id, book!.id);

    const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await DELETE(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.deleted).toBe(true);

    // Verify shelf is deleted
    const shelfFound = await shelfRepository.findById(shelf.id);
    expect(shelfFound).toBeUndefined();

    // Verify book still exists
    const bookFound = await bookRepository.findById(book!.id);
    expect(bookFound).not.toBeUndefined();
  });

  test('should return 400 for invalid shelf ID', async () => {
    const request = createMockRequest("DELETE", `/api/shelves/invalid`) as NextRequest;
    const params = Promise.resolve({ id: "invalid" });
    const response = await DELETE(request, { params });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("INVALID_ID");
  });

  test('should return 404 for non-existent shelf', async () => {
    const request = createMockRequest("DELETE", `/api/shelves/999`) as NextRequest;
    const params = Promise.resolve({ id: "999" });
    const response = await DELETE(request, { params });
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
