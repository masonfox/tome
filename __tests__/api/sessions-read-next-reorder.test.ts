/**
 * Tests for PUT /api/sessions/read-next/reorder
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PUT } from "@/app/api/sessions/read-next/reorder/route";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import {
  setupTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("PUT /api/sessions/read-next/reorder", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  it("should reorder books successfully", async () => {
    // Create books
    const book1 = await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      path: "book1.epub",
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      path: "book2.epub",
    });

    // Create sessions
    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 0,
    });

    const session2 = await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 1,
    });

    // Swap order
    const request = new Request("http://localhost:3000/api/sessions/read-next/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          { id: session1.id, readNextOrder: 1 },
          { id: session2.id, readNextOrder: 0 },
        ],
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Verify order changed
    const updated1 = await sessionRepository.findById(session1.id);
    const updated2 = await sessionRepository.findById(session2.id);

    expect(updated1?.readNextOrder).toBe(1);
    expect(updated2?.readNextOrder).toBe(0);
  });

  it("should return 400 for invalid request body", async () => {
    const request = new Request("http://localhost:3000/api/sessions/read-next/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: "invalid", // Should be array
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
    expect(data.details).toBeDefined();
  });

  it("should return 400 for missing id field", async () => {
    const request = new Request("http://localhost:3000/api/sessions/read-next/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          { readNextOrder: 0 }, // Missing id
        ],
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
  });

  it("should return 400 for negative readNextOrder", async () => {
    const request = new Request("http://localhost:3000/api/sessions/read-next/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          { id: 1, readNextOrder: -5 }, // Negative not allowed
        ],
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
  });

  it("should handle empty updates array", async () => {
    const request = new Request("http://localhost:3000/api/sessions/read-next/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [],
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it("should update multiple books in a transaction", async () => {
    // Create three books
    const book1 = await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      path: "book1.epub",
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      path: "book2.epub",
    });

    const book3 = await bookRepository.create({
      calibreId: 3,
      title: "Book 3",
      path: "book3.epub",
    });

    // Create sessions
    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 0,
    });

    const session2 = await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 1,
    });

    const session3 = await sessionRepository.create({
      bookId: book3.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 2,
    });

    // Reverse order
    const request = new Request("http://localhost:3000/api/sessions/read-next/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          { id: session1.id, readNextOrder: 2 },
          { id: session2.id, readNextOrder: 1 },
          { id: session3.id, readNextOrder: 0 },
        ],
      }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    // Verify all updated
    const updated1 = await sessionRepository.findById(session1.id);
    const updated2 = await sessionRepository.findById(session2.id);
    const updated3 = await sessionRepository.findById(session3.id);

    expect(updated1?.readNextOrder).toBe(2);
    expect(updated2?.readNextOrder).toBe(1);
    expect(updated3?.readNextOrder).toBe(0);
  });
});
