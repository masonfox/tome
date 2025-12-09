import { eq, desc, and, sql, SQL } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { importLogs, ImportLog, NewImportLog } from "@/lib/db/schema/import-logs";

type ImportStatus = "pending" | "processing" | "success" | "partial" | "failed";
type ImportProvider = "goodreads" | "storygraph";

export class ImportLogRepository extends BaseRepository<
  ImportLog,
  NewImportLog,
  typeof importLogs
> {
  constructor() {
    super(importLogs);
  }

  /**
   * Find import logs by user ID, ordered by most recent first
   */
  async findByUserId(userId: number, limit: number = 50): Promise<ImportLog[]> {
    return this.getDatabase()
      .select()
      .from(importLogs)
      .where(eq(importLogs.userId, userId))
      .orderBy(desc(importLogs.createdAt))
      .limit(limit)
      .all();
  }

  /**
   * Find import logs by status
   */
  async findByStatus(status: ImportStatus): Promise<ImportLog[]> {
    return this.getDatabase()
      .select()
      .from(importLogs)
      .where(eq(importLogs.status, status))
      .orderBy(desc(importLogs.createdAt))
      .all();
  }

  /**
   * Find import logs by provider
   */
  async findByProvider(provider: ImportProvider): Promise<ImportLog[]> {
    return this.getDatabase()
      .select()
      .from(importLogs)
      .where(eq(importLogs.provider, provider))
      .orderBy(desc(importLogs.createdAt))
      .all();
  }

  /**
   * Find import logs by user ID and status
   */
  async findByUserIdAndStatus(
    userId: number,
    status: ImportStatus
  ): Promise<ImportLog[]> {
    return this.getDatabase()
      .select()
      .from(importLogs)
      .where(and(eq(importLogs.userId, userId), eq(importLogs.status, status)))
      .orderBy(desc(importLogs.createdAt))
      .all();
  }

  /**
   * Get the most recent import log for a user
   */
  async findMostRecentByUserId(userId: number): Promise<ImportLog | undefined> {
    return this.getDatabase()
      .select()
      .from(importLogs)
      .where(eq(importLogs.userId, userId))
      .orderBy(desc(importLogs.createdAt))
      .limit(1)
      .get();
  }

  /**
   * Check if an import is currently in progress for a user
   */
  async hasInProgressImport(userId: number): Promise<boolean> {
    const result = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(importLogs)
      .where(
        and(
          eq(importLogs.userId, userId),
          eq(importLogs.status, "processing")
        )
      )
      .get();
    return (result?.count ?? 0) > 0;
  }

  /**
   * Update import log status and related fields
   */
  async updateStatus(
    id: number,
    status: ImportStatus,
    updates: Partial<NewImportLog> = {}
  ): Promise<ImportLog | undefined> {
    const data: Partial<NewImportLog> = {
      status,
      ...updates,
    };

    // Set completedAt if status is success, partial, or failed
    if (status === "success" || status === "partial" || status === "failed") {
      data.completedAt = new Date();
    }

    return this.update(id, data);
  }

  /**
   * Get import statistics for a user
   */
  async getImportStats(userId: number): Promise<{
    totalImports: number;
    completedImports: number;
    failedImports: number;
    totalSessionsCreated: number;
    totalUnmatchedRecords: number;
  }> {
    const stats = this.getDatabase()
      .select({
        totalImports: sql<number>`count(*)`,
        completedImports: sql<number>`sum(case when ${importLogs.status} = 'success' then 1 else 0 end)`,
        failedImports: sql<number>`sum(case when ${importLogs.status} = 'failed' then 1 else 0 end)`,
        totalSessionsCreated: sql<number>`sum(coalesce(${importLogs.sessionsCreated}, 0))`,
        totalUnmatchedRecords: sql<number>`sum(coalesce(${importLogs.unmatchedRecords}, 0))`,
      })
      .from(importLogs)
      .where(eq(importLogs.userId, userId))
      .get();

    return {
      totalImports: stats?.totalImports ?? 0,
      completedImports: stats?.completedImports ?? 0,
      failedImports: stats?.failedImports ?? 0,
      totalSessionsCreated: stats?.totalSessionsCreated ?? 0,
      totalUnmatchedRecords: stats?.totalUnmatchedRecords ?? 0,
    };
  }
}

// Singleton instance
export const importLogRepository = new ImportLogRepository();
