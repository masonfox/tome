import { z } from "zod";

/**
 * Zod Validation Schemas for Progress API
 * 
 * Enforces API contracts at the route level with clear error messages.
 * All dates must be in YYYY-MM-DD format.
 */

/**
 * Date string validator
 * 
 * Ensures date is:
 * - In YYYY-MM-DD format
 * - A valid calendar date
 * - Not malformed (e.g., "2025-02-31")
 */
const dateStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be in YYYY-MM-DD format (e.g., '2025-01-08')"
  )
  .refine(
    (dateStr) => {
      // Verify it's a valid date
      const date = new Date(dateStr + "T00:00:00");
      if (isNaN(date.getTime())) {
        return false;
      }

      // Verify parsed date matches input (prevents "2025-02-31" → "2025-03-03")
      const [year, month, day] = dateStr.split("-").map(Number);
      return (
        date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        date.getDate() === day
      );
    },
    { message: "Date must be a valid calendar date" }
  );

/**
 * Create Progress Request Schema
 * 
 * Used for POST /api/books/[id]/progress
 * 
 * Rules:
 * - Must provide either currentPage OR currentPercentage
 * - progressDate is optional (defaults to today)
 * - notes is optional
 */
export const createProgressSchema = z.object({
  currentPage: z.number().int().positive().optional(),
  currentPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  progressDate: dateStringSchema.optional(),
}).refine(
  (data) => data.currentPage !== undefined || data.currentPercentage !== undefined,
  {
    message: "Must provide either currentPage or currentPercentage",
  }
);

export type CreateProgressRequest = z.infer<typeof createProgressSchema>;

/**
 * Update Progress Request Schema
 * 
 * Used for PATCH /api/books/[id]/progress/[progressId]
 * 
 * Rules:
 * - All fields optional (partial update)
 * - At least one field must be provided
 */
export const updateProgressSchema = z.object({
  currentPage: z.number().int().positive().optional(),
  currentPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  progressDate: dateStringSchema.optional(),
}).refine(
  (data) => {
    // At least one field must be provided
    return (
      data.currentPage !== undefined ||
      data.currentPercentage !== undefined ||
      data.notes !== undefined ||
      data.progressDate !== undefined
    );
  },
  {
    message: "Must provide at least one field to update",
  }
);

export type UpdateProgressRequest = z.infer<typeof updateProgressSchema>;
