import { eq, desc, and, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  importUnmatchedRecords,
  ImportUnmatchedRecord,
  NewImportUnmatchedRecord,
} from "@/lib/db/schema/import-unmatched-records";

type MatchReason =
  | "no_isbn"
  | "isbn_not_found"
  | "no_title_match"
  | "ambiguous_match"
  | "not_in_library"
  | "invalid_data";

export class ImportUnmatchedRecordRepository extends BaseRepository<
  ImportUnmatchedRecord,
  NewImportUnmatchedRecord,
  typeof importUnmatchedRecords
> {
  constructor() {
    super(importUnmatchedRecords);
  }

  /**
   * Find unmatched records by import log ID
   */
  async findByImportLogId(importLogId: number): Promise<ImportUnmatchedRecord[]> {
    return this.getDatabase()
      .select()
      .from(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.importLogId, importLogId))
      .orderBy(desc(importUnmatchedRecords.createdAt))
      .all();
  }

  /**
   * Find unmatched records by match reason
   */
  async findByMatchReason(reason: MatchReason): Promise<ImportUnmatchedRecord[]> {
    return this.getDatabase()
      .select()
      .from(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.matchReason, reason))
      .orderBy(desc(importUnmatchedRecords.createdAt))
      .all();
  }

  /**
   * Find unmatched records by import log ID and match reason
   */
  async findByImportLogIdAndReason(
    importLogId: number,
    reason: MatchReason
  ): Promise<ImportUnmatchedRecord[]> {
    return this.getDatabase()
      .select()
      .from(importUnmatchedRecords)
      .where(
        and(
          eq(importUnmatchedRecords.importLogId, importLogId),
          eq(importUnmatchedRecords.matchReason, reason)
        )
      )
      .orderBy(desc(importUnmatchedRecords.createdAt))
      .all();
  }

  /**
   * Count unmatched records by import log ID
   */
  async countByImportLogId(importLogId: number): Promise<number> {
    const result = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.importLogId, importLogId))
      .get();
    return result?.count ?? 0;
  }

  /**
   * Get match reason statistics for an import log
   */
  async getMatchReasonStats(importLogId: number): Promise<
    Array<{
      reason: string;
      count: number;
    }>
  > {
    const results = this.getDatabase()
      .select({
        reason: importUnmatchedRecords.matchReason,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.importLogId, importLogId))
      .groupBy(importUnmatchedRecords.matchReason)
      .orderBy(desc(sql`count(*)`))
      .all();

    return results.map((r) => ({
      reason: r.reason,
      count: r.count,
    }));
  }

  /**
   * Bulk create unmatched records
   */
  async bulkCreate(
    records: NewImportUnmatchedRecord[]
  ): Promise<ImportUnmatchedRecord[]> {
    if (records.length === 0) {
      return [];
    }

    const result = this.getDatabase()
      .insert(importUnmatchedRecords)
      .values(records)
      .returning()
      .all() as unknown as ImportUnmatchedRecord[];

    return result;
  }

  /**
   * Delete all unmatched records for an import log
   */
  async deleteByImportLogId(importLogId: number): Promise<number> {
    const result = this.getDatabase()
      .delete(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.importLogId, importLogId))
      .run() as unknown as { changes: number };
    return result.changes;
  }
}

// Singleton instance
export const importUnmatchedRecordRepository =
  new ImportUnmatchedRecordRepository();
