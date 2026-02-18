/**
 * API Tests: POST /api/sessions/read-next/[id]/move-to-top
 * 
 * Tests the move to top endpoint for read-next sessions
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { POST } from "@/app/api/sessions/read-next/[id]/move-to-top/route";
import { sessionRepository, bookRepository } from "@/lib/repositories";
import type { NextRequest } from "next/server";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("POST /api/sessions/read-next/[id]/move-to-top", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  test("should move session to top and return 200", async () => {
    // Create books and sessions
    const books = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        bookRepository.create({
          title: `Book ${i + 1}`,
          calibreId: i + 1,
          path: `/test/book${i + 1}.epub`,
        })
      )
    );

    const sessions = await Promise.all(
      books.map((book, i) =>
        sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read-next",
          isActive: false,
          readNextOrder: i,
        })
      )
    );

    // Move session at position 2 to top
    const request = new Request(`http://localhost/api/sessions/read-next/${sessions[2].id}/move-to-top`, {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: sessions[2].id.toString() }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify new order
    const updated = await Promise.all(
      sessions.map((s) => sessionRepository.findById(s.id))
    );

    expect(updated[2]?.readNextOrder).toBe(0); // Moved to top
    expect(updated[0]?.readNextOrder).toBe(1); // Shifted down
    expect(updated[1]?.readNextOrder).toBe(2); // Shifted down
  });

  test("should handle moving already top item (no-op)", async () => {
    const book1 = await bookRepository.create({
      title: "Book 1",
      calibreId: 1,
    });
    const book2 = await bookRepository.create({
      title: "Book 2",
      calibreId: 2,
    });

    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "read-next",
      isActive: false,
      readNextOrder: 0,
    });
    await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "read-next",
      isActive: false,
      readNextOrder: 1,
    });

    const request = new Request(`http://localhost/api/sessions/read-next/${session1.id}/move-to-top`, {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: session1.id.toString() }) });

    expect(response.status).toBe(200);

    // Verify positions unchanged
    const updated1 = await sessionRepository.findById(session1.id);
    expect(updated1?.readNextOrder).toBe(0);
  });

  test("should return 400 for invalid session ID format", async () => {
    const request = new Request("http://localhost/api/sessions/read-next/invalid/move-to-top", {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: "invalid" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toBe("Session ID must be a valid number");
  });

  test("should return 404 for non-existent session", async () => {
    const request = new Request("http://localhost/api/sessions/read-next/99999/move-to-top", {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: "99999" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toContain("not found");
  });

  test("should return 400 for non-read-next session", async () => {
    const book = await bookRepository.create({
      title: "Reading Book",
      calibreId: 1,
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const request = new Request(`http://localhost/api/sessions/read-next/${session.id}/move-to-top`, {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: session.id.toString() }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toContain("not in read-next status");
  });

  test("should return 404 for repository errors", async () => {
    const book = await bookRepository.create({
      title: "Book 1",
      calibreId: 1,
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read-next",
      isActive: false,
      readNextOrder: 0,
    });

    // Mock a repository error by using a session that will be deleted
    await sessionRepository.delete(session.id);

    const request = new Request(`http://localhost/api/sessions/read-next/${session.id}/move-to-top`, {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: session.id.toString() }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toBeDefined();
  });

  test("should work with single read-next item", async () => {
    const book = await bookRepository.create({
      title: "Only Book",
      calibreId: 1,
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read-next",
      isActive: false,
      readNextOrder: 0,
    });

    const request = new Request(`http://localhost/api/sessions/read-next/${session.id}/move-to-top`, {
      method: "POST",
    });

    const response = await POST(request as NextRequest, { params: Promise.resolve({ id: session.id.toString() }) });

    expect(response.status).toBe(200);

    const updated = await sessionRepository.findById(session.id);
    expect(updated?.readNextOrder).toBe(0);
  });
});
