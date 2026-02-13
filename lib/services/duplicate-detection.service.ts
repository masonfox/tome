/**
 * Duplicate Detection Service
 * 
 * Detects potential duplicate books using Levenshtein distance algorithm.
 * Used during manual book creation to warn users of possible duplicates.
 * 
 * See: specs/003-non-calibre-books/spec.md (FR-009: Duplicate book detection)
 */

import { getLogger } from "@/lib/logger";
import { bookRepository, bookSourceRepository } from "@/lib/repositories";

const logger = getLogger().child({ module: "duplicate-detection" });

/**
 * Levenshtein distance threshold for duplicate detection
 * 
 * Similarity score above this threshold triggers duplicate warning.
 * Range: 0-100, where 100 = identical strings
 */
const SIMILARITY_THRESHOLD = 85;

/**
 * Potential duplicate book
 */
export interface PotentialDuplicate {
  bookId: number;
  title: string;
  authors: string[];
  source: string;
  similarity: number;
}

/**
 * Duplicate detection result
 */
export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  duplicates: PotentialDuplicate[];
}

/**
 * Calculate Levenshtein distance between two strings
 * 
 * Returns the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into the other.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Levenshtein distance (lower = more similar)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two strings
 * 
 * Uses Levenshtein distance to compute similarity as a percentage.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Similarity percentage (0-100, where 100 = identical)
 */
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  
  if (maxLength === 0) {
    return 100; // Both strings empty
  }
  
  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.round(similarity * 100) / 100; // Round to 2 decimal places
}

/**
 * Normalize book title for comparison
 * 
 * Removes articles, punctuation, and extra whitespace for better matching.
 * 
 * @param title - Book title
 * @returns Normalized title
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "") // Remove leading articles
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Normalize author name for comparison
 * 
 * @param author - Author name
 * @returns Normalized author name
 */
function normalizeAuthor(author: string): string {
  return author
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if authors match
 * 
 * Returns true if there's significant overlap in author names.
 * 
 * @param authors1 - First author list
 * @param authors2 - Second author list
 * @returns True if authors match
 */
function authorsMatch(authors1: string[], authors2: string[]): boolean {
  const normalized1 = authors1.map(normalizeAuthor);
  const normalized2 = authors2.map(normalizeAuthor);
  
  // Check for exact matches
  for (const author1 of normalized1) {
    for (const author2 of normalized2) {
      if (author1 === author2) {
        return true;
      }
      
      // Check for high similarity (>90%)
      const similarity = calculateSimilarity(author1, author2);
      if (similarity > 90) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Detect potential duplicate books
 * 
 * Searches for existing books with similar titles and matching authors.
 * Uses Levenshtein distance with configurable similarity threshold.
 * 
 * @param title - Book title to check
 * @param authors - Book authors to check
 * @param excludeBookId - Optional book ID to exclude (for updates)
 * @returns Detection result with list of potential duplicates
 */
export async function detectDuplicates(
  title: string,
  authors: string[],
  excludeBookId?: number
): Promise<DuplicateDetectionResult> {
  logger.debug({ title, authors, excludeBookId }, "Detecting duplicates");

  const normalizedTitle = normalizeTitle(title);
  const duplicates: PotentialDuplicate[] = [];

  // Fetch all books for comparison
  // TODO: Optimize with fuzzy search or title index for large libraries (>10k books)
  const allBooks = await bookRepository.findAll();

  for (const book of allBooks) {
    // Skip excluded book (for update scenarios)
    if (excludeBookId && book.id === excludeBookId) {
      continue;
    }

    // Calculate title similarity
    const bookNormalizedTitle = normalizeTitle(book.title);
    const titleSimilarity = calculateSimilarity(normalizedTitle, bookNormalizedTitle);

    // Check if similarity exceeds threshold
    if (titleSimilarity >= SIMILARITY_THRESHOLD) {
      // Check if authors match
      if (authorsMatch(authors, book.authors)) {
        // Determine book source
        const sources = await bookSourceRepository.findByBookId(book.id);
        const source = sources.length > 0 ? sources[0].providerId : "manual";
        
        duplicates.push({
          bookId: book.id,
          title: book.title,
          authors: book.authors,
          source,
          similarity: titleSimilarity,
        });

        logger.info(
          {
            inputTitle: title,
            existingTitle: book.title,
            similarity: titleSimilarity,
            bookId: book.id,
            source,
          },
          "Potential duplicate detected"
        );
      }
    }
  }

  // Sort duplicates by similarity (highest first)
  duplicates.sort((a, b) => b.similarity - a.similarity);

  const result: DuplicateDetectionResult = {
    hasDuplicates: duplicates.length > 0,
    duplicates,
  };

  logger.debug(
    { title, duplicateCount: duplicates.length },
    "Duplicate detection complete"
  );

  return result;
}

/**
 * Check if a specific book pair is likely a duplicate
 * 
 * Convenience method for one-to-one comparison.
 * 
 * @param title1 - First book title
 * @param authors1 - First book authors
 * @param title2 - Second book title
 * @param authors2 - Second book authors
 * @returns True if books are likely duplicates
 */
export function areBooksLikelyDuplicates(
  title1: string,
  authors1: string[],
  title2: string,
  authors2: string[]
): boolean {
  const normalizedTitle1 = normalizeTitle(title1);
  const normalizedTitle2 = normalizeTitle(title2);
  
  const titleSimilarity = calculateSimilarity(normalizedTitle1, normalizedTitle2);
  
  return titleSimilarity >= SIMILARITY_THRESHOLD && authorsMatch(authors1, authors2);
}

/**
 * Export internal functions for testing
 * 
 * @internal
 */
export const _testing = {
  levenshteinDistance,
  calculateSimilarity,
  normalizeTitle,
  normalizeAuthor,
  authorsMatch,
  SIMILARITY_THRESHOLD,
};
