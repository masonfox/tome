/**
 * Local Book Validation Schemas
 * 
 * Zod schemas for validating local book input.
 * 
 * See: specs/003-non-calibre-books/spec.md (FR-007: Local book addition)
 */

import { z } from "zod";

/**
 * Local book creation schema
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
export const localBookSchema = z.object({
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
 * Local book update schema
 * 
 * Same as creation schema but all fields optional (partial update support)
 */
export const localBookUpdateSchema = localBookSchema.partial();

/**
 * Type inference from schema
 */
export type LocalBookInput = z.infer<typeof localBookSchema>;
export type LocalBookUpdate = z.infer<typeof localBookUpdateSchema>;

/**
 * Validation helper - returns parsed data or throws ZodError
 */
export function validateLocalBookInput(data: unknown): LocalBookInput {
  return localBookSchema.parse(data);
}

/**
 * Safe validation helper - returns { success: true, data } or { success: false, errors }
 */
export function validateLocalBookInputSafe(data: unknown):
  | { success: true; data: LocalBookInput }
  | { success: false; errors: z.ZodError } {
  const result = localBookSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
