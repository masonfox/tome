import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { books } from "./books";

export const shelves = sqliteTable(
  "shelves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode, future multi-user support
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"), // Hex color code for shelf badge
    icon: text("icon"), // Icon name or emoji for shelf display
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Index for userId queries (future multi-user support)
    userIdx: index("idx_shelves_user").on(table.userId),
  })
);

// Junction table for many-to-many relationship between books and shelves
export const bookShelves = sqliteTable(
  "book_shelves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shelfId: integer("shelf_id")
      .notNull()
      .references(() => shelves.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0), // For custom ordering within shelf
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Index for efficient shelf-based queries
    shelfIdx: index("idx_book_shelves_shelf").on(table.shelfId),
    // Index for efficient book-based queries
    bookIdx: index("idx_book_shelves_book").on(table.bookId),
    // Unique constraint: a book can only be added to a shelf once
    uniqueBookShelf: uniqueIndex("idx_book_shelves_unique").on(
      table.shelfId,
      table.bookId
    ),
    // Composite index for ordering queries
    shelfOrderIdx: index("idx_book_shelves_shelf_order").on(
      table.shelfId,
      table.sortOrder
    ),
  })
);

export type Shelf = typeof shelves.$inferSelect;
export type NewShelf = typeof shelves.$inferInsert;
export type BookShelf = typeof bookShelves.$inferSelect;
export type NewBookShelf = typeof bookShelves.$inferInsert;
