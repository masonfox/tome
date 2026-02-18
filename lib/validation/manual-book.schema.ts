/**
 * Manual Book Validation Schemas
 * 
 * Zod schemas for validating manual book input.
 * 
 * See: specs/003-non-calibre-books/spec.md (FR-007: Manual book addition)
 */

import { z } from "zod";

/**
 * Manual book creation schema
 * 
 * Required fields:
 * - title: Non-empty string
 * - authors: Array of at least one non-empty string
 * 
 * Optional fields:
 * - isbn: Valid ISBN-10 or ISBN-13 format
 * - description: String
 * - publisher: String
 * - pubDate: ISO date string or Date object
 * - totalPages: Integer between 1 and 10000
 * - series: String
 * - seriesIndex: Positive number
 * - tags: Array of strings
 */
export const manualBookSchema = z.object({
  // Required fields
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  authors: z
    .array(z.string().min(1, "Author name cannot be empty"))
    .min(1, "At least one author is required")
    .max(20, "Too many authors"),

  // Optional fields
  isbn: z
    .string()
    .regex(
      /^(?:\d{9}[\dX]|\d{13})$/,
      "Invalid ISBN format (must be ISBN-10 or ISBN-13)"
    )
    .optional(),

  description: z.string().max(10000, "Description too long").optional(),

  publisher: z.string().max(200, "Publisher name too long").optional(),

  pubDate: z
    .union([z.string().datetime(), z.date()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val))
    .optional(),

  totalPages: z
    .number()
    .int("Page count must be an integer")
    .min(1, "Page count must be at least 1")
    .max(10000, "Page count too large")
    .optional(),

  series: z.string().max(200, "Series name too long").optional(),

  seriesIndex: z
    .number()
    .positive("Series index must be positive")
    .max(1000, "Series index too large")
    .optional(),

  tags: z
    .array(z.string().min(1, "Tag cannot be empty").max(50, "Tag too long"))
    .max(50, "Too many tags")
    .optional(),

  coverImageUrl: z
    .string()
    .url("Invalid cover image URL")
    .max(2000, "Cover image URL too long")
    .optional(),
});

/**
 * Manual book update schema
 * 
 * Same as creation schema but all fields optional (partial update support)
 */
export const manualBookUpdateSchema = manualBookSchema.partial();

/**
 * Type inference from schema
 */
export type ManualBookInput = z.infer<typeof manualBookSchema>;
export type ManualBookUpdate = z.infer<typeof manualBookUpdateSchema>;

/**
 * Validation helper - returns parsed data or throws ZodError
 */
export function validateManualBookInput(data: unknown): ManualBookInput {
  return manualBookSchema.parse(data);
}

/**
 * Safe validation helper - returns { success: true, data } or { success: false, errors }
 */
export function validateManualBookInputSafe(data: unknown):
  | { success: true; data: ManualBookInput }
  | { success: false; errors: z.ZodError } {
  const result = manualBookSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
