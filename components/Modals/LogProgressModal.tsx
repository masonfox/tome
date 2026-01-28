"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import BaseModal from "./BaseModal";
import BookProgress from "@/components/BookDetail/BookProgress";
import FinishBookModal from "./FinishBookModal";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useDraftNote } from "@/hooks/useDraftNote";
import { TrendingUp } from "lucide-react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { getLogger } from "@/lib/logger";
import { toast } from "@/utils/toast";

const logger = getLogger().child({ component: "LogProgressModal" });

interface LogProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: {
    id: number;
    calibreId: number;
    title: string;
    authors: string[];
    totalPages?: number;
    latestProgress?: {
      currentPage: number;
      currentPercentage: number;
    } | null;
    activeSession?: {
      status: string;
    };
  };
  isMobile?: boolean;
}

export default function LogProgressModal({
  isOpen,
  onClose,
  book,
  isMobile = false,
}: LogProgressModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const progressModeDropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MDXEditorMethods | null>(null);
  const [showLocalCompletionModal, setShowLocalCompletionModal] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<number | undefined>();

  const bookProgressHook = useBookProgress(book.id.toString(), book as any, async () => {
    // Invalidate dashboard queries to refresh data
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    await queryClient.invalidateQueries({ queryKey: ['book', book.id] });
    // Refresh server components (dashboard page)
    router.refresh();
  });

  // Draft note management
  const { draftNote, saveDraft, clearDraft } = useDraftNote(book.id);
  const [isDraftInitialized, setIsDraftInitialized] = useState(false);

  // Restore draft note on mount and when modal opens
  useEffect(() => {
    if (isOpen && draftNote && bookProgressHook.notes === "") {
      bookProgressHook.setNotes(draftNote);
      // Also update the editor directly if it's ready
      if (editorRef.current) {
        try {
          editorRef.current.setMarkdown(draftNote);
        } catch (error) {
          logger.error({ error }, "Failed to restore draft in editor");
        }
      }
    }
    if (isOpen) {
      setIsDraftInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draftNote]);

  // Save draft when notes change
  useEffect(() => {
    if (isDraftInitialized) {
      saveDraft(bookProgressHook.notes);
    }
  }, [bookProgressHook.notes, saveDraft, isDraftInitialized]);

  // Wrapper for log progress that clears draft and resets editor
  async function handleLogProgress(e: React.FormEvent) {
    const result = await bookProgressHook.handleLogProgress(e);
    if (result.success) {
      clearDraft();
      try {
        editorRef.current?.setMarkdown("");
      } catch (error) {
        logger.error({ error }, "Failed to reset editor");
      }
      
      // Check if we should show completion modal
      if (result.shouldShowCompletionModal) {
        logger.info({ bookId: book.id, sessionId: result.completedSessionId }, 'Completion detected in LogProgressModal');
        setCompletedSessionId(result.completedSessionId);
        setShowLocalCompletionModal(true);
        // Don't close progress modal - let FinishBookModal appear
        return;
      }
      
      // Close modal if no completion
      onClose();
    }
  }

  // Handle finishing the book (called from FinishBookModal)
  // Note: Book status is already "read" at this point (auto-completed by progress service)
  async function handleConfirmFinish(rating?: number, review?: string) {
    try {
      // Update rating to the book table if provided
      if (rating && rating > 0) {
        const ratingBody = { rating };
        const ratingResponse = await fetch(`/api/books/${book.id}/rating`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratingBody),
        });

        if (!ratingResponse.ok) {
          throw new Error("Failed to update rating");
        }
      }

      // Update review to the session if provided and we have a session ID
      if (review && completedSessionId) {
        const sessionBody = { review };
        const sessionResponse = await fetch(`/api/books/${book.id}/sessions/${completedSessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionBody),
        });

        if (!sessionResponse.ok) {
          throw new Error("Failed to update review");
        }
      }

      // Close both modals
      setShowLocalCompletionModal(false);
      onClose();

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['book', book.id] });
      await queryClient.invalidateQueries({ queryKey: ['sessions', book.id] });
      await queryClient.invalidateQueries({ queryKey: ['library-books'] }); // Invalidate library
      router.refresh(); // Refresh server components
      
      toast.success("Book completed!");
    } catch (error) {
      logger.error({ error }, "Failed to update rating/review");
      toast.error("Failed to update rating/review");
    }
  }
  
  function handleCloseCompletionModal() {
    setShowLocalCompletionModal(false);
    onClose(); // Also close the progress modal
  }

  const progressForm = (
    <div className="space-y-4">
      <BookProgress
        book={book}
        currentPage={bookProgressHook.currentPage}
        currentPercentage={bookProgressHook.currentPercentage}
        progressInputMode={bookProgressHook.progressInputMode}
        notes={bookProgressHook.notes}
        progressDate={bookProgressHook.progressDate}
        onCurrentPageChange={bookProgressHook.setCurrentPage}
        onCurrentPercentageChange={bookProgressHook.setCurrentPercentage}
        onNotesChange={bookProgressHook.setNotes}
        onProgressDateChange={bookProgressHook.setProgressDate}
        onProgressInputModeChange={bookProgressHook.setProgressInputMode}
        onSubmit={handleLogProgress}
        onEditorReady={(methods) => {
          editorRef.current = methods;
          // Restore draft when editor is ready (in case it wasn't ready during mount)
          if (draftNote && bookProgressHook.notes === draftNote) {
            try {
              methods.setMarkdown(draftNote);
            } catch (error) {
              logger.error({ error }, "Failed to restore draft in editor on ready");
            }
          }
        }}
        showProgressModeDropdown={showProgressModeDropdown}
        setShowProgressModeDropdown={setShowProgressModeDropdown}
        progressModeDropdownRef={progressModeDropdownRef}
        showHeader={false}
      />
    </div>
  );

  // Use BottomSheet for mobile, BaseModal for desktop
  if (isMobile) {
    return (
      <>
        <BottomSheet
          isOpen={isOpen}
          onClose={onClose}
          title={book.title}
          icon={<TrendingUp className="w-5 h-5" />}
          size="default"
        >
          {progressForm}
        </BottomSheet>

        {/* Finish Book Modal */}
        <FinishBookModal
          isOpen={showLocalCompletionModal}
          onClose={handleCloseCompletionModal}
          onConfirm={handleConfirmFinish}
          bookTitle={book.title}
          bookId={book.id.toString()}
          sessionId={completedSessionId}
        />
      </>
    );
  }

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Log Progress - ${book.title}`}
        actions={<></>}
        size="2xl"
        allowBackdropClose={false}
      >
        {progressForm}
      </BaseModal>

      {/* Finish Book Modal */}
      <FinishBookModal
        isOpen={showLocalCompletionModal}
        onClose={handleCloseCompletionModal}
        onConfirm={handleConfirmFinish}
        bookTitle={book.title}
        bookId={book.id.toString()}
        sessionId={completedSessionId}
      />
    </>
  );
}
