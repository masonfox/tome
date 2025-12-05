/**
 * Import Cache Service
 * 
 * Manages in-memory caching of import match results with TTL expiration.
 * Used to store parsed and matched import data between upload and preview/execution steps.
 */

import type { ImportRecord } from './csv-parser.service';
import type { MatchResult } from './book-matcher.service';
import { getLogger } from '@/lib/logger';

const logger = getLogger();

export interface CachedImportData {
  importId: number;
  userId: number;
  provider: 'goodreads' | 'storygraph';
  fileName: string;
  parsedRecords: ImportRecord[];
  matchResults: MatchResult[];
  expiresAt: number;
}

class ImportCacheService {
  private cache = new Map<number, CachedImportData>();
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup task
    this.startCleanupTask();
  }

  /**
   * Store import data in cache with automatic expiration
   */
  set(data: Omit<CachedImportData, 'expiresAt'>): void {
    const cachedData: CachedImportData = {
      ...data,
      expiresAt: Date.now() + this.TTL_MS,
    };
    
    this.cache.set(data.importId, cachedData);
  }

  /**
   * Retrieve import data from cache if not expired
   */
  get(importId: number): CachedImportData | null {
    const data = this.cache.get(importId);
    
    if (!data) {
      return null;
    }

    // Check if expired
    if (Date.now() > data.expiresAt) {
      this.cache.delete(importId);
      return null;
    }

    return data;
  }

  /**
   * Check if import data exists in cache
   */
  has(importId: number): boolean {
    return this.get(importId) !== null;
  }

  /**
   * Delete import data from cache
   */
  delete(importId: number): boolean {
    return this.cache.delete(importId);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Start periodic cleanup task to remove expired entries
   */
  private startCleanupTask(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Remove all expired entries from cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: number[] = [];

    this.cache.forEach((data, importId) => {
      if (now > data.expiresAt) {
        expiredKeys.push(importId);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      logger.info({ expiredCount: expiredKeys.length }, 'Import cache cleanup completed');
    }
  }

  /**
   * Stop cleanup task (for graceful shutdown)
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const importCache = new ImportCacheService();
