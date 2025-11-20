import { watch } from "fs";
import { stat } from "fs/promises";
import path from "path";
import type { SyncResult } from "./sync-service";

type SyncCallback = () => Promise<SyncResult>;

class CalibreWatcher {
  private watcher: ReturnType<typeof watch> | null = null;
  private lastModified: number = 0;
  private syncing: boolean = false;
  private syncCallback: SyncCallback | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  async start(calibreDbPath: string, onSync: SyncCallback) {
    if (this.watcher) {
      console.log("Calibre watcher already running");
      return;
    }

    this.syncCallback = onSync;

    try {
      // Get initial modified time
      const stats = await stat(calibreDbPath);
      this.lastModified = stats.mtimeMs;

      console.log(`Starting Calibre database watcher on: ${calibreDbPath}`);

      // Watch the database file
      this.watcher = watch(calibreDbPath, async (eventType, filename) => {
        if (eventType === "change") {
          // Debounce rapid changes (Calibre might write multiple times)
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(async () => {
            try {
              const newStats = await stat(calibreDbPath);

              // Only sync if the file was actually modified
              if (newStats.mtimeMs > this.lastModified) {
                console.log("Calibre database changed, triggering sync...");
                this.lastModified = newStats.mtimeMs;
                await this.triggerSync();
              }
            } catch (error) {
              console.error("Error checking Calibre database:", error);
            }
          }, 2000); // Wait 2 seconds after last change
        }
      });

      console.log("Calibre watcher started successfully");

      // Perform initial sync
      await this.triggerSync();
    } catch (error) {
      console.error("Failed to start Calibre watcher:", error);
    }
  }

  private async triggerSync() {
    if (this.syncing) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    if (!this.syncCallback) {
      console.error("No sync callback registered");
      return;
    }

    this.syncing = true;
    try {
      await this.syncCallback();
      console.log("Automatic sync completed");
    } catch (error) {
      console.error("Automatic sync failed:", error);
    } finally {
      this.syncing = false;
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("Calibre watcher stopped");
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

// Singleton instance
export const calibreWatcher = new CalibreWatcher();
