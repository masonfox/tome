"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, BookOpen, Pencil } from "lucide-react";
import SessionEditModal from "./SessionEditModal";
import { toast } from "@/utils/toast";

interface ReadingSession {
  id: number;
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
  bookTitle?: string;
}

export default function ReadingHistoryTab({ bookId, bookTitle = "this book" }: ReadingHistoryTabProps) {
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState<ReadingSession | null>(null);

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
      // Suppress console; reading sessions fetch failure ignored
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEditModal(session: ReadingSession) {
    setEditingSession(session);
    setShowEditModal(true);
  }

  function handleCloseEditModal() {
    setShowEditModal(false);
    setEditingSession(null);
  }

  async function handleSaveSession(data: {
    startedDate: string | null;
    completedDate: string | null;
    review: string | null;
  }) {
    if (!editingSession) return;

    try {
      const response = await fetch(`/api/books/${bookId}/sessions/${editingSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update session");
      }

      // Refresh sessions to show updates
      await fetchSessions();
      
      handleCloseEditModal();
      toast.success("Session updated successfully");
    } catch (error) {
      // Suppress console; toast shows failure
      toast.error("Failed to save session. Please try again.");
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
            key={session.id}
            className="p-5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--accent)]/60" />
                <h3 className="text-lg font-semibold text-[var(--heading-text)]">
                  Read #{session.sessionNumber}
                </h3>
              </div>
              <button
                onClick={() => handleOpenEditModal(session)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:text-[var(--light-accent)] hover:bg-[var(--accent)]/5 rounded transition-colors group"
                title="Edit session"
              >
                <span>Edit</span>
                <Pencil className="w-3.5 h-3.5" />
              </button>
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
              <div className="text-sm text-[var(--foreground)]/70 font-medium mb-4">
                Final progress: <span className="font-mono font-semibold">
                  {Math.round(session.progressSummary.latestProgress.currentPercentage)}%
                </span>
              </div>
            )}

            {/* Review */}
            {session.review && (
              <div className="mt-4 p-4 bg-[var(--card-bg)] rounded border border-[var(--border-color)]">
                <p className="text-xs text-[var(--foreground)]/60 font-semibold uppercase tracking-wide mb-2">
                  Review
                </p>
                <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                  {session.review}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <SessionEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onConfirm={handleSaveSession}
        bookTitle={bookTitle}
        sessionNumber={editingSession?.sessionNumber ?? 0}
        currentStartedDate={editingSession?.startedDate ?? null}
        currentCompletedDate={editingSession?.completedDate ?? null}
        currentReview={editingSession?.review ?? null}
      />
    </div>
  );
}
