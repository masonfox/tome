import { watch } from "fs";
import { stat, access } from "fs/promises";
import type { SyncResult } from "./sync-service";
import { getLogger } from "@/lib/logger";
import { delay } from "@/lib/utils/delay";
import { isWalMode } from "@/lib/db/factory";

type SyncCallback = () => Promise<SyncResult>;

/**
 * Maximum number of retry attempts when encountering database locks
 * 
 * When Calibre is actively writing to its database, we may encounter
 * transient BUSY or LOCKED errors. We retry up to 3 times with exponential
 * backoff (1s, 2s, 3s) to allow Calibre to finish its operation.
 */
const MAX_RETRIES = 3;

class CalibreWatcher {
  private watchers: ReturnType<typeof watch>[] = [];
  private lastModified: Map<string, number> = new Map();
  private syncing: boolean = false;
  private syncCallback: SyncCallback | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private suspended: boolean = false;
  private ignorePeriodEnd: number = 0; // Timestamp until which to ignore changes

  async start(calibreDbPath: string, onSync: SyncCallback) {
    const logger = getLogger();

    if (this.watchers.length > 0) {
      logger.debug("Calibre watcher already running");
      return;
    }

    this.syncCallback = onSync;

    try {
      // Determine which files to watch
      const filesToWatch: string[] = [calibreDbPath];
      
      // Check if database is using WAL mode (Calibre 9.x default)
      if (isWalMode(calibreDbPath)) {
        const walPath = `${calibreDbPath}-wal`;
        filesToWatch.push(walPath);
        logger.info(
          { calibreDbPath, walPath },
          "Calibre using WAL mode, watching both .db and .db-wal files"
        );
      } else {
        logger.info(
          { calibreDbPath },
          "Calibre using DELETE mode, watching .db file only"
        );
      }

      // Initialize modification times for all files
      for (const filePath of filesToWatch) {
        try {
          const stats = await stat(filePath);
          this.lastModified.set(filePath, stats.mtimeMs);
        } catch (error) {
          logger.warn(
            { filePath, err: error },
            `Could not stat file, will watch anyway`
          );
          this.lastModified.set(filePath, 0);
        }
      }

      logger.info(
        { files: filesToWatch },
        `Starting Calibre database watcher`
      );

      // Create a watcher for each file
      for (const filePath of filesToWatch) {
        const watcher = watch(filePath, async (eventType) => {
          if (eventType === "change") {
            logger.info(
              { file: filePath },
              `[WATCHER] Calibre database change detected`
            );
            
            if (this.debounceTimer) {
              clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(async () => {
              try {
                // Check if ANY watched file was modified
                let anyModified = false;
                
                for (const watchedFile of filesToWatch) {
                  try {
                    const newStats = await stat(watchedFile);
                    const lastMtime = this.lastModified.get(watchedFile) || 0;
                    
                    if (newStats.mtimeMs > lastMtime) {
                      logger.info(
                        { file: watchedFile, oldMtime: lastMtime, newMtime: newStats.mtimeMs },
                        "[WATCHER] File modified"
                      );
                      this.lastModified.set(watchedFile, newStats.mtimeMs);
                      anyModified = true;
                    }
                  } catch (error) {
                    // File might be temporarily unavailable during write
                    logger.debug(
                      { file: watchedFile, err: error },
                      "[WATCHER] Could not stat file (may be temporary)"
                    );
                  }
                }
                
                if (anyModified) {
                  logger.info("[WATCHER] Calibre database modified, triggering sync...");
                  await this.triggerSync();
                } else {
                  logger.info("[WATCHER] Calibre database change was not a modification, skipping sync");
                }
              } catch (error) {
                logger.error({ err: error }, "[WATCHER] Error checking Calibre database");
              }
            }, 2000);
          }
        });
        
        this.watchers.push(watcher);
      }

      logger.info("Calibre watcher started successfully");
      await this.triggerSync();
    } catch (error) {
      logger.error({ err: error }, "Failed to start Calibre watcher");
    }
  }

  /**
   * Triggers a sync with retry logic for database lock errors
   * 
   * This method implements exponential backoff retry logic to handle transient
   * database locks that occur when Calibre is actively writing to its database.
   * 
   * Retry behavior:
   * - Detects SQLite BUSY/LOCKED errors (message contains 'locked' or 'busy')
   * - Retries up to MAX_RETRIES (3) times
   * - Exponential backoff: 1s, 2s, 3s between retries
   * - Non-lock errors are not retried (thrown immediately)
   * - After max retries, logs final error and gives up gracefully
   * 
   * Safety checks:
   * - Respects suspension state (suspend/resume)
   * - Respects ignore period (resumeWithIgnorePeriod)
   * - Prevents concurrent syncs (syncing flag)
   */
  private async triggerSync() {
    const logger = getLogger();

    if (this.suspended) {
      logger.info("[WATCHER] Watcher is suspended, skipping sync");
      return;
    }

    // Check if we're in the ignore period (self-inflicted change from recent write)
    if (Date.now() < this.ignorePeriodEnd) {
      logger.info("[WATCHER] Ignoring change (recent write operation, within ignore period)");
      return;
    }

    if (this.syncing) {
      logger.info("[WATCHER] Sync already in progress, skipping");
      return;
    }

    if (!this.syncCallback) {
      logger.error("[WATCHER] No sync callback registered");
      return;
    }

    this.syncing = true;
    logger.info("[WATCHER] Starting automatic sync from Calibre");
    
    try {
      // Retry loop for handling transient database locks
      let attempt = 0;
      
      while (attempt < MAX_RETRIES) {
        try {
          await this.syncCallback();
          logger.info("[WATCHER] Automatic sync completed");
          return; // Success!
        } catch (error) {
          attempt++;
          
          // Check if this is a database lock error
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isLockError = errorMessage.toLowerCase().includes('locked') || 
                             errorMessage.toLowerCase().includes('busy');
          
          if (isLockError && attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 3s
            const backoffMs = 1000 * attempt;
            logger.warn(
              { 
                attempt, 
                maxRetries: MAX_RETRIES, 
                errorType: 'database_lock', 
                backoffMs,
                errorMessage 
              },
              `[WATCHER] Database locked, retrying in ${backoffMs}ms (attempt ${attempt}/${MAX_RETRIES})`
            );
            await delay(backoffMs);
            continue; // Retry
          } else if (isLockError) {
            // Max retries reached
            logger.error(
              { 
                attempt, 
                maxRetries: MAX_RETRIES, 
                errorType: 'database_lock',
                errorMessage 
              },
              `[WATCHER] Database locked after ${MAX_RETRIES} retries, giving up`
            );
            return; // Give up gracefully
          } else {
            // Not a lock error - throw immediately (don't retry)
            throw error;
          }
        }
      }
    } catch (error) {
      // Non-lock errors end up here
      logger.error({ err: error }, "[WATCHER] Automatic sync failed");
    } finally {
      this.syncing = false;
    }
  }

  suspend() {
    const logger = getLogger();
    
    this.suspended = true;
    
    // Clear any pending debounce timer to prevent queued syncs from running after resume
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      logger.info("[WATCHER] Cleared pending debounce timer during suspend");
    }
    
    logger.info("[WATCHER] Calibre watcher suspended");
  }

  resume() {
    const logger = getLogger();
    
    this.suspended = false;
    logger.info("[WATCHER] Calibre watcher resumed");
  }

  /**
   * Resume the watcher with an ignore period to prevent syncing self-inflicted changes
   * 
   * @param durationMs - Duration in milliseconds to ignore changes (default: 3000ms / 3 seconds)
   */
  resumeWithIgnorePeriod(durationMs: number = 3000) {
    const logger = getLogger();
    
    this.suspended = false;
    this.ignorePeriodEnd = Date.now() + durationMs;
    logger.info(
      { durationMs, ignoreUntil: new Date(this.ignorePeriodEnd).toISOString() },
      "[WATCHER] Calibre watcher resumed with ignore period"
    );
  }

  stop() {
    const logger = getLogger();

    if (this.watchers.length > 0) {
      for (const watcher of this.watchers) {
        watcher.close();
      }
      this.watchers = [];
      logger.info("Calibre watcher stopped");
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const calibreWatcher = new CalibreWatcher();
