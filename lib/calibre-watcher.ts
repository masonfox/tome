import { watch } from "fs";
import { stat } from "fs/promises";
import type { SyncResult } from "./sync-service";
import { getLogger } from "@/lib/logger";

type SyncCallback = () => Promise<SyncResult>;

class CalibreWatcher {
  private watcher: ReturnType<typeof watch> | null = null;
  private lastModified: number = 0;
  private syncing: boolean = false;
  private syncCallback: SyncCallback | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private suspended: boolean = false;
  private ignorePeriodEnd: number = 0; // Timestamp until which to ignore changes

  async start(calibreDbPath: string, onSync: SyncCallback) {
    const logger = getLogger();

    if (this.watcher) {
      logger.debug("Calibre watcher already running");
      return;
    }

    this.syncCallback = onSync;

    try {
      const stats = await stat(calibreDbPath);
      this.lastModified = stats.mtimeMs;

      logger.info({ calibreDbPath }, `Starting Calibre database watcher on: ${calibreDbPath}`);

      this.watcher = watch(calibreDbPath, async (eventType) => {
        if (eventType === "change") {
          logger.info("[WATCHER] Calibre database change detected");
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(async () => {
            try {
              const newStats = await stat(calibreDbPath);
              if (newStats.mtimeMs > this.lastModified) {
                logger.info("[WATCHER] Calibre database modified, triggering sync...");
                this.lastModified = newStats.mtimeMs;
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

      logger.info("Calibre watcher started successfully");
      await this.triggerSync();
    } catch (error) {
      logger.error({ err: error }, "Failed to start Calibre watcher");
    }
  }

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
      await this.syncCallback();
      logger.info("[WATCHER] Automatic sync completed");
    } catch (error) {
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

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info("Calibre watcher stopped");
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const calibreWatcher = new CalibreWatcher();
