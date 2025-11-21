import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import {
  bookRepository,
  sessionRepository,
  progressRepository,
  streakRepository,
} from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("Aggregation Query Tests", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("Total Pages Read", () => {
    test("should correctly sum all pages read", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Add multiple progress logs
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: new Date(),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: new Date(),
      });

      const total = await progressRepository.getTotalPagesRead();
      expect(total).toBe(100);
    });

    test("should return 0 for empty database", async () => {
      const total = await progressRepository.getTotalPagesRead();
      expect(total).toBe(0);
    });
  });

  describe("Pages Read After Date", () => {
    test("should filter by date correctly", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Progress from 2 days ago
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: twoDaysAgo,
      });

      // Progress from today
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: new Date(),
      });

      const totalSinceYesterday = await progressRepository.getPagesReadAfterDate(yesterday);
      expect(totalSinceYesterday).toBe(50); // Only today's progress
    });
  });

  describe("Books Read Count", () => {
    test("should count completed sessions", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        path: "/path2",
      });

      // Completed sessions
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      // Active session (shouldn't be counted)
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
      });

      const count = await sessionRepository.countByStatus("read", false);
      expect(count).toBe(2);
    });

    test("should count books read after date", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Completed 2 days ago
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: twoDaysAgo,
      });

      // Completed today
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      const countSinceYesterday = await sessionRepository.countCompletedAfterDate(yesterday);
      expect(countSinceYesterday).toBe(1);
    });
  });

  describe("Currently Reading Count", () => {
    test("should only count active reading sessions", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        path: "/path2",
      });

      // Active reading sessions
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Inactive reading session (shouldn't count)
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 2,
        status: "reading",
        isActive: false,
      });

      const count = await sessionRepository.countByStatus("reading", true);
      expect(count).toBe(2);
    });
  });

  describe("Average Pages Per Day", () => {
    test("should calculate average correctly", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Day 1: 50 pages
      const day1 = new Date();
      day1.setDate(day1.getDate() - 2);
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: day1,
      });

      // Day 2: 100 pages
      const day2 = new Date();
      day2.setDate(day2.getDate() - 1);
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 150,
        currentPercentage: 75,
        pagesRead: 100,
        progressDate: day2,
      });

      const avg = await progressRepository.getAveragePagesPerDay(30);
      expect(avg).toBe(75); // (50 + 100) / 2 = 75
    });

    test("should return 0 for no progress", async () => {
      const avg = await progressRepository.getAveragePagesPerDay(30);
      expect(avg).toBe(0);
    });
  });

  describe("Activity Calendar", () => {
    test("should group progress by day", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Multiple progress entries on same day should be summed
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: today,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: today,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 75,
        currentPercentage: 75,
        pagesRead: 75,
        progressDate: yesterday,
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const calendar = await progressRepository.getActivityCalendar(sevenDaysAgo, today);

      expect(calendar.length).toBe(2); // 2 unique days
      expect(calendar.find((day) => day.date.includes(today.toISOString().split("T")[0]))?.pagesRead).toBe(100);
      expect(calendar.find((day) => day.date.includes(yesterday.toISOString().split("T")[0]))?.pagesRead).toBe(75);
    });
  });
});
