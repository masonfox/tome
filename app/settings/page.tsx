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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure your book tracker
        </p>
      </div>

      {/* Calibre Integration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-4">
          <Database className="w-6 h-6 text-blue-600 mt-1" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Calibre Integration
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Sync your book library with Calibre database
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Calibre Library Path
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg font-mono">
                  {process.env.NEXT_PUBLIC_CALIBRE_LIBRARY_PATH ||
                    process.env.CALIBRE_LIBRARY_PATH ||
                    "Not configured - set CALIBRE_LIBRARY_PATH in .env"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Point to your Calibre library folder (metadata.db should be at the root)
                </p>
              </div>

              {/* Automatic Sync Status */}
              {syncStatus && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                        Automatic Sync {syncStatus.autoSyncEnabled ? "Enabled" : "Disabled"}
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {syncStatus.autoSyncEnabled
                          ? "The app automatically syncs when Calibre's database is modified"
                          : "Set CALIBRE_LIBRARY_PATH in .env to enable automatic sync"}
                      </p>
                      {syncStatus.lastSync && (
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                          Last synced: {formatLastSync(syncStatus.lastSync)}
                        </p>
                      )}
                      {syncStatus.syncInProgress && (
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 flex items-center gap-2">
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
                    "flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium",
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
                      "mt-4 p-4 rounded-lg",
                      syncResult.startsWith("Success")
                        ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
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
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3">
          Setup Instructions
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Database Configuration
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">
              MongoDB URI:
            </span>
            <span className="font-mono text-gray-900 dark:text-white">
              {process.env.NEXT_PUBLIC_MONGODB_URI ||
                process.env.MONGODB_URI ||
                "mongodb://localhost:27017/tome"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Port:</span>
            <span className="font-mono text-gray-900 dark:text-white">
              {process.env.NEXT_PUBLIC_PORT || process.env.PORT || "3000"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
