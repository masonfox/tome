import { eq, and, or, sql, like, inArray, desc, asc, SQL } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { books, Book, NewBook } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { db } from "@/lib/db/sqlite";

export interface BookFilter {
  status?: string;
  search?: string;
  tags?: string[];
  rating?: string; // "all" | "5" | "4+" | "3+" | "2+" | "1+" | "unrated"
  showOrphaned?: boolean;
  orphanedOnly?: boolean;
}

export interface BookWithStatus extends Book {
  status?: string | null;
}

export class BookRepository extends BaseRepository<Book, NewBook, typeof books> {
  constructor() {
    super(books);
  }

  protected getTable() {
    return books;
  }

  /**
   * Find a book by calibreId
   */
  async findByCalibreId(calibreId: number): Promise<Book | undefined> {
    return this.getDatabase()
      .select()
      .from(books)
      .where(eq(books.calibreId, calibreId))
      .get();
  }

  /**
   * Find books with filters and pagination
   */
  async findWithFilters(
    filters: BookFilter,
    limit: number = 50,
    skip: number = 0,
    sortBy?: string
  ): Promise<{ books: Book[]; total: number }> {
    const conditions: SQL[] = [];

    // Orphaned filter
    if (filters.orphanedOnly) {
      conditions.push(eq(books.orphaned, true));
    } else if (!filters.showOrphaned) {
      conditions.push(or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)!);
    }

    // Search filter
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(books.title, searchPattern),
          like(books.authors, searchPattern)
        )!
      );
    }

    // Tags filter (JSON contains)
    if (filters.tags && filters.tags.length > 0) {
      // For JSON arrays, we need to check if any of the tags exist
      const tagConditions = filters.tags.map((tag) =>
        sql`json_array_length(json_extract(${books.tags}, '$')) > 0 AND ${books.tags} LIKE ${'%"' + tag + '"%'}`
      );
      conditions.push(or(...tagConditions)!);
    }

    // Rating filter
    if (filters.rating && filters.rating !== "all") {
      switch (filters.rating) {
        case "5":
          conditions.push(eq(books.rating, 5));
          break;
        case "4+":
          conditions.push(sql`${books.rating} >= 4`);
          break;
        case "3+":
          conditions.push(sql`${books.rating} >= 3`);
          break;
        case "2+":
          conditions.push(sql`${books.rating} >= 2`);
          break;
        case "1+":
          conditions.push(sql`${books.rating} >= 1`);
          break;
        case "unrated":
          conditions.push(sql`${books.rating} IS NULL`);
          break;
      }
    }

    // Status filter (requires join with sessions)
    let bookIds: number[] | undefined;
    if (filters.status) {
      const statusCondition = eq(readingSessions.status, filters.status as any);
      const activeCondition =
        filters.status === "read"
          ? undefined // For "read", include all sessions
          : eq(readingSessions.isActive, true);

      const sessionQuery = this.getDatabase()
        .select({ bookId: readingSessions.bookId })
        .from(readingSessions)
        .where(activeCondition ? and(statusCondition, activeCondition) : statusCondition);

      const sessions = sessionQuery.all() as Array<{ bookId: number }>;
      bookIds = sessions.map((s: any) => s.bookId);

      if (bookIds.length === 0) {
        return { books: [], total: 0 };
      }

      if (bookIds.length > 0) {
        conditions.push(inArray(books.id, bookIds));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;

    // Determine sort order
    let orderBy: SQL;
    switch (sortBy) {
      case "title":
        orderBy = asc(books.title);
        break;
      case "title_desc":
        orderBy = desc(books.title);
        break;
      case "author":
        orderBy = asc(books.authors);
        break;
      case "author_desc":
        orderBy = desc(books.authors);
        break;
      case "created":
        orderBy = desc(books.createdAt);
        break;
      case "created_desc":
        orderBy = asc(books.createdAt);
        break;
      case "rating":
        // Rating high to low (nulls last)
        orderBy = sql`${books.rating} DESC NULLS LAST`;
        break;
      case "rating_asc":
        // Rating low to high (nulls last)
        orderBy = sql`${books.rating} ASC NULLS LAST`;
        break;
      default:
        orderBy = asc(books.createdAt);
    }

    // Get paginated results
    const results = this.getDatabase()
      .select()
      .from(books)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip)
      .all();

    return { books: results, total };
  }

  /**
   * Update book by calibreId
   */
  async updateByCalibreId(
    calibreId: number,
    data: Partial<NewBook>
  ): Promise<Book | undefined> {
    const result = this.getDatabase()
      .update(books)
      .set(data)
      .where(eq(books.calibreId, calibreId))
      .returning()
      .get();
    return result;
  }

  /**
   * Find books not in a list of calibreIds (for orphaning)
   */
  async findNotInCalibreIds(calibreIds: number[]): Promise<Book[]> {
    if (calibreIds.length === 0) {
      return this.getDatabase().select().from(books).all();
    }

    return this.getDatabase()
      .select()
      .from(books)
      .where(
        and(
          sql`${books.calibreId} NOT IN ${sql.raw(`(${calibreIds.join(",")})`)}`,
          or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)!
        )
      )
      .all();
  }

  /**
   * Mark book as orphaned
   */
  async markAsOrphaned(id: number): Promise<Book | undefined> {
    return this.update(id, {
      orphaned: true,
      orphanedAt: new Date(),
    } as any);
  }

  /**
   * Get all unique tags from all books
   */
  async getAllTags(): Promise<string[]> {
    const allBooks = await this.findAll();
    const tagSet = new Set<string>();

    for (const book of allBooks) {
      if (book.tags && Array.isArray(book.tags)) {
        book.tags.forEach((tag) => tagSet.add(tag));
      }
    }

    return Array.from(tagSet).sort();
  }
}

// Singleton instance
export const bookRepository = new BookRepository();
