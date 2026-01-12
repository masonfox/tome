"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, BookOpen, Pencil, ChevronRight } from "lucide-react";
import SessionEditModal from "@/components/Modals/SessionEditModal";
import SessionProgressModal from "@/components/Modals/SessionProgressModal";
import { toast } from "@/utils/toast";
import { formatDateOnly } from '@/utils/dateHelpers';
import MarkdownRenderer from "@/components/Markdown/MarkdownRenderer";

interface ReadingSession {
  id: number;
  sessionNumber: number;
  status: string;
  startedDate?: string;
  completedDate?: string;
  dnfDate?: string;
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
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState<ReadingSession | null>(null);
  const [viewProgressModal, setViewProgressModal] = useState<{
    sessionId: number;
    sessionNumber: number;
  } | null>(null);

  // Fetch sessions using TanStack Query - automatic caching and background refetching
  const { data: allSessions = [], isLoading: loading } = useQuery<ReadingSession[]>({
    queryKey: ['sessions', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/books/${bookId}/sessions`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      return response.json();
    },
    staleTime: 5000, // Data is fresh for 5 seconds
  });

  // Filter to show completed sessions (archived OR status='read')
  // This ensures single-read books display their completed session even when isActive=true
  const sessions = allSessions.filter((session: ReadingSession) => 
    !session.isActive || session.status === 'read'
  );

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

      // Invalidate queries to refetch fresh data
      await queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
      await queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      
      handleCloseEditModal();
      toast.success("Session updated successfully");
    } catch (error) {
      // Suppress console; toast shows failure
      toast.error("Failed to save session. Please try again.");
    }
  }

  // Don't show anything while loading or if there are no completed sessions
  if (loading || sessions.length === 0) {
    return null;
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
                  {session.status === 'dnf' ? `DNF #${session.sessionNumber}` : `Read #${session.sessionNumber}`}
                </h3>
                {session.status === 'dnf' ? (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-600 dark:text-red-400 rounded-full border border-red-500/30">
                    Did Not Finish
                  </span>
                ) : (
                  session.progressSummary.latestProgress && 
                  session.progressSummary.latestProgress.currentPercentage < 100 && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/30">
                      Abandoned
                    </span>
                  )
                )}
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
                    Started: {formatDateOnly(session.startedDate)}
                  </span>
                </div>
              )}
              {session.completedDate && (
                <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/70 font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Completed: {formatDateOnly(session.completedDate)}
                  </span>
                </div>
              )}
              {session.dnfDate && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Stopped Reading: {formatDateOnly(session.dnfDate)}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Summary */}
            {session.progressSummary.totalEntries > 0 && (
              <button
                onClick={() => setViewProgressModal({
                  sessionId: session.id,
                  sessionNumber: session.sessionNumber,
                })}
                className="w-full grid grid-cols-2 gap-4 mb-4 p-3 bg-[var(--card-bg)] rounded border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors duration-200 cursor-pointer group"
                aria-label={`View progress logs for Read #${session.sessionNumber}`}
              >
                <div className="text-left">
                  <p className="text-xs text-[var(--foreground)]/60 font-semibold uppercase tracking-wide mb-1">
                    Progress Logs
                  </p>
                  <p className="text-lg font-mono font-bold text-[var(--foreground)]">
                    {session.progressSummary.totalEntries}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-[var(--foreground)]/60 font-semibold uppercase tracking-wide mb-1">
                    Pages Read
                  </p>
                  <p className="text-lg font-mono font-bold text-[var(--foreground)]">
                    {session.progressSummary.totalPagesRead}
                  </p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-5 h-5 text-[var(--accent)]" />
                </div>
              </button>
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
                <MarkdownRenderer content={session.review} />
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
        sessionId={editingSession?.id ?? 0}
        bookId={bookId}
        currentStartedDate={editingSession?.startedDate ?? null}
        currentCompletedDate={editingSession?.completedDate ?? null}
        currentReview={editingSession?.review ?? null}
      />

      {viewProgressModal && (
        <SessionProgressModal
          isOpen={!!viewProgressModal}
          onClose={() => setViewProgressModal(null)}
          sessionId={viewProgressModal.sessionId}
          bookId={bookId}
          bookTitle={bookTitle}
          sessionNumber={viewProgressModal.sessionNumber}
        />
      )}
    </div>
  );
}
