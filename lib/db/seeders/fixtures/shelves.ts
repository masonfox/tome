/**
 * Shelf fixture generation for development seeding
 * Creates realistic shelves with smart book selection
 */

import type { Book } from "@/lib/db/schema/books";

export interface ShelfFixture {
  name: string;
  description: string;
  color: string;  // Hex color
  icon: string;   // Lucide icon name (must match SHELF_ICONS keys)
  bookSelector: (books: Book[], sessions: Array<{ bookId: number; status: string }>) => Book[];
}

/**
 * Generates a random hex color from a predefined palette
 * @returns Hex color string (e.g., "#3B82F6")
 */
export function generateRandomHexColor(): string {
  const colors = [
    "#EF4444", // red
    "#F59E0B", // amber
    "#10B981", // green
    "#3B82F6", // blue
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#F97316", // orange
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Randomly selects N items from an array
 */
function randomSelect<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

/**
 * Generates 5 realistic shelf fixtures for seeding
 * 
 * Shelves created:
 * 1. Favorites - Highly-rated books (Heart icon)
 * 2. Want to Re-read - Completed books to revisit (Repeat icon)
 * 3. Quick Reads - Short books under 250 pages (Zap icon)
 * 4. Book Club - Mix of read and to-read books (Users icon)
 * 5. Reference - Important completed books (BookMarked icon)
 * 
 * @returns Array of 5 shelf fixtures with book selectors
 */
export function generateShelfFixtures(): ShelfFixture[] {
  return [
    {
      name: "Favorites",
      description: "My all-time favorite books",
      color: generateRandomHexColor(),
      icon: "Heart",
      bookSelector: (books, sessions) => {
        // Prefer highly-rated books (rating >= 4)
        const highRated = books.filter(b => b.rating && b.rating >= 4);
        if (highRated.length >= 3) {
          return randomSelect(highRated, 5);
        }
        // Fallback to random books if not enough highly-rated ones
        return randomSelect(books, 5);
      },
    },
    {
      name: "Want to Re-read",
      description: "Books I'd love to read again",
      color: generateRandomHexColor(),
      icon: "Repeat",
      bookSelector: (books, sessions) => {
        // Get completed books
        const completedBookIds = sessions
          .filter(s => s.status === "read")
          .map(s => s.bookId);
        const completedBooks = books.filter(b => completedBookIds.includes(b.id));
        
        if (completedBooks.length === 0) {
          // Fallback to any books if no completed ones
          return randomSelect(books, 4);
        }
        
        return randomSelect(completedBooks, 4);
      },
    },
    {
      name: "Quick Reads",
      description: "Short books for busy days",
      color: generateRandomHexColor(),
      icon: "Zap",
      bookSelector: (books, sessions) => {
        // Books with < 250 pages
        const shortBooks = books.filter(b => b.totalPages && b.totalPages < 250);
        
        if (shortBooks.length > 0) {
          return randomSelect(shortBooks, 6);
        }
        
        // Fallback to shortest available books
        const sorted = [...books].sort((a, b) => (a.totalPages || 999) - (b.totalPages || 999));
        return sorted.slice(0, 6);
      },
    },
    {
      name: "Book Club",
      description: "Books to discuss with friends",
      color: generateRandomHexColor(),
      icon: "Users",
      bookSelector: (books, sessions) => {
        // Mix of read and to-read books
        const readBookIds = sessions
          .filter(s => s.status === "read")
          .map(s => s.bookId);
        const toReadBookIds = sessions
          .filter(s => s.status === "to-read")
          .map(s => s.bookId);
        
        const readBooks = books.filter(b => readBookIds.includes(b.id));
        const toReadBooks = books.filter(b => toReadBookIds.includes(b.id));
        
        // Try to get 2 read + 2 to-read, fallback to any books
        const selected = [
          ...randomSelect(readBooks, 2),
          ...randomSelect(toReadBooks, 2),
        ];
        
        // If we didn't get enough, add random books
        if (selected.length < 3) {
          const remaining = books.filter(b => !selected.find(s => s.id === b.id));
          selected.push(...randomSelect(remaining, 4 - selected.length));
        }
        
        return selected;
      },
    },
    {
      name: "Reference",
      description: "Books I refer back to often",
      color: generateRandomHexColor(),
      icon: "BookMarked",
      bookSelector: (books, sessions) => {
        // Highly-rated completed books (ideal for reference)
        const completedBookIds = sessions
          .filter(s => s.status === "read")
          .map(s => s.bookId);
        const completedHighRated = books.filter(b => 
          completedBookIds.includes(b.id) && b.rating && b.rating >= 4
        );
        
        if (completedHighRated.length >= 3) {
          return randomSelect(completedHighRated, 5);
        }
        
        // Fallback to any completed books
        const anyCompleted = books.filter(b => completedBookIds.includes(b.id));
        if (anyCompleted.length > 0) {
          return randomSelect(anyCompleted, 5);
        }
        
        // Final fallback to random books
        return randomSelect(books, 5);
      },
    },
  ];
}
