// Track if cleanup listeners are registered to prevent duplicates during HMR
let cleanupListenersRegistered = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Calibre automatic sync works in both dev and production
    // Uses better-sqlite3 in Node.js (dev) and bun:sqlite in Bun (production)
    const runtime = typeof Bun !== 'undefined' ? 'Bun' : 'Node.js';
    const { calibreWatcher } = await import("./lib/calibre-watcher");
    const { syncCalibreLibrary } = await import("./lib/sync-service");

    const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

    if (CALIBRE_DB_PATH) {
      const { getLogger } = await import("@/lib/logger");
      getLogger().info(`Initializing Calibre automatic sync (${runtime} runtime)...`);

      // Start watching the Calibre database for changes
      await calibreWatcher.start(CALIBRE_DB_PATH, syncCalibreLibrary);
    } else {
      const { getLogger } = await import("@/lib/logger");
      getLogger().warn("CALIBRE_DB_PATH not configured. Automatic sync is disabled.");
    }

    // Cleanup on shutdown - only register once to prevent memory leak warnings
    if (!cleanupListenersRegistered) {
      process.on("SIGTERM", () => {
        const { getLogger } = require("@/lib/logger");
        getLogger().info("Shutting down Calibre watcher...");
        calibreWatcher.stop();
      });

      process.on("SIGINT", () => {
        const { getLogger } = require("@/lib/logger");
        getLogger().info("Shutting down Calibre watcher...");
        calibreWatcher.stop();
      });
      
      cleanupListenersRegistered = true;
    }
  }
}
