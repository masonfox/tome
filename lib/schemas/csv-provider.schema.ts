/**
 * Zod schemas for CSV provider validation
 * Validates that uploaded CSVs have the required columns for Goodreads or TheStoryGraph
 */

import { z } from "zod";

/**
 * Provider type
 */
export const ProviderSchema = z.enum(["goodreads", "storygraph"]);
export type Provider = z.infer<typeof ProviderSchema>;

/**
 * Goodreads CSV required columns
 * Based on spec.md FR-002 Goodreads Column Mapping
 */
export const GoodreadsColumnsSchema = z.object({
  Title: z.string(),
  Author: z.string(),
  "Exclusive Shelf": z.string(),
  // Optional columns
  "Additional Authors": z.string().optional(),
  ISBN: z.string().optional(),
  ISBN13: z.string().optional(),
  "Number of Pages": z.string().optional(),
  "My Rating": z.string().optional(),
  "Date Read": z.string().optional(),
  "My Review": z.string().optional(),
  "Read Count": z.string().optional(),
});

export type GoodreadsColumns = z.infer<typeof GoodreadsColumnsSchema>;

/**
 * TheStoryGraph CSV required columns
 * Based on spec.md FR-002 TheStoryGraph Column Mapping
 */
export const StoryGraphColumnsSchema = z.object({
  Title: z.string(),
  Authors: z.string(),
  "Read Status": z.string(),
  // Optional columns
  "ISBN/UID": z.string().optional(),
  "Star Rating": z.string().optional(),
  "Last Date Read": z.string().optional(),
  "Dates Read": z.string().optional(),
  "Read Count": z.string().optional(),
  Review: z.string().optional(),
});

export type StoryGraphColumns = z.infer<typeof StoryGraphColumnsSchema>;

/**
 * Validate CSV headers against provider schema
 */
export function validateHeaders(
  headers: string[],
  provider: Provider
): { valid: boolean; missingColumns: string[]; error?: string } {
  const headerSet = new Set(headers);

  if (provider === "goodreads") {
    const requiredColumns = ["Title", "Author", "Exclusive Shelf"];
    const missing = requiredColumns.filter((col) => !headerSet.has(col));

    if (missing.length > 0) {
      return {
        valid: false,
        missingColumns: missing,
        error: `Goodreads CSV is missing required columns: ${missing.join(", ")}`,
      };
    }
  } else if (provider === "storygraph") {
    const requiredColumns = ["Title", "Authors", "Read Status"];
    const missing = requiredColumns.filter((col) => !headerSet.has(col));

    if (missing.length > 0) {
      return {
        valid: false,
        missingColumns: missing,
        error: `TheStoryGraph CSV is missing required columns: ${missing.join(", ")}`,
      };
    }
  }

  return { valid: true, missingColumns: [] };
}

/**
 * Detect provider from CSV headers (for informational purposes only - NOT used for auto-detection)
 * Provider must be explicitly specified by user, this is for validation and error messages
 */
export function detectProviderFromHeaders(headers: string[]): Provider | null {
  const headerSet = new Set(headers);

  // Goodreads unique columns
  if (headerSet.has("Exclusive Shelf") && headerSet.has("Author")) {
    return "goodreads";
  }

  // TheStoryGraph unique columns
  if (headerSet.has("Read Status") && headerSet.has("Authors")) {
    return "storygraph";
  }

  return null;
}

/**
 * Provider mismatch error details
 */
export interface ProviderMismatchError {
  expectedProvider: Provider;
  detectedProvider: Provider | null;
  message: string;
  hint: string;
}

/**
 * Check if CSV headers match the declared provider
 * Returns error details if mismatch detected
 */
export function checkProviderMismatch(
  headers: string[],
  declaredProvider: Provider
): ProviderMismatchError | null {
  const detectedProvider = detectProviderFromHeaders(headers);

  if (detectedProvider && detectedProvider !== declaredProvider) {
    return {
      expectedProvider: declaredProvider,
      detectedProvider,
      message: `CSV appears to be from ${detectedProvider} but you selected ${declaredProvider}`,
      hint:
        detectedProvider === "goodreads"
          ? "This CSV has Goodreads columns (Author, Exclusive Shelf). Please select Goodreads as the provider."
          : "This CSV has TheStoryGraph columns (Authors, Read Status). Please select TheStoryGraph as the provider.",
    };
  }

  return null;
}
