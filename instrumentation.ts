// Track if cleanup listeners are registered to prevent duplicates
let cleanupListenersRegistered = false;

// Simple console logger for instrumentation phase (before pino is available)
function log(level: 'info' | 'warn' | 'error', message: string) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ level, time: timestamp, msg: message }));
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Calibre automatic sync works in both dev and production
    // Uses better-sqlite3 in Node.js (dev) and bun:sqlite in Bun (production)
    const runtime = typeof Bun !== 'undefined' ? 'Bun' : 'Node.js';
    const { calibreWatcher } = await import("./lib/calibre-watcher");
    const { syncCalibreLibrary } = await import("./lib/sync-service");

    const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

    if (CALIBRE_DB_PATH) {
      log('info', `Initializing Calibre automatic sync (${runtime} runtime)...`);

      // Start watching the Calibre database for changes
      await calibreWatcher.start(CALIBRE_DB_PATH, syncCalibreLibrary);
    } else {
      log('warn', "CALIBRE_DB_PATH not configured. Automatic sync is disabled.");
    }

    // Cleanup on shutdown - only register once to prevent memory leak warnings
    if (!cleanupListenersRegistered) {
      process.on("SIGTERM", () => {
        log('info', "Shutting down Calibre watcher...");
        calibreWatcher.stop();
      });

      process.on("SIGINT", () => {
        log('info', "Shutting down Calibre watcher...");
        calibreWatcher.stop();
      });
      
      cleanupListenersRegistered = true;
    }
  }
}
