/**
 * Journal API Types
 * 
 * Request and response types for journal-related API endpoints.
 */

/**
 * Individual journal entry (progress log)
 */
export interface JournalEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;  // YYYY-MM-DD format
  notes: string | null;
  pagesRead: number;
}

/**
 * Grouped journal entry (entries grouped by date and book)
 */
export interface GroupedJournalEntry {
  date: string; // YYYY-MM-DD
  books: {
    bookId: number;
    bookTitle: string;
    bookAuthors: string[];
    bookCalibreId: number | null;
    bookLastSynced?: Date | string | null;
    entries: JournalEntry[];
  }[];
}

/**
 * Archive tree node for hierarchical date navigation
 */
export interface ArchiveNode {
  id: string; // Unique identifier (e.g., "2024", "2024-11", "2024-11-W3")
  type: "year" | "month" | "week";
  label: string; // Display text (e.g., "2024", "November", "Week 3 (Nov 15-21)")
  dateKey: string; // Key to match against journal entries
  startDate: string; // YYYY-MM-DD for this period's start
  endDate: string; // YYYY-MM-DD for this period's end (inclusive)
  count: number; // Total entry count in this period
  children?: ArchiveNode[]; // Child nodes (e.g., months within a year)
}

/**
 * Request parameters for listing journal entries
 */
export interface ListJournalEntriesRequest {
  timezone?: string;
  limit?: number;
  skip?: number;
}

/**
 * Response from listing journal entries
 */
export interface ListJournalEntriesResponse {
  entries: GroupedJournalEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Request parameters for getting archive metadata
 */
export interface GetArchiveRequest {
  timezone?: string;
}

/**
 * Response from getting archive metadata
 */
export type GetArchiveResponse = ArchiveNode[];
