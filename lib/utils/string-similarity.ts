/**
 * String similarity utilities for book matching
 * Uses a hybrid approach: Cosine similarity (primary) + Levenshtein distance (fallback)
 */

import { distance as levenshteinDistance } from "fastest-levenshtein";

/**
 * Tokenize a string into words (lowercase, trimmed)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Calculate term frequency for a list of tokens
 */
function calculateTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

/**
 * Calculate cosine similarity between two strings
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function cosineSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const tf1 = calculateTermFrequency(tokens1);
  const tf2 = calculateTermFrequency(tokens2);

  // Get union of all terms
  const allTerms = new Set([...Array.from(tf1.keys()), ...Array.from(tf2.keys())]);

  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (const term of Array.from(allTerms)) {
    const freq1 = tf1.get(term) || 0;
    const freq2 = tf2.get(term) || 0;

    dotProduct += freq1 * freq2;
    magnitude1 += freq1 * freq1;
    magnitude2 += freq2 * freq2;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate normalized Levenshtein similarity
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function levenshteinSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const lower1 = text1.toLowerCase();
  const lower2 = text2.toLowerCase();

  const distance = levenshteinDistance(lower1, lower2);
  const maxLength = Math.max(lower1.length, lower2.length);

  if (maxLength === 0) return 1;

  return 1 - distance / maxLength;
}

/**
 * Hybrid similarity score using both cosine and Levenshtein
 * Cosine is better for word-order-independent matching
 * Levenshtein is better for typos and minor variations
 *
 * Weights: 70% cosine, 30% Levenshtein
 */
export function hybridSimilarity(text1: string, text2: string): number {
  const cosine = cosineSimilarity(text1, text2);
  const levenshtein = levenshteinSimilarity(text1, text2);

  return cosine * 0.7 + levenshtein * 0.3;
}

/**
 * Compare author arrays for similarity
 * Handles cases where author order differs or names are slightly different
 */
export function authorSimilarity(
  authors1: string[],
  authors2: string[]
): number {
  if (authors1.length === 0 || authors2.length === 0) return 0;

  // Normalize author names (join into single string for comparison)
  const authorsStr1 = authors1.map((a) => a.toLowerCase().trim()).join(" ");
  const authorsStr2 = authors2.map((a) => a.toLowerCase().trim()).join(" ");

  return hybridSimilarity(authorsStr1, authorsStr2);
}

/**
 * Check if two strings are similar enough to be considered a match
 * Default threshold: 0.85 (85% similarity)
 */
export function isSimilar(
  text1: string,
  text2: string,
  threshold: number = 0.85
): boolean {
  return hybridSimilarity(text1, text2) >= threshold;
}

/**
 * Find the best match for a target string from a list of candidates
 * Returns the best match and its similarity score, or null if no match meets threshold
 */
export function findBestMatch(
  target: string,
  candidates: string[],
  threshold: number = 0.85
): { match: string; score: number } | null {
  if (candidates.length === 0) return null;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = hybridSimilarity(target, candidate);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Calculate Jaccard similarity (intersection over union) for token sets
 * Useful for comparing sets of tags or genres
 */
export function jaccardSimilarity(set1: string[], set2: string[]): number {
  if (set1.length === 0 || set2.length === 0) return 0;

  const s1 = new Set(set1.map((s) => s.toLowerCase().trim()));
  const s2 = new Set(set2.map((s) => s.toLowerCase().trim()));

  const intersection = new Set(Array.from(s1).filter((x) => s2.has(x)));
  const union = new Set([...Array.from(s1), ...Array.from(s2)]);

  return intersection.size / union.size;
}

/**
 * Compare book titles with special handling for subtitles and series info
 * Extracts main title (before colon or parenthesis) for comparison
 */
export function titleSimilarity(title1: string, title2: string): number {
  // First try full title comparison
  const fullScore = hybridSimilarity(title1, title2);

  // Extract main title (everything before colon or parenthesis)
  const extractMainTitle = (title: string): string => {
    const match = title.match(/^[^:()]+/);
    return match ? match[0].trim() : title;
  };

  const main1 = extractMainTitle(title1);
  const main2 = extractMainTitle(title2);

  // If main titles are different from full titles, compare main titles too
  if (main1 !== title1 || main2 !== title2) {
    const mainScore = hybridSimilarity(main1, main2);
    // Return the higher of the two scores
    return Math.max(fullScore, mainScore);
  }

  return fullScore;
}
