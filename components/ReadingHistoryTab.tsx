"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Star, BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";

interface ReadingSession {
  _id: string;
  sessionNumber: number;
  status: string;
  startedDate?: string;
  completedDate?: string;
  review?: string;
  isActive: boolean;
  progressSummary: {
    totalEntries: number;
    totalPagesRead: number;
    latestProgress: {
      currentPage: number;
      currentPercentage: number;
      progressDate: string;
      notes?: string;
    } | null;
    firstProgressDate: string | null;
    lastProgressDate: string | null;
  };
}

interface ReadingHistoryTabProps {
  bookId: string;
}

export default function ReadingHistoryTab({ bookId }: ReadingHistoryTabProps) {
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [bookId]);

  async function fetchSessions() {
    try {
      setLoading(true);
      const response = await fetch(`/api/books/${bookId}/sessions`);
      const data = await response.json();

      // Filter to show only archived sessions (isActive = false)
      const archivedSessions = data.filter((session: ReadingSession) => !session.isActive);
      setSessions(archivedSessions);
    } catch (error) {
      console.error("Failed to fetch reading sessions:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
          Reading History
        </h2>
        <p className="text-[var(--foreground)]/60 font-medium">Loading reading history...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null; // Don't show the section if there are no archived sessions
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
      <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
        Reading History
      </h2>

      <div className="space-y-6">
        {sessions.map((session) => (
          <div
            key={session._id}
            className="p-5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg"
          >
            <div className="flex items-start mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--accent)]/60" />
                <h3 className="text-lg font-semibold text-[var(--heading-text)]">
                  Read #{session.sessionNumber}
                </h3>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2 mb-4">
              {session.startedDate && (
                <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/70 font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Started: {format(new Date(session.startedDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {session.completedDate && (
                <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/70 font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Completed: {format(new Date(session.completedDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Summary */}
            {session.progressSummary.totalEntries > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-[var(--card-bg)] rounded border border-[var(--border-color)]">
                <div>
                  <p className="text-xs text-[var(--foreground)]/60 font-semibold uppercase tracking-wide mb-1">
                    Progress Logs
                  </p>
                  <p className="text-lg font-mono font-bold text-[var(--foreground)]">
                    {session.progressSummary.totalEntries}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground)]/60 font-semibold uppercase tracking-wide mb-1">
                    Pages Read
                  </p>
                  <p className="text-lg font-mono font-bold text-[var(--foreground)]">
                    {session.progressSummary.totalPagesRead}
                  </p>
                </div>
              </div>
            )}

            {/* Final Progress */}
            {session.progressSummary.latestProgress && (
              <div className="text-sm text-[var(--foreground)]/70 font-medium">
                Final progress: <span className="font-mono font-semibold">
                  {Math.round(session.progressSummary.latestProgress.currentPercentage)}%
                </span>
              </div>
            )}

            {/* Review */}
            {session.review && (
              <div className="mt-4 p-3 bg-[var(--card-bg)] rounded border border-[var(--border-color)]">
                <p className="text-xs text-[var(--foreground)]/60 font-semibold uppercase tracking-wide mb-2">
                  Review
                </p>
                <p className="text-sm text-[var(--foreground)]/80 italic font-medium">
                  &ldquo;{session.review}&rdquo;
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
