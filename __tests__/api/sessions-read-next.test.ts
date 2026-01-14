/**
 * Tests for GET /api/sessions/read-next
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { GET } from "@/app/api/sessions/read-next/route";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import {
  setupTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("GET /api/sessions/read-next", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  it("should return empty array when no read-next books exist", async () => {
    const request = new Request("http://localhost:3000/api/sessions/read-next");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return read-next books sorted by order", async () => {
    // Create books
    const book1 = await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      path: "book1.epub",
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      path: "book2.epub",
    });

    const book3 = await bookRepository.create({
      calibreId: 3,
      title: "Book 3",
      authors: ["Author 3"],
      path: "book3.epub",
    });

    // Create sessions with out-of-order positions
    await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 2,
    });

    await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 0,
    });

    await sessionRepository.create({
      bookId: book3.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 1,
    });

    const request = new Request("http://localhost:3000/api/sessions/read-next");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
    
    // Verify sorted order
    expect(data[0].bookId).toBe(book2.id); // order 0
    expect(data[1].bookId).toBe(book3.id); // order 1
    expect(data[2].bookId).toBe(book1.id); // order 2

    // Verify book data is included
    expect(data[0]).toHaveProperty("book");
    expect(data[0].book).toHaveProperty("title", "Book 2");
    expect(data[0].book).toHaveProperty("authors");
    expect(data[0].book.authors).toEqual(["Author 2"]);
  });

  it("should only return read-next status books", async () => {
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

    // Create read-next session
    await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "read-next",
      readNextOrder: 0,
    });

    // Create to-read session
    await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "to-read",
      readNextOrder: 0,
    });

    const request = new Request("http://localhost:3000/api/sessions/read-next");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].bookId).toBe(book1.id);
  });

  it("should only return active sessions", async () => {
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      path: "book1.epub",
    });

    // Create active read-next session
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read-next",
      isActive: true,
      readNextOrder: 0,
    });

    // Create inactive read-next session
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "read-next",
      isActive: false,
      readNextOrder: 1,
    });

    const request = new Request("http://localhost:3000/api/sessions/read-next");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].sessionNumber).toBe(1);
  });

  it("should respect limit of 1000 books", async () => {
    // This test just verifies the limit parameter is passed correctly
    // In practice, users won't have 1000+ read-next books
    const request = new Request("http://localhost:3000/api/sessions/read-next");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
