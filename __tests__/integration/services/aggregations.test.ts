import { toProgressDate, toSessionDate } from '../../test-utils';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  bookRepository,
  sessionRepository,
  progressRepository,
} from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { toDateString } from "@/utils/dateHelpers.server";

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
        progressDate: toProgressDate(new Date()),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: toProgressDate(new Date()),
      });

      const total = await progressRepository.getTotalPagesRead();
      expect(total).toBe(100);
    });

    test("should return 0 for empty database", async () => {
      const total = await progressRepository.getTotalPagesRead();
      expect(total).toBe(0);
    });
  });

  describe("Pages Read By Date", () => {
    test("should return pages for a specific date only", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Progress from yesterday
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: toProgressDate(yesterday),
      });

      // Progress from today
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: toProgressDate(new Date()),
      });

      const pagesToday = await progressRepository.getPagesReadByDate(toProgressDate(new Date()));
      expect(pagesToday).toBe(50); // Only today's progress

      const pagesYesterday = await progressRepository.getPagesReadByDate(toProgressDate(yesterday));
      expect(pagesYesterday).toBe(50); // Only yesterday's progress
    });
  });

  describe("Books Read Count", () => {
    test("should count completed sessions", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
      });

      // Completed sessions
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: toSessionDate(new Date()),
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: toSessionDate(new Date()),
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

    test("should count books completed in current year", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: [],
      });

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Completed last year
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: `${lastYear}-06-15`,
      });

      // Completed this year
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: toSessionDate(new Date()),
      });

      const countThisYear = await sessionRepository.countCompletedByYear(currentYear);
      expect(countThisYear).toBe(1);

      const countLastYear = await sessionRepository.countCompletedByYear(lastYear);
      expect(countLastYear).toBe(1);
    });
  });

  describe("Currently Reading Count", () => {
    test("should only count active reading sessions", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
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
        bookId: book2.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        startedDate: toSessionDate(new Date()),
        completedDate: toSessionDate(new Date()),
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
        progressDate: toProgressDate(day1),
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
        progressDate: toProgressDate(day2),
      });

      // Calculate 30 days ago in user timezone
      const userTimezone = 'America/New_York';
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const avg = await progressRepository.getAveragePagesPerDay(toDateString(thirtyDaysAgo), userTimezone);
      expect(avg).toBe(75); // (50 + 100) / 2 = 75
    });

    test("should return 0 for no progress", async () => {
      const userTimezone = 'America/New_York';
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const avg = await progressRepository.getAveragePagesPerDay(toDateString(thirtyDaysAgo), userTimezone);
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
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Use timezone-aware dates to avoid CI flakiness
      const { toZonedTime, fromZonedTime } = require("date-fns-tz");
      const { startOfDay, subDays } = require("date-fns");
      const timezone = 'America/New_York';
      
      const now = new Date();
      const todayInTz = startOfDay(toZonedTime(now, timezone));
      const yesterdayInTz = subDays(todayInTz, 1);
      
      const today = fromZonedTime(todayInTz, timezone);
      const yesterday = fromZonedTime(yesterdayInTz, timezone);

      // Multiple progress entries on same day should be summed
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: toProgressDate(today),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: toProgressDate(today),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 75,
        currentPercentage: 75,
        pagesRead: 75,
        progressDate: toProgressDate(yesterday),
      });

      const sevenDaysAgo = subDays(todayInTz, 7);
      const sevenDaysAgoUtc = fromZonedTime(sevenDaysAgo, timezone);

      const calendar = await progressRepository.getActivityCalendar(toDateString(sevenDaysAgoUtc), toDateString(today), timezone);

      expect(calendar.length).toBe(2); // 2 unique days
      
      // progressDate is the calendar day string - compare directly
      const todayDateStr = toProgressDate(today);
      const yesterdayDateStr = toProgressDate(yesterday);
      
      expect(calendar.find((day) => day.date === todayDateStr)?.pagesRead).toBe(100);
      expect(calendar.find((day) => day.date === yesterdayDateStr)?.pagesRead).toBe(75);
    });
  });
});
