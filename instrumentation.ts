import { detectRuntime } from "./lib/db/factory";

export async function register() {
  // Calibre automatic sync works in both dev and production
  // Uses better-sqlite3 in Node.js (dev) and bun:sqlite in Bun (production)
  const runtime = detectRuntime() === 'bun' ? 'Bun' : 'Node.js';

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { calibreWatcher } = await import("./lib/calibre-watcher");
    const { syncCalibreLibrary } = await import("./lib/sync-service");

    const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

    if (CALIBRE_DB_PATH) {
      console.log(`Initializing Calibre automatic sync (${runtime} runtime)...`);

      // Start watching the Calibre database for changes
      await calibreWatcher.start(CALIBRE_DB_PATH, syncCalibreLibrary);
    } else {
      console.log(
        "CALIBRE_DB_PATH not configured. Automatic sync is disabled."
      );
    }

    // Cleanup on shutdown
    process.on("SIGTERM", () => {
      console.log("Shutting down Calibre watcher...");
      calibreWatcher.stop();
    });

    process.on("SIGINT", () => {
      console.log("Shutting down Calibre watcher...");
      calibreWatcher.stop();
    });
  }
}
