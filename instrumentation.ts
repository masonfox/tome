export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { calibreWatcher } = await import("./lib/calibre-watcher");
    const { syncCalibreLibrary } = await import("./lib/sync-service");

    const CALIBRE_LIBRARY_PATH = process.env.CALIBRE_LIBRARY_PATH;

    if (CALIBRE_LIBRARY_PATH) {
      console.log("Initializing Calibre automatic sync...");

      // Start watching the Calibre database for changes
      await calibreWatcher.start(CALIBRE_LIBRARY_PATH, syncCalibreLibrary);
    } else {
      console.log(
        "CALIBRE_LIBRARY_PATH not configured. Automatic sync is disabled."
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
