import { getLogger } from "@/lib/logger";
/**
 * Database seeding orchestrator
 * Syncs Calibre and generates realistic development data for testing
 */

import { syncCalibreLibrary } from "@/lib/sync-service";
import { bookRepository, sessionRepository, progressRepository, readingGoalRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { rebuildStreak } from "@/lib/streaks";
import {
  generateActiveStreak,
  generateHistoricalProgress,
  generateBookInProgress,
  generateCompletedBook,
  generateDNFProgress,
} from "./fixtures/progress";
import {
  generateMultiYearGoals,
  calculateCompletedBooksForGoal,
  generateCompletionDatesForYear,
} from "./fixtures/goals";
import { generateShelfFixtures } from "./fixtures/shelves";
import { format, subDays } from "date-fns";

// Lazy logger initialization to prevent pino from loading during instrumentation phase
let logger: any = null;
function getLoggerSafe() {
  // In test mode, return no-op logger to avoid require() issues in Vitest
  if (process.env.NODE_ENV === 'test') {
    return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, fatal: () => {} };
  }
  if (!logger) {
    logger = getLogger();
  }
  return logger;
}

export interface SeedResult {
  success: boolean;
  booksFromSync: number;
  sessionsSeeded: number;
  progressLogsSeeded: number;
  booksUsed: number;
  goalsCreated?: number;
  booksCompletedHistorically?: number;
  shelvesCreated?: number;
  currentStreak?: number;
  longestStreak?: number;
  totalDaysActive?: number;
  error?: string;
}

/**
 * Main seeding function
 * - Syncs Calibre library to import books
 * - Selects books from synced library
 * - Creates sessions and progress logs for realistic testing
 */
export async function seedDatabase(): Promise<SeedResult> {
  getLoggerSafe().info("Starting database seeding process...");

  try {
    // Phase 1: Sync Calibre
    getLoggerSafe().info("Phase 1: Syncing Calibre library...");
    const syncResult = await syncCalibreLibrary();

    if (!syncResult.success) {
      throw new Error(`Calibre sync failed: ${syncResult.error || "Unknown error"}`);
    }

    getLoggerSafe().info({
      synced: syncResult.syncedCount,
      updated: syncResult.updatedCount,
      removed: syncResult.removedCount,
      total: syncResult.totalBooks,
    }, "Calibre sync completed");

    if (syncResult.totalBooks === 0) {
      throw new Error("No books found in Calibre library. Please ensure CALIBRE_DB_PATH is set correctly.");
    }

    // Phase 2: Select books for seeding
    getLoggerSafe().info("Phase 2: Selecting books for seeding...");
    const allBooks = await bookRepository.findAll();

    if (allBooks.length === 0) {
      throw new Error("No books found in database after sync");
    }

    // Select 15 books with variety (increased from 12 to include DNF books)
    // We'll assign random page counts to any books without them
    const sortedBooks = allBooks.sort((a, b) => (a.totalPages || 200) - (b.totalPages || 200));
    const booksToUse = sortedBooks.slice(0, Math.min(15, sortedBooks.length));

    if (booksToUse.length === 0) {
      throw new Error("No books found to seed");
    }

    getLoggerSafe().info({
      totalBooks: allBooks.length,
      selectedBooks: booksToUse.length,
      titles: booksToUse.map(b => `${b.title} (${b.totalPages || 'no pages'})`),
    }, "Selected books for seeding");

    // Phase 3: Seed reading sessions
    getLoggerSafe().info("Phase 3: Creating reading sessions...");
    let sessionsCreated = 0;

    const sessionPlans = [
      { index: 0, status: "reading" as const, description: "active streak book 1", hasProgress: true },
      { index: 1, status: "reading" as const, description: "active streak book 2", hasProgress: true },
      { index: 2, status: "reading" as const, description: "mid-progress book", hasProgress: true },
      { index: 3, status: "reading" as const, description: "just started book", hasProgress: true },
      { index: 4, status: "read" as const, description: "completed book", hasProgress: true },
      { index: 5, status: "dnf" as const, description: "DNF book 1 - wasn't feeling it", hasProgress: true },
      { index: 6, status: "dnf" as const, description: "DNF book 2 - got bored", hasProgress: true },
      { index: 7, status: "read-next" as const, description: "read-next book 1", hasProgress: false },
      { index: 8, status: "read-next" as const, description: "read-next book 2", hasProgress: false },
      { index: 9, status: "read-next" as const, description: "read-next book 3", hasProgress: false },
      { index: 10, status: "to-read" as const, description: "to-read book 1", hasProgress: false },
      { index: 11, status: "to-read" as const, description: "to-read book 2", hasProgress: false },
      { index: 12, status: "to-read" as const, description: "to-read book 3", hasProgress: false },
      { index: 13, status: "to-read" as const, description: "to-read book 4", hasProgress: false },
      { index: 14, status: "to-read" as const, description: "to-read book 5", hasProgress: false },
    ];

    const sessions: Array<{ bookId: number; sessionId: number; status: string; totalPages: number }> = [];

    for (const plan of sessionPlans) {
      if (plan.index >= booksToUse.length) continue;

      const book = booksToUse[plan.index];

      // Assign random page count if book doesn't have one
      let totalPages = book.totalPages;
      if (!totalPages || totalPages === 0) {
        // Generate realistic page count (150-600 pages)
        totalPages = Math.floor(Math.random() * 450) + 150;

        // Update book with generated page count
        await bookRepository.update(book.id, { totalPages });

        getLoggerSafe().info({
          bookId: book.id,
          title: book.title,
          generatedPages: totalPages
        }, "Assigned random page count to book");
      }

      // Check if book already has an active session
      const existingSession = await sessionRepository.findActiveByBookId(book.id);

      if (existingSession) {
        // Update session status if it doesn't match the plan
        if (existingSession.status !== plan.status) {
          // Get today's date string in YYYY-MM-DD format
          const todayString = format(new Date(), 'yyyy-MM-dd');
          
          // Calculate DNF date (2-8 weeks ago for DNF books)
          const dnfWeeksAgo = 2 + Math.floor(Math.random() * 7);
          const dnfDateString = format(subDays(new Date(), dnfWeeksAgo * 7), 'yyyy-MM-dd');
          
          await sessionRepository.update(existingSession.id, {
            status: plan.status,
            startedDate: plan.status !== "to-read" ? (existingSession.startedDate || todayString) : null,
            completedDate: plan.status === "read" ? todayString : existingSession.completedDate,
            dnfDate: plan.status === "dnf" ? dnfDateString : existingSession.dnfDate,
          });

          getLoggerSafe().info({
            bookId: book.id,
            title: book.title,
            sessionId: existingSession.id,
            oldStatus: existingSession.status,
            newStatus: plan.status,
          }, "Updated existing session status");
        } else {
          getLoggerSafe().info({
            bookId: book.id,
            title: book.title,
            sessionId: existingSession.id,
            status: existingSession.status,
          }, "Using existing session for book");
        }

        // Use existing session
        sessions.push({
          bookId: book.id,
          sessionId: existingSession.id,
          status: plan.status, // Use planned status (may have been updated)
          totalPages,
        });
        continue;
      }

      // Get next session number
      const sessionNumber = await sessionRepository.getNextSessionNumber(book.id);

      // Get today's date string in YYYY-MM-DD format
      const todayString = format(new Date(), 'yyyy-MM-dd');
      
      // Calculate DNF date (2-8 weeks ago for DNF books)
      const dnfWeeksAgo = 2 + Math.floor(Math.random() * 7);
      const dnfDateString = format(subDays(new Date(), dnfWeeksAgo * 7), 'yyyy-MM-dd');

      // Create session
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber,
        status: plan.status,
        startedDate: plan.status !== "to-read" ? todayString : null,
        completedDate: plan.status === "read" ? todayString : null,
        dnfDate: plan.status === "dnf" ? dnfDateString : null,
      });

      sessions.push({
        bookId: book.id,
        sessionId: session.id,
        status: plan.status,
        totalPages,
      });

      sessionsCreated++;
      getLoggerSafe().info({
        bookId: book.id,
        title: book.title,
        status: plan.status,
        description: plan.description,
      }, "Created session");
    }

    // Phase 4: Seed progress logs
    getLoggerSafe().info("Phase 4: Generating progress logs...");
    let progressLogsCreated = 0;

    for (const session of sessions) {
      const logs: any[] = [];
      const sessionIndex = sessions.indexOf(session);
      const plan = sessionPlans[sessionIndex];

      // Only generate progress logs for sessions that should have them
      if (!plan || !plan.hasProgress) {
        continue;
      }

      // Generate progress based on session index
      if (sessionIndex === 0 || sessionIndex === 1) {
        // Active streak books - consecutive 7 days with 40+ pages/day
        // Cap at 95% to avoid auto-completion at 100%
        const streakLogs = generateActiveStreak(
          session.bookId,
          session.sessionId,
          session.totalPages,
          7,
          sessionIndex === 0 ? Math.max(0, session.totalPages - 300) : Math.floor(session.totalPages * 0.4), // Nearly done for book 1, mid-progress for book 2
          95 // maxPercentage - avoid auto-completion
        );
        logs.push(...streakLogs);

        // Add historical progress before the streak
        if (session.totalPages > 300) {
          const historicalLogs = generateHistoricalProgress(
            session.bookId,
            session.sessionId,
            session.totalPages,
            3, // 3 months back
            sessionIndex === 0 ? 80 : 30, // Different starting points
            95 // maxPercentage - avoid auto-completion
          );
          logs.push(...historicalLogs);
        }
      } else if (sessionIndex === 2) {
        // Mid-progress book (40-60% complete)
        const midProgressLogs = generateBookInProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          45 + Math.floor(Math.random() * 15), // 45-60% (will be capped at 95%)
          4 // 4 weeks
        );
        logs.push(...midProgressLogs);
      } else if (sessionIndex === 3) {
        // Just started (10-15% complete)
        const justStartedLogs = generateBookInProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          10 + Math.floor(Math.random() * 6), // 10-15%
          2 // 2 weeks
        );
        logs.push(...justStartedLogs);
      } else if (sessionIndex === 4) {
        // Completed book - historical progress + completion log
        const completedHistorical = generateHistoricalProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          2, // 2 months
          95, // Up to 95%
          95 // maxPercentage
        );
        logs.push(...completedHistorical);

        // Generate 100% completion log (only for "read" status books)
        const completionLog = generateCompletedBook(
          session.bookId,
          session.sessionId,
          session.totalPages,
          14 + Math.floor(Math.random() * 14) // 14-28 days ago
        );
        logs.push(completionLog);
      } else if (sessionIndex === 5 || sessionIndex === 6) {
        // DNF books - partial progress with inconsistent reading patterns
        const dnfWeeksAgo = 2 + Math.floor(Math.random() * 7); // 2-8 weeks ago
        const dnfProgress = generateDNFProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          15 + Math.floor(Math.random() * 26), // 15-40% completion
          dnfWeeksAgo
        );
        logs.push(...dnfProgress);
      }
      // Other sessions: No progress logs (to-read, read-next scenarios)

      // Insert progress logs in batch
      if (logs.length > 0) {
        for (const log of logs) {
          // Convert progressDate from Date to string (ISO format)
          const logToInsert = {
            ...log,
            progressDate: log.progressDate instanceof Date ? log.progressDate.toISOString().split('T')[0] : log.progressDate
          };
          await progressRepository.create(logToInsert);
        }

        progressLogsCreated += logs.length;
        getLoggerSafe().info({
          bookId: session.bookId,
          logsCreated: logs.length,
        }, "Created progress logs");
      }
    }

    // Phase 5: Rebuild streak from progress logs and enable tracking
    getLoggerSafe().info("Phase 5: Rebuilding streak from progress logs...");
    const rebuiltStreak = await rebuildStreak(null, undefined, true); // Enable streak tracking for seeded data
    
    getLoggerSafe().info({
      currentStreak: rebuiltStreak.currentStreak,
      longestStreak: rebuiltStreak.longestStreak,
      totalDaysActive: rebuiltStreak.totalDaysActive,
      lastActivityDate: rebuiltStreak.lastActivityDate,
      streakEnabled: rebuiltStreak.streakEnabled,
    }, "Streak rebuilt and enabled successfully");

    // Phase 6: Create reading goals for multiple years
    getLoggerSafe().info("Phase 6: Creating reading goals for multiple years...");
    const currentYear = new Date().getFullYear();
    const goalsToCreate = generateMultiYearGoals(currentYear, 2); // Current year + 2 past years + 1 future year
    
    let goalsCreated = 0;
    const createdGoals = [];
    
    for (const goalData of goalsToCreate) {
      // Check if goal already exists
      const existing = await readingGoalRepository.findByUserAndYear(null, goalData.year);
      
      if (existing) {
        getLoggerSafe().info({
          year: goalData.year,
          existingGoal: existing.booksGoal,
        }, "Goal already exists for year");
        createdGoals.push(existing);
        continue;
      }
      
      // Create the goal
      const goal = await readingGoalRepository.create({
        userId: null, // Single-user mode
        year: goalData.year,
        booksGoal: goalData.booksGoal,
      });
      
      goalsCreated++;
      createdGoals.push(goal);
      getLoggerSafe().info({
        year: goalData.year,
        booksGoal: goalData.booksGoal,
      }, "Created reading goal");
    }

    // Phase 7: Create historical completed books to match goals
    getLoggerSafe().info("Phase 7: Creating historical completed book sessions...");
    let booksCompletedHistorically = 0;
    
    // Get additional books from library for historical completions
    // We need enough books to satisfy the past year goals
    const additionalBooks = allBooks.slice(12); // Books not used in current sessions
    
    let bookIndex = 0;
    
    for (const goal of createdGoals) {
      // Only create historical completions for past years
      if (goal.year >= currentYear) {
        getLoggerSafe().info({
          year: goal.year,
          reason: "current or future year",
        }, "Skipping historical completions");
        continue;
      }
      
      const targetCompletions = calculateCompletedBooksForGoal(
        { year: goal.year, booksGoal: goal.booksGoal },
        currentYear
      );
      
      getLoggerSafe().info({
        year: goal.year,
        targetCompletions,
        booksGoal: goal.booksGoal,
      }, "Generating historical completions");
      
      // Generate completion dates for this year
      const completionDates = generateCompletionDatesForYear(goal.year, targetCompletions);
      
      // Create sessions with completion dates
      for (const completionDate of completionDates) {
        // Use next available book
        if (bookIndex >= additionalBooks.length) {
          getLoggerSafe().warn({
            year: goal.year,
            completed: booksCompletedHistorically,
            target: targetCompletions,
          }, "Ran out of books for historical completions");
          break;
        }
        
        const book = additionalBooks[bookIndex];
        bookIndex++;
        
        // Assign page count if missing
        let totalPages = book.totalPages;
        if (!totalPages || totalPages === 0) {
          totalPages = Math.floor(Math.random() * 450) + 150;
          await bookRepository.update(book.id, { totalPages });
        }
        
        // Check if book already has a session
        const existingSession = await sessionRepository.findActiveByBookId(book.id);
        
        if (existingSession) {
          // Update existing session with completion date
          await sessionRepository.update(existingSession.id, {
            status: "read",
            completedDate: format(completionDate, 'yyyy-MM-dd'),
            startedDate: existingSession.startedDate || format(subDays(completionDate, 14), 'yyyy-MM-dd'), // 2 weeks before completion
          });
          
          booksCompletedHistorically++;
          getLoggerSafe().info({
            bookId: book.id,
            title: book.title,
            year: goal.year,
            completionDate,
          }, "Updated existing session with historical completion date");
        } else {
          // Create new session with completion date
          const sessionNumber = await sessionRepository.getNextSessionNumber(book.id);
          
          await sessionRepository.create({
            bookId: book.id,
            sessionNumber,
            status: "read",
            startedDate: format(subDays(completionDate, 14), 'yyyy-MM-dd'), // Started 2 weeks before completion
            completedDate: format(completionDate, 'yyyy-MM-dd'),
          });
          
          booksCompletedHistorically++;
          getLoggerSafe().info({
            bookId: book.id,
            title: book.title,
            year: goal.year,
            completionDate,
          }, "Created historical completed book session");
        }
      }
    }

    // Phase 7: Create shelves and populate with books
    getLoggerSafe().info("Phase 7: Creating shelves and assigning books...");
    const shelfFixtures = generateShelfFixtures();
    let shelvesCreated = 0;

    for (const fixture of shelfFixtures) {
      // Check if shelf already exists
      const existingShelves = await shelfRepository.findByUserId(null);
      const exists = existingShelves.find(s => s.name === fixture.name);
      
      if (exists) {
        getLoggerSafe().info({ name: fixture.name }, "Shelf already exists, skipping");
        continue;
      }
      
      // Create shelf
      const shelf = await shelfRepository.create({
        userId: null,
        name: fixture.name,
        description: fixture.description,
        color: fixture.color,
        icon: fixture.icon,
      });
      
      shelvesCreated++;
      getLoggerSafe().info({ 
        shelfId: shelf.id, 
        name: fixture.name,
        color: fixture.color,
        icon: fixture.icon,
      }, "Created shelf");
      
      // Select books for this shelf
      const booksForShelf = fixture.bookSelector(allBooks, sessions);
      
      // Add books to shelf
      let booksAdded = 0;
      for (const book of booksForShelf) {
        try {
          await shelfRepository.addBookToShelf(shelf.id, book.id);
          booksAdded++;
        } catch (error) {
          getLoggerSafe().warn({ 
            error, 
            bookId: book.id, 
            shelfId: shelf.id 
          }, "Failed to add book to shelf");
        }
      }
      
      getLoggerSafe().info({ 
        shelfId: shelf.id, 
        name: fixture.name, 
        booksAdded,
        booksAttempted: booksForShelf.length,
      }, "Populated shelf with books");
    }

    getLoggerSafe().info({ shelvesCreated }, "Shelf seeding completed");

    getLoggerSafe().info({
      sessionsCreated,
      progressLogsCreated,
      goalsCreated,
      booksCompletedHistorically,
      shelvesCreated,
      currentStreak: rebuiltStreak.currentStreak,
    }, "Seeding completed successfully");

    return {
      success: true,
      booksFromSync: syncResult.totalBooks,
      sessionsSeeded: sessionsCreated,
      progressLogsSeeded: progressLogsCreated,
      booksUsed: booksToUse.length,
      goalsCreated,
      booksCompletedHistorically,
      shelvesCreated,
      currentStreak: rebuiltStreak.currentStreak,
      longestStreak: rebuiltStreak.longestStreak,
      totalDaysActive: rebuiltStreak.totalDaysActive,
    };
  } catch (error) {
    getLoggerSafe().error({ error }, "Seeding failed");
    return {
      success: false,
      booksFromSync: 0,
      sessionsSeeded: 0,
      progressLogsSeeded: 0,
      booksUsed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
