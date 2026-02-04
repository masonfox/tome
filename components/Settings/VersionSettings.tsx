"use client";

import { useVersion } from "@/hooks/useVersion";
import { Button } from "@/components/Utilities/Button";
import { PackageCheck, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export function VersionSettings() {
  const { data: versionData, isLoading, error } = useVersion();

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <PackageCheck className="w-6 h-6 text-[var(--accent)]" />
        <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
          Version
        </h3>
      </div>

      <p className="text-sm text-[var(--subheading-text)] mb-4 font-medium">
        Information about this Tome installation
      </p>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          <div className="h-4 bg-[var(--border-color)] rounded animate-pulse w-40" />
          <div className="h-4 bg-[var(--border-color)] rounded animate-pulse w-32" />
        </div>
      )}

      {/* Error State */}
      {error && !versionData && (
        <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/70">
          <AlertCircle className="w-4 h-4" />
          <span>Unable to fetch version information</span>
        </div>
      )}

      {/* Success State */}
      {versionData && (
        <div className="space-y-4">
          {/* Current Version */}
          <div>
            <span className="text-sm font-semibold text-[var(--foreground)]/70">
              Current Version:
            </span>{" "}
            <span className="text-base font-bold text-[var(--foreground)]">
              {versionData.currentVersion}
            </span>
          </div>

          {/* Update Available Notification */}
          {versionData.hasNewVersion && versionData.latestVersion && (
            <div className="inline-block bg-[var(--background)] rounded-md p-4 pr-8 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 bg-[var(--accent)] rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--foreground)] mb-1">
                    New version available!
                  </p>
                  <p className="text-sm text-[var(--subheading-text)]">
                    Version <span className="font-bold">{versionData.latestVersion.replace(/^v/, '')}</span> is now available
                    {versionData.publishedAt && (
                      <span className="text-xs ml-1">
                        (released {format(new Date(versionData.publishedAt), "MMM d, yyyy")})
                      </span>
                    )}
                  </p>
                  {versionData.latestReleaseName && (
                    <p className="text-xs text-[var(--subheading-text)] mt-1 italic">
                      {versionData.latestReleaseName}
                    </p>
                  )}
                </div>
              </div>

              {/* View Release Button */}
              {versionData.latestReleaseUrl && (
                <div className="pl-8">
                  <a
                    href={versionData.latestReleaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold rounded-sm transition-colors focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2"
                  >
                    <span>View Release Notes</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* No Update Available - Show Last Check Info */}
          {!versionData.hasNewVersion && versionData.latestVersion && (
            <div className="flex items-center gap-2 text-sm text-[var(--subheading-text)] font-medium">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>You're running the latest version</span>
            </div>
          )}

          {/* GitHub Check Failed */}
          {versionData.error && (
            <div className="flex items-center gap-2 text-xs text-[var(--foreground)]/50">
              <AlertCircle className="w-3 h-3" />
              <span>{versionData.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
