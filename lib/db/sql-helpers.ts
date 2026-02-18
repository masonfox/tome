/**
 * Shared SQL helpers for Drizzle ORM queries.
 *
 * Centralizes common SQL patterns used across repositories to eliminate
 * duplication and ensure consistency.
 *
 * @module lib/db/sql-helpers
 */

import { sql, eq, or, type SQL, type Column } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";

// ---------------------------------------------------------------------------
// Date GLOB validation
// ---------------------------------------------------------------------------

/**
 * SQLite GLOB pattern that matches YYYY-MM-DD date strings.
 *
 * Used as a **defense-in-depth** guard in SQL queries to reject malformed
 * date values (e.g., Unix timestamps stored as text) before applying
 * `strftime()` or other date functions.
 *
 * Migration 0016 converts existing timestamps to YYYY-MM-DD strings, but
 * data imported *after* migration (bulk sync, local creation) could still
 * contain non-date values. This GLOB ensures queries degrade gracefully
 * instead of producing incorrect results.
 *
 * The pattern matches exactly 10 characters (YYYY-MM-DD) with no trailing
 * wildcard — ISO datetime strings like `2026-02-09T10:30:00` are rejected.
 * This is correct for Tome, where all date columns store calendar days only.
 *
 * @see {@link isValidDateFormat} — helper that builds the full SQL clause
 * @see docs/ADRs/ADR-014-DATE-STRING-STORAGE.md
 */
export const DATE_GLOB_PATTERN =
  "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";

/**
 * Returns a SQL clause that validates a column contains a YYYY-MM-DD date
 * string using SQLite's GLOB operator.
 *
 * Use this **before** any `strftime()`, `substr()`, or lexicographic date
 * comparison on date TEXT columns (`progressDate`, `startedDate`,
 * `completedDate`).
 *
 * @param column - A Drizzle column reference (e.g., `progressLogs.progressDate`)
 * @returns A Drizzle `SQL` fragment: `column GLOB '[0-9]...[0-9]'`
 *
 * @example
 * ```ts
 * import { isValidDateFormat } from "@/lib/db/sql-helpers";
 *
 * .where(
 *   and(
 *     isValidDateFormat(progressLogs.progressDate),
 *     sql`strftime('%Y', ${progressLogs.progressDate}) = ${year.toString()}`
 *   )
 * )
 * ```
 */
export function isValidDateFormat(column: Column): SQL {
  return sql`${column} GLOB '${sql.raw(DATE_GLOB_PATTERN)}'`;
}

// ---------------------------------------------------------------------------
// Orphaned book filter
// ---------------------------------------------------------------------------

/**
 * Returns a SQL clause that excludes orphaned books.
 *
 * Handles both `orphaned = false` and `orphaned IS NULL` (for rows
 * created before the orphaned column was added, or where the default
 * hasn't been applied).
 *
 * @returns A Drizzle `SQL` fragment: `(orphaned = false OR orphaned IS NULL)`
 *
 * @example
 * ```ts
 * import { isNotOrphaned } from "@/lib/db/sql-helpers";
 *
 * .where(
 *   and(
 *     eq(readingSessions.status, "read"),
 *     isNotOrphaned()
 *   )
 * )
 * ```
 */
export function isNotOrphaned(): SQL {
  return or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)!;
}
