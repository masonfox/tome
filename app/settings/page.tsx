"use client";

import { Settings as SettingsIcon, Database, RefreshCw, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/utils/cn";

interface SyncStatus {
  lastSync: string | null;
  syncInProgress: boolean;
  autoSyncEnabled: boolean;
}

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchSyncStatus() {
    try {
      const response = await fetch("/api/calibre/status");
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/calibre/sync");
      const result = await response.json();

      if (result.success) {
        setSyncResult(
          `Success! ${result.message}. Total books: ${result.totalBooks}`
        );
        fetchSyncStatus(); // Refresh status
      } else {
        setSyncResult(`Error: ${result.error}`);
      }
    } catch (error) {
      setSyncResult("Failed to sync with Calibre database");
    } finally {
      setSyncing(false);
    }
  }

  function formatLastSync(lastSync: string | null) {
    if (!lastSync) return "Never";
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  return (
    <div className="space-y-10">
      <div className="border-b border-[var(--border-color)] pb-6">
        <h1 className="text-5xl font-serif font-bold text-[var(--foreground)] flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-[var(--foreground)]/70 mt-2 font-light">
          Configure your book tracker
        </p>
      </div>

      {/* Calibre Integration */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6">
        <div className="flex items-start gap-4">
          <Database className="w-6 h-6 text-[var(--accent)] mt-1" />
          <div className="flex-1">
            <h2 className="text-xl font-serif font-bold text-[var(--foreground)] mb-2">
              Calibre Integration
            </h2>
            <p className="text-[var(--foreground)]/70 mb-4 font-light">
              Sync your book library with Calibre database
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
                  Calibre Library Path
                </label>
                <p className="text-sm text-[var(--foreground)]/60 bg-[var(--background)] p-3 font-mono">
                  {process.env.NEXT_PUBLIC_CALIBRE_LIBRARY_PATH ||
                    process.env.CALIBRE_LIBRARY_PATH ||
                    "Not configured - set CALIBRE_LIBRARY_PATH in .env"}
                </p>
                <p className="text-xs text-[var(--foreground)]/60 mt-2 font-light">
                  Point to your Calibre library folder (metadata.db should be at the root)
                </p>
              </div>

              {/* Automatic Sync Status */}
              {syncStatus && (
                <div className="bg-[var(--background)] border border-[var(--border-color)] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--accent)] mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--foreground)] mb-1">
                        Automatic Sync {syncStatus.autoSyncEnabled ? "Enabled" : "Disabled"}
                      </h3>
                      <p className="text-sm text-[var(--foreground)]/70 font-light">
                        {syncStatus.autoSyncEnabled
                          ? "The app automatically syncs when Calibre's database is modified"
                          : "Set CALIBRE_LIBRARY_PATH in .env to enable automatic sync"}
                      </p>
                      {syncStatus.lastSync && (
                        <p className="text-sm text-[var(--foreground)]/70 mt-2 font-light">
                          Last synced: {formatLastSync(syncStatus.lastSync)}
                        </p>
                      )}
                      {syncStatus.syncInProgress && (
                        <p className="text-sm text-[var(--foreground)]/70 mt-2 flex items-center gap-2 font-light">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sync in progress...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  onClick={handleSync}
                  disabled={syncing || syncStatus?.syncInProgress}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white hover:bg-[var(--light-accent)] transition-colors font-medium",
                    (syncing || syncStatus?.syncInProgress) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RefreshCw
                    className={cn("w-5 h-5", (syncing || syncStatus?.syncInProgress) && "animate-spin")}
                  />
                  {syncing || syncStatus?.syncInProgress ? "Syncing..." : "Manual Sync"}
                </button>

                {syncResult && (
                  <div
                    className={cn(
                      "mt-4 p-4",
                      syncResult.startsWith("Success")
                        ? "bg-green-600/20 text-green-800 dark:text-green-300 border border-green-600/30"
                        : "bg-red-600/20 text-red-800 dark:text-red-300 border border-red-600/30"
                    )}
                  >
                    {syncResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-[var(--background)] border border-[var(--border-color)] p-6">
        <h3 className="font-bold text-[var(--foreground)] mb-3">
          Setup Instructions
        </h3>
        <div className="text-sm text-[var(--foreground)]/70 space-y-2 font-light">
          <p>1. Locate your Calibre library folder on your computer</p>
          <p>2. Copy the .env.example file to .env</p>
          <p>
            3. Set CALIBRE_LIBRARY_PATH to your Calibre library folder path
            (e.g., /home/user/Calibre Library)
          </p>
          <p>4. Restart the application</p>
          <p>5. Click "Sync Now" to import your books</p>
        </div>
      </div>

      {/* Database Info */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6">
        <h2 className="text-xl font-serif font-bold text-[var(--foreground)] mb-4">
          Database Configuration
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[var(--foreground)]/70 font-light">
              MongoDB URI:
            </span>
            <span className="font-mono text-[var(--foreground)]">
              {process.env.NEXT_PUBLIC_MONGODB_URI ||
                process.env.MONGODB_URI ||
                "mongodb://localhost:27017/tome"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--foreground)]/70 font-light">Port:</span>
            <span className="font-mono text-[var(--foreground)]">
              {process.env.NEXT_PUBLIC_PORT || process.env.PORT || "3000"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
