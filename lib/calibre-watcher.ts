import { watch } from "fs";
import { stat } from "fs/promises";
import type { SyncResult } from "./sync-service";

type SyncCallback = () => Promise<SyncResult>;

class CalibreWatcher {
  private watcher: ReturnType<typeof watch> | null = null;
  private lastModified: number = 0;
  private syncing: boolean = false;
  private syncCallback: SyncCallback | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private suspended: boolean = false;

  async start(calibreDbPath: string, onSync: SyncCallback) {
    const { getLogger } = require("@/lib/logger");
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
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(async () => {
            try {
              const newStats = await stat(calibreDbPath);
              if (newStats.mtimeMs > this.lastModified) {
                logger.info("Calibre database changed, triggering sync...");
                this.lastModified = newStats.mtimeMs;
                await this.triggerSync();
              }
            } catch (error) {
              logger.error({ err: error }, "Error checking Calibre database");
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
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    if (this.suspended) {
      logger.debug("Watcher is suspended, skipping sync");
      return;
    }

    if (this.syncing) {
      logger.debug("Sync already in progress, skipping");
      return;
    }

    if (!this.syncCallback) {
      logger.error("No sync callback registered");
      return;
    }

    this.syncing = true;
    try {
      await this.syncCallback();
      logger.info("Automatic sync completed");
    } catch (error) {
      logger.error({ err: error }, "Automatic sync failed");
    } finally {
      this.syncing = false;
    }
  }

  suspend() {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();
    
    this.suspended = true;
    logger.info("Calibre watcher suspended");
  }

  resume() {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();
    
    this.suspended = false;
    logger.info("Calibre watcher resumed");
  }

  stop() {
    const { getLogger } = require("@/lib/logger");
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
