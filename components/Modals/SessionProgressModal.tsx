"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import BaseModal from "./BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { JournalEntryList } from "@/components/Journal/JournalEntryList";
import { useSessionProgress } from "@/hooks/useSessionProgress";
import { Button } from "@/components/Utilities/Button";

interface SessionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  bookId: string;
  bookTitle: string;
  sessionNumber: number;
}

export default function SessionProgressModal({
  isOpen,
  onClose,
  sessionId,
  bookId,
  bookTitle,
  sessionNumber,
}: SessionProgressModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const { data: progressLogs = [], isLoading, error } = useSessionProgress(bookId, isOpen ? sessionId : null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[var(--foreground)]/10 rounded" />
            <div className="h-5 bg-[var(--foreground)]/10 rounded w-32" />
          </div>
          <div className="ml-7 p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="h-3 bg-[var(--foreground)]/10 rounded w-16" />
                <div className="h-4 bg-[var(--foreground)]/10 rounded w-12" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[var(--foreground)]/10 rounded w-16" />
                <div className="h-4 bg-[var(--foreground)]/10 rounded w-12" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[var(--foreground)]/10 rounded w-16" />
                <div className="h-4 bg-[var(--foreground)]/10 rounded w-12" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Error state
  const ErrorState = () => (
    <div className="text-center py-8">
      <p className="text-[var(--foreground)]/60 mb-4">Failed to load progress logs</p>
      <Button
        variant="primary"
        onClick={() => window.location.reload()}
      >
        Retry
      </Button>
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="text-center py-8">
      <BookOpen className="w-12 h-12 mx-auto mb-3 text-[var(--foreground)]/30" />
      <p className="text-[var(--foreground)]/60">No progress logs recorded for this session</p>
    </div>
  );

  // Content to display
  const content = isLoading ? (
    <LoadingSkeleton />
  ) : error ? (
    <ErrorState />
  ) : progressLogs.length === 0 ? (
    <EmptyState />
  ) : (
    <JournalEntryList
      entries={progressLogs}
      showTitle={false}
    />
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Progress Logs"
        icon={<BookOpen className="w-5 h-5" />}
        size="full"
        allowBackdropClose={false}
      >
        {content}
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Progress Logs"
      subtitle={`${bookTitle} - Read #${sessionNumber}`}
      size="2xl"
      actions={
        <Button
          variant="secondary"
          onClick={onClose}
          className="w-full"
        >
          Close
        </Button>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
        {content}
      </div>
    </BaseModal>
  );
}
