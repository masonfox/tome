/**
 * String normalization utilities for book matching
 * Handles cleaning, trimming, and normalizing titles and author names
 */

import { stripHtml } from "string-strip-html";

/**
 * Common English stopwords to remove from titles for better matching
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "is",
  "it",
  "no",
  "not",
  "of",
  "on",
  "or",
  "such",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
]);

/**
 * Normalize whitespace: collapse multiple spaces/tabs/newlines into single space
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Remove HTML tags from text
 */
function removeHTML(text: string): string {
  const result = stripHtml(text);
  return result.result;
}

/**
 * Remove special characters but keep letters, numbers, and basic punctuation
 */
function removeSpecialChars(text: string): string {
  // Keep: letters, numbers, spaces, hyphens, apostrophes, periods, commas
  return text.replace(/[^a-z0-9\s\-'.,]/gi, "");
}

/**
 * Remove common stopwords from text
 */
function removeStopwords(text: string): string {
  const words = text.split(/\s+/);
  const filtered = words.filter((word) => !STOPWORDS.has(word.toLowerCase()));
  return filtered.join(" ");
}

/**
 * Normalize a book title for matching
 * - Converts to lowercase
 * - Removes HTML tags
 * - Removes special characters
 * - Normalizes whitespace
 * - Optionally removes stopwords
 */
export function normalizeTitle(
  title: string | null | undefined,
  options: {
    removeStopwords?: boolean;
    removeSubtitle?: boolean;
  } = {}
): string {
  if (!title) return "";

  let normalized = title;

  // Remove HTML tags
  normalized = removeHTML(normalized);

  // Remove subtitle if requested (everything after colon or dash)
  if (options.removeSubtitle) {
    const match = normalized.match(/^[^:—–-]+/);
    if (match) {
      normalized = match[0];
    }
  }

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Remove special characters
  normalized = removeSpecialChars(normalized);

  // Normalize whitespace
  normalized = normalizeWhitespace(normalized);

  // Remove stopwords if requested
  if (options.removeStopwords) {
    normalized = removeStopwords(normalized);
  }

  return normalized.trim();
}

/**
 * Normalize an author name for matching
 * - Converts to lowercase
 * - Removes HTML tags
 * - Handles "Last, First" format
 * - Removes special characters
 * - Normalizes whitespace
 */
export function normalizeAuthor(author: string | null | undefined): string {
  if (!author) return "";

  let normalized = author;

  // Remove HTML tags
  normalized = removeHTML(normalized);

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Handle "Last, First" format - convert to "First Last"
  const commaMatch = normalized.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) {
    normalized = `${commaMatch[2]} ${commaMatch[1]}`;
  }

  // Remove special characters
  normalized = removeSpecialChars(normalized);

  // Normalize whitespace
  normalized = normalizeWhitespace(normalized);

  return normalized.trim();
}

/**
 * Normalize an array of authors
 */
export function normalizeAuthors(
  authors: string[] | string | null | undefined
): string[] {
  if (!authors) return [];

  // Handle single string (comma or semicolon separated)
  if (typeof authors === "string") {
    const split = authors.split(/[,;]+/);
    return split.map(normalizeAuthor).filter((a) => a.length > 0);
  }

  // Handle array
  return authors.map(normalizeAuthor).filter((a) => a.length > 0);
}

/**
 * Normalize a series name for matching
 */
export function normalizeSeries(series: string | null | undefined): string {
  if (!series) return "";

  let normalized = series;

  // Remove HTML tags
  normalized = removeHTML(normalized);

  // Remove series number/index (e.g., "#1", "Book 1", etc.)
  normalized = normalized.replace(/\s*[#]\s*\d+/gi, "");
  normalized = normalized.replace(/\s*book\s+\d+/gi, "");
  normalized = normalized.replace(/\s*vol(?:ume)?\s*\.?\s*\d+/gi, "");

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Remove special characters
  normalized = removeSpecialChars(normalized);

  // Normalize whitespace
  normalized = normalizeWhitespace(normalized);

  return normalized.trim();
}

/**
 * Extract series index from series string
 * Examples: "The Hobbit #1" -> 1, "Book 2" -> 2
 */
export function extractSeriesIndex(
  series: string | null | undefined
): number | null {
  if (!series) return null;

  // Match patterns like "#1", "Book 1", "Vol. 1", "Volume 1"
  const patterns = [
    /#\s*(\d+)/i,
    /book\s+(\d+)/i,
    /vol(?:ume)?\s*\.?\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = series.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Clean and trim a general string
 * Useful for fields like publisher, ISBN, etc.
 */
export function cleanString(text: string | null | undefined): string {
  if (!text) return "";

  let cleaned = text;

  // Remove HTML tags
  cleaned = removeHTML(cleaned);

  // Normalize whitespace
  cleaned = normalizeWhitespace(cleaned);

  return cleaned.trim();
}

/**
 * Normalize a tag for comparison
 */
export function normalizeTag(tag: string | null | undefined): string {
  if (!tag) return "";

  let normalized = tag;

  // Remove HTML tags
  normalized = removeHTML(normalized);

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Remove special characters except hyphens
  normalized = normalized.replace(/[^a-z0-9\s-]/gi, "");

  // Normalize whitespace and replace spaces with hyphens
  normalized = normalizeWhitespace(normalized);
  normalized = normalized.replace(/\s+/g, "-");

  return normalized.trim();
}

/**
 * Normalize an array of tags
 */
export function normalizeTags(
  tags: string[] | string | null | undefined
): string[] {
  if (!tags) return [];

  // Handle single string (comma or semicolon separated)
  if (typeof tags === "string") {
    const split = tags.split(/[,;]+/);
    return split.map(normalizeTag).filter((t) => t.length > 0);
  }

  // Handle array
  return tags.map(normalizeTag).filter((t) => t.length > 0);
}

/**
 * Check if two strings are equal after normalization
 */
export function areNormalizedEqual(
  str1: string | null | undefined,
  str2: string | null | undefined,
  normalizer: (s: string | null | undefined) => string = cleanString
): boolean {
  return normalizer(str1) === normalizer(str2);
}

/**
 * Remove common title prefixes for better sorting/matching
 * Examples: "The Lord of the Rings" -> "Lord of the Rings"
 */
export function removeTitlePrefix(title: string | null | undefined): string {
  if (!title) return "";

  const normalized = title.trim();
  const prefixes = ["a ", "an ", "the "];

  for (const prefix of prefixes) {
    if (normalized.toLowerCase().startsWith(prefix)) {
      return normalized.substring(prefix.length);
    }
  }

  return normalized;
}
