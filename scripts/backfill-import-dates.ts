/**
 * Backfill Import Dates Script
 * 
 * Fixes bug where imported sessions had NULL startedDate and completedDate.
 * Uses match_results from import_logs to restore the original dates.
 * 
 * Run: bun scripts/backfill-import-dates.ts
 */

import { db } from '../lib/db/sqlite';
import { importLogs } from '../lib/db/schema/import-logs';
import { readingSessions } from '../lib/db/schema/reading-sessions';
import { eq, isNull, and, isNotNull } from 'drizzle-orm';

interface ImportRecord {
  completedDate?: string;
  status: 'read' | 'currently-reading' | 'to-read' | 'did-not-finish' | 'paused';
}

interface MatchResult {
  importRecord: ImportRecord;
  matchedBook: {
    id: number;
    title: string;
  };
}

async function backfillImportDates() {
  console.log('🔧 Starting backfill of import dates...\n');

  // Get all import logs with match results
  const imports = await db
    .select()
    .from(importLogs)
    .where(isNotNull(importLogs.matchResults))
    .execute();

  console.log(`Found ${imports.length} imports with match results\n`);

  let totalSessionsFixed = 0;
  let totalSessionsSkipped = 0;

  for (const importLog of imports) {
    console.log(`\n📦 Processing import #${importLog.id}: ${importLog.fileName}`);

    // Parse match results (already parsed by Drizzle from JSON column)
    const matchResults = (importLog.matchResults as unknown as MatchResult[]);
    console.log(`  - ${matchResults.length} match results found`);

    // Build a map of bookId -> completedDate from match results
    const bookDateMap = new Map<number, { completedDate: Date | null; status: string }>();
    
    for (const match of matchResults) {
      if (!match.matchedBook) continue;

      const completedDate = match.importRecord.completedDate 
        ? new Date(match.importRecord.completedDate) 
        : null;

      bookDateMap.set(match.matchedBook.id, {
        completedDate,
        status: match.importRecord.status,
      });
    }

    console.log(`  - Built date map for ${bookDateMap.size} books`);

    // Find all sessions with NULL dates
    const importTime = new Date(importLog.createdAt * 1000);

    const sessionsToFix = await db
      .select()
      .from(readingSessions)
      .where(
        and(
          isNull(readingSessions.startedDate),
          isNull(readingSessions.completedDate)
        )
      )
      .execute();

    console.log(`  - Found ${sessionsToFix.length} sessions with NULL dates`);

    // Update each session with the correct dates
    let fixed = 0;
    let skipped = 0;

    for (const session of sessionsToFix) {
      const dateInfo = bookDateMap.get(session.bookId);
      
      if (!dateInfo) {
        skipped++;
        continue;
      }

      // Determine dates based on status
      let startedDate: Date | null = null;
      let completedDate: Date | null = null;

      if (session.status === 'read' && dateInfo.completedDate) {
        // For completed reads: set completedDate from import
        completedDate = dateInfo.completedDate;
        startedDate = null; // Unknown when they started
      } else if (session.status === 'reading') {
        // For currently-reading: set startedDate
        startedDate = dateInfo.completedDate || importTime;
        completedDate = null;
      }
      // For 'to-read': leave both as null

      if (startedDate || completedDate) {
        await db
          .update(readingSessions)
          .set({
            startedDate: startedDate || null,
            completedDate: completedDate || null,
          })
          .where(eq(readingSessions.id, session.id))
          .execute();

        fixed++;
      } else {
        skipped++;
      }
    }

    console.log(`  ✅ Fixed ${fixed} sessions`);
    console.log(`  ⏭️  Skipped ${skipped} sessions (to-read or no date available)`);

    totalSessionsFixed += fixed;
    totalSessionsSkipped += skipped;
  }

  console.log(`\n✨ Backfill complete!`);
  console.log(`📊 Summary:`);
  console.log(`   - Total sessions fixed: ${totalSessionsFixed}`);
  console.log(`   - Total sessions skipped: ${totalSessionsSkipped}`);
  console.log(`\n✅ All import dates have been backfilled.\n`);
}

// Run the script
backfillImportDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  });
