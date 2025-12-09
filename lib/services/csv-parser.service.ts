/**
 * CSV Parser Service
 * Handles parsing and normalization of Goodreads and TheStoryGraph CSV exports
 */

import { parse } from "csv-parse/sync";
import {
  Provider,
  validateHeaders,
  checkProviderMismatch,
  GoodreadsColumns,
  StoryGraphColumns,
} from "@/lib/schemas/csv-provider.schema";
import { normalizeISBN } from "@/lib/utils/isbn-normalizer";
import { parseDate, parseDateRange } from "@/lib/utils/date-parser";
import { normalizeAuthors, cleanString } from "@/lib/utils/string-normalizer";
import { stripHtml } from "string-strip-html";

/**
 * Normalized import record (provider-agnostic)
 */
export interface ImportRecord {
  title: string;
  authors: string[];
  isbn?: string;
  isbn13?: string;
  totalPages?: number;
  rating?: number;
  startedDate?: Date;
  completedDate?: Date;
  status: "read" | "currently-reading" | "to-read" | "did-not-finish" | "paused";
  review?: string;
  readCount?: number;
  // Metadata
  rowNumber: number;
  provider: Provider;
}

/**
 * CSV parse result
 */
export interface CSVParseResult {
  records: ImportRecord[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
  errors: CSVParseError[];
}

/**
 * CSV parse error
 */
export interface CSVParseError {
  rowNumber: number;
  field?: string;
  message: string;
  value?: any;
}

/**
 * CSV Parser Service
 */
export class CSVParserService {
  /**
   * Parse CSV file content
   */
  async parseCSV(
    csvContent: string,
    provider: Provider
  ): Promise<CSVParseResult> {
    const result: CSVParseResult = {
      records: [],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
      errors: [],
    };

    try {
      // Parse CSV with csv-parse
      const rawRecords = parse(csvContent, {
        columns: true, // Use first row as headers
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow variable column counts
        cast: false, // Keep everything as strings for now
      });

      if (rawRecords.length === 0) {
        result.errors.push({
          rowNumber: 0,
          message: "CSV file is empty or contains only headers",
        });
        return result;
      }

      result.totalRows = rawRecords.length;

      // Validate headers
      const headers = Object.keys(rawRecords[0] as Record<string, any>);
      const headerValidation = validateHeaders(headers, provider);

      if (!headerValidation.valid) {
        result.errors.push({
          rowNumber: 0,
          message:
            headerValidation.error ||
            `Missing required columns: ${headerValidation.missingColumns.join(", ")}`,
        });
        return result;
      }

      // Check for provider mismatch
      const mismatch = checkProviderMismatch(headers, provider);
      if (mismatch) {
        result.errors.push({
          rowNumber: 0,
          message: mismatch.message,
          field: "provider",
        });
        // This is a warning, not a fatal error - continue parsing
      }

      // Parse each record
      for (let i = 0; i < rawRecords.length; i++) {
        const rowNumber = i + 2; // +2 because row 1 is headers, arrays are 0-indexed
        const rawRow = rawRecords[i];

        try {
          let record: ImportRecord | null = null;

          if (provider === "goodreads") {
            record = this.parseGoodreadsRow(rawRow as Record<string, string>, rowNumber);
          } else if (provider === "storygraph") {
            record = this.parseStoryGraphRow(rawRow as Record<string, string>, rowNumber);
          }

          if (record) {
            result.records.push(record);
            result.validRows++;
          } else {
            result.skippedRows++;
          }
        } catch (error: any) {
          result.errors.push({
            rowNumber,
            message: error.message || "Failed to parse row",
          });
          result.skippedRows++;
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push({
        rowNumber: 0,
        message: `Failed to parse CSV: ${error.message}`,
      });
      return result;
    }
  }

  /**
   * Parse a Goodreads CSV row
   * Based on spec.md FR-002 Goodreads Column Mapping
   */
  parseGoodreadsRow(
    row: Record<string, string>,
    rowNumber: number
  ): ImportRecord | null {
    // Required fields
    const title = cleanString(row["Title"]);
    const author = cleanString(row["Author"]);
    const shelf = cleanString(row["Exclusive Shelf"]);

    if (!title || !author || !shelf) {
      throw new Error("Missing required fields: Title, Author, or Exclusive Shelf");
    }

    // Map shelf to status
    const statusMap: Record<string, ImportRecord["status"]> = {
      "to-read": "to-read",
      "currently-reading": "currently-reading",
      read: "read",
    };

    const status = statusMap[shelf.toLowerCase()];
    if (!status) {
      // Skip invalid statuses
      return null;
    }

    // Parse authors
    const additionalAuthors = row["Additional Authors"];
    const authors = normalizeAuthors(
      additionalAuthors ? `${author},${additionalAuthors}` : author
    );

    // Parse ISBNs (remove Excel wrappers like ="...")
    const isbnRaw = row["ISBN"] || "";
    const isbn13Raw = row["ISBN13"] || "";

    const isbn = this.cleanISBNField(isbnRaw);
    const isbn13 = this.cleanISBNField(isbn13Raw);

    // Parse optional fields
    const totalPages = this.parseInteger(row["Number of Pages"]);
    const rating = this.parseRating(row["My Rating"], 5); // Goodreads uses 0-5
    const startedDate = parseDate(row["Date Added"]);
    const completedDate = parseDate(row["Date Read"]);
    const review = cleanString(row["My Review"]);
    const readCount = this.parseInteger(row["Read Count"]) || 1;

    return {
      title,
      authors,
      isbn,
      isbn13,
      totalPages,
      rating,
      startedDate: startedDate || undefined,
      completedDate: completedDate || undefined,
      status,
      review,
      readCount,
      rowNumber,
      provider: "goodreads",
    };
  }

  /**
   * Parse a TheStoryGraph CSV row
   * Based on spec.md FR-002 TheStoryGraph Column Mapping
   */
  parseStoryGraphRow(
    row: Record<string, string>,
    rowNumber: number
  ): ImportRecord | null {
    // Required fields
    const title = cleanString(row["Title"]);
    const authorsRaw = cleanString(row["Authors"]);
    const readStatus = cleanString(row["Read Status"]);

    if (!title || !authorsRaw || !readStatus) {
      throw new Error("Missing required fields: Title, Authors, or Read Status");
    }

    // Map read status to status
    const statusMap: Record<string, ImportRecord["status"]> = {
      "to-read": "to-read",
      "currently-reading": "currently-reading",
      read: "read",
      "did-not-finish": "did-not-finish",
      paused: "paused",
    };

    const status = statusMap[readStatus.toLowerCase()];
    if (!status) {
      // Skip invalid statuses
      return null;
    }

    // Skip "did-not-finish" status per spec
    if (status === "did-not-finish") {
      return null;
    }

    // Parse authors (comma-separated)
    const authors = normalizeAuthors(authorsRaw);

    // Parse ISBN (may contain non-ISBN identifiers)
    const isbnRaw = row["ISBN/UID"] || "";
    const isbn = this.cleanISBNField(isbnRaw);

    // Parse star rating (0.0-5.0 scale, round to nearest integer)
    const starRating = row["Star Rating"];
    const rating = starRating ? Math.round(parseFloat(starRating)) : undefined;

    // Parse dates - try "Dates Read" first (contains start-end range), fall back to "Last Date Read"
    let startedDate: Date | undefined = undefined;
    let completedDate: Date | undefined = undefined;

    const datesReadStr = row["Dates Read"];
    if (datesReadStr) {
      // Parse date range (e.g., "2024/01/17-2024/01/19")
      const dateRange = parseDateRange(datesReadStr);
      if (dateRange) {
        startedDate = dateRange.startDate;
        completedDate = dateRange.endDate;
      }
    }

    // Fall back to "Last Date Read" if "Dates Read" didn't parse
    if (!completedDate) {
      completedDate = parseDate(row["Last Date Read"]) || undefined;
    }

    // Parse review (strip HTML)
    const reviewRaw = row["Review"] || "";
    const review = reviewRaw ? stripHtml(reviewRaw).result : undefined;

    // Note: We ignore "Read Count" per spec
    const readCount = 1;

    return {
      title,
      authors,
      isbn,
      isbn13: undefined, // TheStoryGraph doesn't provide ISBN13 separately
      totalPages: undefined, // TheStoryGraph doesn't provide page count
      rating,
      startedDate,
      completedDate,
      status,
      review,
      readCount,
      rowNumber,
      provider: "storygraph",
    };
  }

  /**
   * Clean ISBN field (remove Excel wrappers, quotes, etc.)
   */
  private cleanISBNField(isbnRaw: string): string | undefined {
    if (!isbnRaw) return undefined;

    // Remove Excel wrapper like ="..."
    let cleaned = isbnRaw.replace(/^="|"$/g, "");

    // Normalize ISBN
    const normalized = normalizeISBN(cleaned);

    return normalized || undefined;
  }

  /**
   * Parse integer from string
   */
  private parseInteger(value: string | undefined): number | undefined {
    if (!value) return undefined;

    const parsed = parseInt(value.trim(), 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Parse rating from string
   */
  private parseRating(value: string | undefined, maxRating: number): number | undefined {
    if (!value) return undefined;

    const parsed = parseInt(value.trim(), 10);
    if (isNaN(parsed)) return undefined;

    // Validate range
    if (parsed < 0 || parsed > maxRating) return undefined;

    // 0 = unrated
    return parsed === 0 ? undefined : parsed;
  }
}

// Export singleton instance
export const csvParserService = new CSVParserService();
