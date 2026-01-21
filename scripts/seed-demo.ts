#!/usr/bin/env node

/**
 * Demo database seeding script
 * Creates a realistic reading library using public domain classics
 * No Calibre connection required - books are created directly
 *
 * Usage:
 *   bun run scripts/seed-demo.ts
 *   npm run db:seed:demo
 */

import { config } from "dotenv";
config();

import { bookRepository, sessionRepository, progressRepository, readingGoalRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { rebuildStreak } from "@/lib/streaks";
import { runMigrations } from "@/lib/db/migrate";
import { format, subDays, subMonths } from "date-fns";

// Public domain classics for the demo
const DEMO_BOOKS = [
  {
    title: "Pride and Prejudice",
    authors: ["Jane Austen"],
    authorSort: "Austen, Jane",
    totalPages: 432,
    pubDate: new Date("1813-01-28"),
    publisher: "T. Egerton",
    description: "A witty comedy of manners that follows the turbulent relationship between Elizabeth Bennet and Mr. Darcy.",
    tags: ["Classic", "Romance", "British Literature"],
  },
  {
    title: "Moby-Dick",
    authors: ["Herman Melville"],
    authorSort: "Melville, Herman",
    totalPages: 654,
    pubDate: new Date("1851-10-18"),
    publisher: "Harper & Brothers",
    description: "Captain Ahab's obsessive quest to hunt the white whale that crippled him.",
    tags: ["Classic", "Adventure", "American Literature"],
  },
  {
    title: "1984",
    authors: ["George Orwell"],
    authorSort: "Orwell, George",
    totalPages: 328,
    pubDate: new Date("1949-06-08"),
    publisher: "Secker & Warburg",
    description: "A dystopian tale of totalitarianism, surveillance, and the struggle for truth.",
    tags: ["Classic", "Dystopia", "Science Fiction"],
  },
  {
    title: "The Great Gatsby",
    authors: ["F. Scott Fitzgerald"],
    authorSort: "Fitzgerald, F. Scott",
    totalPages: 180,
    pubDate: new Date("1925-04-10"),
    publisher: "Charles Scribner's Sons",
    description: "A portrait of the Jazz Age and the American Dream through the eyes of Nick Carraway.",
    tags: ["Classic", "American Literature"],
  },
  {
    title: "Jane Eyre",
    authors: ["Charlotte Brontë"],
    authorSort: "Brontë, Charlotte",
    totalPages: 532,
    pubDate: new Date("1847-10-19"),
    publisher: "Smith, Elder & Co.",
    description: "An orphaned governess finds love and independence in Victorian England.",
    tags: ["Classic", "Romance", "Gothic"],
  },
  {
    title: "Frankenstein",
    authors: ["Mary Shelley"],
    authorSort: "Shelley, Mary",
    totalPages: 280,
    pubDate: new Date("1818-01-01"),
    publisher: "Lackington, Hughes, Harding, Mavor & Jones",
    description: "The story of Victor Frankenstein and the creature he brings to life.",
    tags: ["Classic", "Gothic", "Science Fiction", "Horror"],
  },
  {
    title: "Dracula",
    authors: ["Bram Stoker"],
    authorSort: "Stoker, Bram",
    totalPages: 418,
    pubDate: new Date("1897-05-26"),
    publisher: "Archibald Constable and Company",
    description: "The legendary vampire Count Dracula attempts to move from Transylvania to England.",
    tags: ["Classic", "Gothic", "Horror"],
  },
  {
    title: "The Picture of Dorian Gray",
    authors: ["Oscar Wilde"],
    authorSort: "Wilde, Oscar",
    totalPages: 254,
    pubDate: new Date("1890-07-01"),
    publisher: "Lippincott's Monthly Magazine",
    description: "A young man sells his soul for eternal youth while his portrait ages.",
    tags: ["Classic", "Gothic", "Philosophy"],
  },
  {
    title: "Crime and Punishment",
    authors: ["Fyodor Dostoevsky"],
    authorSort: "Dostoevsky, Fyodor",
    totalPages: 671,
    pubDate: new Date("1866-01-01"),
    publisher: "The Russian Messenger",
    description: "A poor ex-student commits murder and suffers the psychological consequences.",
    tags: ["Classic", "Russian Literature", "Philosophy"],
  },
  {
    title: "Wuthering Heights",
    authors: ["Emily Brontë"],
    authorSort: "Brontë, Emily",
    totalPages: 416,
    pubDate: new Date("1847-12-01"),
    publisher: "Thomas Cautley Newby",
    description: "A tale of passion and revenge on the Yorkshire moors.",
    tags: ["Classic", "Romance", "Gothic"],
  },
  {
    title: "The Count of Monte Cristo",
    authors: ["Alexandre Dumas"],
    authorSort: "Dumas, Alexandre",
    totalPages: 1276,
    pubDate: new Date("1844-01-01"),
    publisher: "Journal des Débats",
    description: "An innocent man escapes prison and transforms into a wealthy count seeking revenge.",
    tags: ["Classic", "Adventure", "French Literature"],
  },
  {
    title: "Les Misérables",
    authors: ["Victor Hugo"],
    authorSort: "Hugo, Victor",
    totalPages: 1463,
    pubDate: new Date("1862-01-01"),
    publisher: "A. Lacroix, Verboeckhoven & Cie",
    description: "The story of Jean Valjean's redemption set against the backdrop of revolutionary France.",
    tags: ["Classic", "French Literature", "Historical Fiction"],
  },
  {
    title: "A Tale of Two Cities",
    authors: ["Charles Dickens"],
    authorSort: "Dickens, Charles",
    totalPages: 489,
    pubDate: new Date("1859-04-30"),
    publisher: "Chapman & Hall",
    description: "A story of resurrection and revolution in London and Paris.",
    tags: ["Classic", "Historical Fiction", "British Literature"],
  },
  {
    title: "The Adventures of Sherlock Holmes",
    authors: ["Arthur Conan Doyle"],
    authorSort: "Doyle, Arthur Conan",
    totalPages: 307,
    pubDate: new Date("1892-10-14"),
    publisher: "George Newnes",
    description: "A collection of twelve detective stories featuring Sherlock Holmes and Dr. Watson.",
    tags: ["Classic", "Mystery", "Detective Fiction"],
  },
  {
    title: "The Scarlet Letter",
    authors: ["Nathaniel Hawthorne"],
    authorSort: "Hawthorne, Nathaniel",
    totalPages: 272,
    pubDate: new Date("1850-03-16"),
    publisher: "Ticknor, Reed & Fields",
    description: "Hester Prynne bears the scarlet 'A' for adultery in Puritan Massachusetts.",
    tags: ["Classic", "American Literature", "Historical Fiction"],
  },
  {
    title: "Little Women",
    authors: ["Louisa May Alcott"],
    authorSort: "Alcott, Louisa May",
    totalPages: 449,
    pubDate: new Date("1868-09-30"),
    publisher: "Roberts Brothers",
    description: "The March sisters navigate life, love, and growing up during the Civil War.",
    tags: ["Classic", "American Literature", "Coming of Age"],
  },
  {
    title: "The Odyssey",
    authors: ["Homer"],
    authorSort: "Homer",
    totalPages: 541,
    pubDate: new Date("-0800-01-01"),
    publisher: "Ancient Greece",
    description: "Odysseus's epic journey home after the fall of Troy.",
    tags: ["Classic", "Epic Poetry", "Ancient Literature", "Mythology"],
  },
  {
    title: "Don Quixote",
    authors: ["Miguel de Cervantes"],
    authorSort: "Cervantes, Miguel de",
    totalPages: 1023,
    pubDate: new Date("1605-01-16"),
    publisher: "Juan de la Cuesta",
    description: "A Spanish gentleman goes mad from reading too many chivalric romances.",
    tags: ["Classic", "Satire", "Spanish Literature"],
  },
  {
    title: "Anna Karenina",
    authors: ["Leo Tolstoy"],
    authorSort: "Tolstoy, Leo",
    totalPages: 964,
    pubDate: new Date("1877-01-01"),
    publisher: "The Russian Messenger",
    description: "A tragic tale of love and society in Imperial Russia.",
    tags: ["Classic", "Russian Literature", "Romance"],
  },
  {
    title: "Great Expectations",
    authors: ["Charles Dickens"],
    authorSort: "Dickens, Charles",
    totalPages: 544,
    pubDate: new Date("1861-08-01"),
    publisher: "Chapman & Hall",
    description: "The story of Pip's journey from humble origins to gentleman status.",
    tags: ["Classic", "British Literature", "Coming of Age"],
  },
];

// Demo shelves
const DEMO_SHELVES = [
  {
    name: "Favorites",
    description: "All-time favorite reads",
    color: "#ef4444",
    icon: "heart",
  },
  {
    name: "Classics Challenge",
    description: "Working through the classics",
    color: "#8b5cf6",
    icon: "book",
  },
  {
    name: "Quick Reads",
    description: "Books under 350 pages",
    color: "#22c55e",
    icon: "clock",
  },
];

async function seedDemoDatabase() {
  console.log("\n🌱 Starting demo database seeding...\n");

  try {
    // Phase 0: Run migrations to create database tables
    console.log("🔧 Phase 0: Running database migrations...");
    await runMigrations();
    console.log("  ✓ Database migrations complete\n");

    // Phase 1: Create books
    console.log("📚 Phase 1: Creating demo books...");
    const createdBooks: Array<{ id: number; title: string; totalPages: number }> = [];

    for (let i = 0; i < DEMO_BOOKS.length; i++) {
      const bookData = DEMO_BOOKS[i];
      const calibreId = 10000 + i;

      // Check if book already exists by calibreId
      const existing = await bookRepository.findByCalibreId(calibreId);
      if (existing) {
        console.log(`  ⏭️  "${bookData.title}" already exists, skipping`);
        createdBooks.push({ id: existing.id, title: existing.title, totalPages: existing.totalPages || bookData.totalPages });
        continue;
      }

      const book = await bookRepository.create({
        calibreId, // Fake Calibre IDs starting at 10000
        title: bookData.title,
        authors: bookData.authors,
        authorSort: bookData.authorSort,
        totalPages: bookData.totalPages,
        pubDate: bookData.pubDate,
        publisher: bookData.publisher,
        description: bookData.description,
        tags: bookData.tags,
        path: `/demo/${bookData.title.toLowerCase().replace(/\s+/g, "-")}`,
      });

      createdBooks.push({ id: book.id, title: book.title, totalPages: book.totalPages || bookData.totalPages });
      console.log(`  ✓ Created "${bookData.title}"`);
    }

    // Phase 2: Create reading sessions
    console.log("\n📖 Phase 2: Creating reading sessions...");

    const sessionPlans = [
      // Currently reading (2 books)
      { index: 0, status: "reading" as const, progressPercent: 85 },
      { index: 1, status: "reading" as const, progressPercent: 45 },
      // Completed (4 books)
      { index: 2, status: "read" as const, progressPercent: 100 },
      { index: 3, status: "read" as const, progressPercent: 100 },
      { index: 4, status: "read" as const, progressPercent: 100 },
      { index: 5, status: "read" as const, progressPercent: 100 },
      // DNF (1 book)
      { index: 6, status: "dnf" as const, progressPercent: 25 },
      // Read Next (3 books)
      { index: 7, status: "read-next" as const, progressPercent: 0 },
      { index: 8, status: "read-next" as const, progressPercent: 0 },
      { index: 9, status: "read-next" as const, progressPercent: 0 },
      // To Read (rest)
      { index: 10, status: "to-read" as const, progressPercent: 0 },
      { index: 11, status: "to-read" as const, progressPercent: 0 },
      { index: 12, status: "to-read" as const, progressPercent: 0 },
      { index: 13, status: "to-read" as const, progressPercent: 0 },
      { index: 14, status: "to-read" as const, progressPercent: 0 },
    ];

    const sessions: Array<{ bookId: number; sessionId: number; status: string; totalPages: number; progressPercent: number }> = [];
    let sessionsCreated = 0;

    for (const plan of sessionPlans) {
      if (plan.index >= createdBooks.length) continue;

      const book = createdBooks[plan.index];

      // Check for existing session
      const existingSession = await sessionRepository.findActiveByBookId(book.id);
      if (existingSession) {
        sessions.push({
          bookId: book.id,
          sessionId: existingSession.id,
          status: plan.status,
          totalPages: book.totalPages,
          progressPercent: plan.progressPercent,
        });
        continue;
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const weeksAgo = (weeks: number) => format(subDays(new Date(), weeks * 7), "yyyy-MM-dd");
      const monthsAgo = (months: number) => format(subMonths(new Date(), months), "yyyy-MM-dd");

      const sessionNumber = await sessionRepository.getNextSessionNumber(book.id);

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber,
        status: plan.status,
        startedDate: plan.status === "to-read" ? null : (plan.status === "read" ? monthsAgo(2 + plan.index) : weeksAgo(4)),
        completedDate: plan.status === "read" ? monthsAgo(1 + plan.index * 0.5) : null,
        dnfDate: plan.status === "dnf" ? weeksAgo(3) : null,
      });

      sessions.push({
        bookId: book.id,
        sessionId: session.id,
        status: plan.status,
        totalPages: book.totalPages,
        progressPercent: plan.progressPercent,
      });

      sessionsCreated++;
      console.log(`  ✓ Created session for "${book.title}" (${plan.status})`);
    }

    // Phase 3: Create progress logs
    console.log("\n📊 Phase 3: Creating progress logs...");
    let progressLogsCreated = 0;

    for (const session of sessions) {
      if (session.progressPercent === 0) continue;

      const totalPages = session.totalPages;
      const targetPage = Math.floor((session.progressPercent / 100) * totalPages);

      // Generate progress logs over time
      const logs: Array<{ bookId: number; sessionId: number; pagesRead: number; currentPage: number; progressDate: string }> = [];
      let currentPage = 0;
      const daysBack = session.status === "read" ? 60 : 30;

      // Generate realistic reading pattern
      for (let day = daysBack; day >= 0 && currentPage < targetPage; day--) {
        // Random reading days (not every day)
        if (Math.random() < 0.4) continue;

        const pagesThisSession = Math.min(
          Math.floor(Math.random() * 60) + 20, // 20-80 pages
          targetPage - currentPage
        );

        if (pagesThisSession <= 0) continue;

        currentPage += pagesThisSession;
        const progressDate = format(subDays(new Date(), day), "yyyy-MM-dd");

        logs.push({
          bookId: session.bookId,
          sessionId: session.sessionId,
          pagesRead: pagesThisSession,
          currentPage: Math.min(currentPage, targetPage),
          progressDate,
        });
      }

      // Ensure we hit the target
      if (currentPage < targetPage && logs.length > 0) {
        logs[logs.length - 1].currentPage = targetPage;
        logs[logs.length - 1].pagesRead = targetPage - (logs[logs.length - 2]?.currentPage || 0);
      }

      for (const log of logs) {
        await progressRepository.create(log);
        progressLogsCreated++;
      }

      if (logs.length > 0) {
        console.log(`  ✓ Created ${logs.length} progress logs for "${createdBooks[sessions.indexOf(session)]?.title || "book"}"`);
      }
    }

    // Phase 4: Create reading goals
    console.log("\n🎯 Phase 4: Creating reading goals...");
    const currentYear = new Date().getFullYear();
    const goalsData = [
      { year: currentYear - 2, booksGoal: 20 },
      { year: currentYear - 1, booksGoal: 24 },
      { year: currentYear, booksGoal: 30 },
      { year: currentYear + 1, booksGoal: 36 },
    ];

    let goalsCreated = 0;
    for (const goalData of goalsData) {
      const existing = await readingGoalRepository.findByUserAndYear(null, goalData.year);
      if (existing) {
        console.log(`  ⏭️  Goal for ${goalData.year} already exists`);
        continue;
      }

      await readingGoalRepository.create({
        userId: null,
        year: goalData.year,
        booksGoal: goalData.booksGoal,
      });

      goalsCreated++;
      console.log(`  ✓ Created goal for ${goalData.year}: ${goalData.booksGoal} books`);
    }

    // Phase 5: Create shelves
    console.log("\n📚 Phase 5: Creating shelves...");
    let shelvesCreated = 0;

    for (const shelfData of DEMO_SHELVES) {
      const existingShelves = await shelfRepository.findByUserId(null);
      const exists = existingShelves.find((s) => s.name === shelfData.name);

      if (exists) {
        console.log(`  ⏭️  Shelf "${shelfData.name}" already exists`);
        continue;
      }

      const shelf = await shelfRepository.create({
        userId: null,
        name: shelfData.name,
        description: shelfData.description,
        color: shelfData.color,
        icon: shelfData.icon,
      });

      shelvesCreated++;
      console.log(`  ✓ Created shelf "${shelfData.name}"`);

      // Add books to shelves based on criteria
      let booksToAdd: number[] = [];

      if (shelfData.name === "Favorites") {
        // Add completed books to favorites
        booksToAdd = sessions.filter((s) => s.status === "read").map((s) => s.bookId).slice(0, 3);
      } else if (shelfData.name === "Classics Challenge") {
        // Add currently reading and read-next
        booksToAdd = sessions.filter((s) => s.status === "reading" || s.status === "read-next").map((s) => s.bookId);
      } else if (shelfData.name === "Quick Reads") {
        // Add books under 350 pages
        booksToAdd = createdBooks.filter((b) => b.totalPages < 350).map((b) => b.id).slice(0, 5);
      }

      for (const bookId of booksToAdd) {
        try {
          await shelfRepository.addBookToShelf(shelf.id, bookId);
        } catch {
          // Book may already be on shelf
        }
      }

      console.log(`    Added ${booksToAdd.length} books to "${shelfData.name}"`);
    }

    // Phase 6: Rebuild streak
    console.log("\n🔥 Phase 6: Rebuilding streak...");
    const streakResult = await rebuildStreak(null, undefined, true);
    console.log(`  ✓ Current streak: ${streakResult.currentStreak} days`);
    console.log(`  ✓ Longest streak: ${streakResult.longestStreak} days`);

    // Summary
    console.log("\n✅ Demo seeding completed!\n");
    console.log("Summary:");
    console.log(`  📚 Books created: ${createdBooks.length}`);
    console.log(`  📖 Sessions created: ${sessionsCreated}`);
    console.log(`  📊 Progress logs created: ${progressLogsCreated}`);
    console.log(`  🎯 Goals created: ${goalsCreated}`);
    console.log(`  📚 Shelves created: ${shelvesCreated}`);
    console.log(`  🔥 Current streak: ${streakResult.currentStreak} days\n`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Demo seeding failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedDemoDatabase();
}

export { seedDemoDatabase };
