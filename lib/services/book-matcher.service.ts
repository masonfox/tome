/**
 * Book Matcher Service
 * Matches imported records to existing Calibre books using tiered matching algorithm
 * 
 * Matching Tiers:
 * - Tier 1: Exact ISBN match (100% confidence) with title validation
 * - Tier 2: Fuzzy title + author match using cosine similarity (85-95% confidence)
 * - Tier 3: Levenshtein fallback for typos (70-84% confidence)
 */

import { Book } from "@/lib/db/schema/books";
import { bookRepository } from "@/lib/repositories/book.repository";
import { ImportRecord } from "./csv-parser.service";
import { normalizeISBN, isbnEquals } from "@/lib/utils/isbn-normalizer";
import {
  titleSimilarity,
  authorSimilarity,
} from "@/lib/utils/string-similarity";
import {
  normalizeTitle,
  normalizeAuthors,
} from "@/lib/utils/string-normalizer";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * Match confidence level
 */
export type MatchConfidence = "exact" | "high" | "medium" | "low" | "unmatched";

/**
 * Match reason explaining why this book matched
 */
export type MatchReason =
  | "isbn_match"
  | "title_author_exact"
  | "title_author_high"
  | "title_author_medium"
  | "title_fuzzy"
  | "no_match";

/**
 * Match result for a single import record
 */
export interface MatchResult {
  importRecord: ImportRecord;
  matchedBook: Book | null;
  confidence: MatchConfidence;
  confidenceScore: number; // 0-100
  matchReason: MatchReason;
  alternativeMatches?: Array<{
    book: Book;
    score: number;
  }>;
}

/**
 * Match summary statistics
 */
export interface MatchSummary {
  totalRecords: number;
  exactMatches: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  unmatchedRecords: number;
}

/**
 * Library cache for fast matching
 */
interface LibraryCache {
  books: Book[];
  booksByISBN: Map<string, Book>;
  normalizedTitles: Map<number, string>;
  normalizedAuthors: Map<number, string[]>;
}

/**
 * Book Matcher Service
 */
export class BookMatcherService {
  private cache: LibraryCache | null = null;

  /**
   * Match multiple import records to library books
   */
  async matchRecords(records: ImportRecord[]): Promise<{
    matches: MatchResult[];
    summary: MatchSummary;
  }> {
    logger.info({ recordCount: records.length }, "Starting book matching");

    // Build library cache
    await this.buildLibraryCache();

    const matches: MatchResult[] = [];
    const summary: MatchSummary = {
      totalRecords: records.length,
      exactMatches: 0,
      highConfidenceMatches: 0,
      mediumConfidenceMatches: 0,
      lowConfidenceMatches: 0,
      unmatchedRecords: 0,
    };

    // Match each record
    for (const record of records) {
      const matchResult = await this.matchSingleRecord(record);
      matches.push(matchResult);

      // Update summary
      switch (matchResult.confidence) {
        case "exact":
          summary.exactMatches++;
          break;
        case "high":
          summary.highConfidenceMatches++;
          break;
        case "medium":
          summary.mediumConfidenceMatches++;
          break;
        case "low":
          summary.lowConfidenceMatches++;
          break;
        case "unmatched":
          summary.unmatchedRecords++;
          break;
      }
    }

    logger.info(
      {
        summary,
      },
      "Book matching completed"
    );

    return { matches, summary };
  }

  /**
   * Match a single import record
   */
  private async matchSingleRecord(record: ImportRecord): Promise<MatchResult> {
    if (!this.cache) {
      throw new Error("Library cache not initialized");
    }

    // Tier 1: ISBN matching
    if (record.isbn || record.isbn13) {
      const isbnMatch = this.matchByISBN(record);
      if (isbnMatch) {
        return isbnMatch;
      }
    }

    // Tier 2: Fuzzy title + author matching
    const fuzzyMatch = this.fuzzyMatch(record);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    // No match found
    return {
      importRecord: record,
      matchedBook: null,
      confidence: "unmatched",
      confidenceScore: 0,
      matchReason: "no_match",
    };
  }

  /**
   * Tier 1: Match by ISBN with title validation
   * Confidence: 100% if title similarity >60%
   */
  private matchByISBN(record: ImportRecord): MatchResult | null {
    if (!this.cache) return null;

    // Try ISBN13 first, then ISBN
    const isbns = [record.isbn13, record.isbn].filter(Boolean) as string[];

    for (const isbn of isbns) {
      const normalized = normalizeISBN(isbn);
      if (!normalized) continue;

      // Look up in cache
      const book = this.cache.booksByISBN.get(normalized);
      if (!book) {
        // Try matching with ISBN conversion (ISBN-10 to ISBN-13)
        const matchingBook = this.cache.books.find((b) =>
          isbnEquals(b.isbn, normalized)
        );
        if (matchingBook) {
          // Validate with title similarity
          const titleScore = titleSimilarity(record.title, matchingBook.title);

          if (titleScore >= 0.6) {
            return {
              importRecord: record,
              matchedBook: matchingBook,
              confidence: "exact",
              confidenceScore: 100,
              matchReason: "isbn_match",
            };
          }
        }
        continue;
      }

      // Validate with title similarity (>60% required)
      const titleScore = titleSimilarity(record.title, book.title);

      if (titleScore >= 0.6) {
        return {
          importRecord: record,
          matchedBook: book,
          confidence: "exact",
          confidenceScore: 100,
          matchReason: "isbn_match",
        };
      }
    }

    return null;
  }

  /**
   * Tier 2 & 3: Fuzzy matching using title and author similarity
   * Uses cosine similarity (Tier 2) and Levenshtein fallback (Tier 3)
   */
  private fuzzyMatch(record: ImportRecord): MatchResult | null {
    if (!this.cache) return null;

    const normalizedRecordTitle = normalizeTitle(record.title);
    const normalizedRecordAuthors = normalizeAuthors(record.authors);

    let bestMatch: {
      book: Book;
      score: number;
      reason: MatchReason;
    } | null = null;

    // Check each book in library
    for (const book of this.cache.books) {
      const normalizedBookAuthors =
        this.cache.normalizedAuthors.get(book.id) ||
        normalizeAuthors(book.authors);

      // Calculate title similarity (using raw titles for now)
      const titleScore = titleSimilarity(record.title, book.title);

      // Calculate author similarity
      const authorScore = authorSimilarity(
        normalizedRecordAuthors,
        normalizedBookAuthors
      );

      // Calculate primary author similarity (fuzzy matching instead of exact)
      const primaryAuthorScore =
        normalizedRecordAuthors.length > 0 && normalizedBookAuthors.length > 0
          ? authorSimilarity(
              normalizedRecordAuthors.slice(0, 1),
              normalizedBookAuthors.slice(0, 1)
            )
          : 0;

      // Scoring logic based on spec
      let finalScore = 0;
      let reason: MatchReason = "no_match";

      // High confidence: title ≥90% AND primary author ≥80% (fuzzy match)
      if (
        titleScore >= 0.9 &&
        normalizedRecordAuthors.length > 0 &&
        primaryAuthorScore >= 0.8
      ) {
        finalScore = 95;
        reason = "title_author_exact";
      }

      // High confidence: title ≥95% AND author ≥80%
      if (finalScore === 0 && titleScore >= 0.95 && authorScore >= 0.8) {
        finalScore = 90;
        reason = "title_author_high";
      }

      // Medium-High confidence: title ≥80% (lowered from 85%)
      if (finalScore === 0 && titleScore >= 0.8) {
        finalScore = titleScore * 100;
        reason = "title_author_medium";
      }

      // Low confidence: title ≥65% (Levenshtein fallback, lowered from 70%)
      if (finalScore === 0 && titleScore >= 0.65) {
        finalScore = titleScore * 100;
        reason = "title_fuzzy_relaxed";
      }

      // Tier 4: Substring matching for series books with title prefixes
      // e.g., "The Wishing Spell" matches "The Land of Stories: The Wishing Spell"
      if (finalScore === 0) {
        const normalizedImportTitle = normalizeTitle(record.title);
        const normalizedDbTitle = normalizeTitle(book.title);

        // Check if import title is a significant substring of database title
        if (
          normalizedImportTitle.length >= 10 && // Minimum 10 chars to avoid spurious matches
          normalizedDbTitle.includes(normalizedImportTitle)
        ) {
          // Calculate author overlap to prevent false positives
          const authorScore = authorSimilarity(
            record.authors,
            book.authors
          );

          // Require at least 50% author overlap for substring matches
          if (authorScore >= 0.5) {
            finalScore = 75; // Medium confidence for substring matches
            reason = "substring_title_match";
          }
        }
      }

      // Update best match if this is better
      if (finalScore > 0 && (!bestMatch || finalScore > bestMatch.score)) {
        bestMatch = {
          book,
          score: finalScore,
          reason,
        };
      }
    }

    // Return best match if above threshold
    if (bestMatch) {
      const confidence = this.classifyConfidence(bestMatch.score);

      return {
        importRecord: record,
        matchedBook: bestMatch.book,
        confidence,
        confidenceScore: Math.round(bestMatch.score),
        matchReason: bestMatch.reason,
      };
    }

    return null;
  }

  /**
   * Classify confidence score into categories
   */
  private classifyConfidence(score: number): MatchConfidence {
    if (score >= 95) return "exact";
    if (score >= 80) return "high"; // Lowered from 85% to 80%
    if (score >= 70) return "medium";
    if (score >= 60) return "low";
    return "unmatched";
  }

  /**
   * Build library cache for fast matching
   * Precomputes normalized titles and authors, and indexes by ISBN
   */
  private async buildLibraryCache(): Promise<void> {
    if (this.cache) return; // Already built

    logger.info("Building library cache");

    const books = await bookRepository.findAll();

    const cache: LibraryCache = {
      books,
      booksByISBN: new Map(),
      normalizedTitles: new Map(),
      normalizedAuthors: new Map(),
    };

    // Precompute normalized values and index by ISBN
    for (const book of books) {
      // Index by ISBN
      if (book.isbn) {
        const normalized = normalizeISBN(book.isbn);
        if (normalized) {
          cache.booksByISBN.set(normalized, book);
        }
      }

      // Precompute normalized title
      cache.normalizedTitles.set(book.id, normalizeTitle(book.title));

      // Precompute normalized authors
      cache.normalizedAuthors.set(book.id, normalizeAuthors(book.authors));
    }

    this.cache = cache;

    logger.info(
      {
        bookCount: books.length,
        isbnIndexSize: cache.booksByISBN.size,
      },
      "Library cache built"
    );
  }

  /**
   * Clear the library cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache = null;
  }
}

// Export singleton instance
export const bookMatcherService = new BookMatcherService();
