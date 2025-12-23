"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BottomSheet } from "./BottomSheet";
import BaseModal from "./BaseModal";
import BookProgress from "./BookDetail/BookProgress";
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
    };
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
        logger.info({ bookId: book.id }, 'Completion detected in LogProgressModal');
        setShowLocalCompletionModal(true);
        // Don't close progress modal - let FinishBookModal appear
        return;
      }
      
      // Close modal if no completion
      onClose();
    }
  }

  // Handle finishing the book (called from FinishBookModal)
  async function handleConfirmFinish(rating: number, review?: string) {
    try {
      const body: any = { status: "read" };
      if (rating > 0) {
        body.rating = rating;
      }
      if (review) {
        body.review = review;
      }

      const response = await fetch(`/api/books/${book.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to mark book as read");
      }

      // Close both modals
      setShowLocalCompletionModal(false);
      onClose();

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['book', book.id] });
      router.refresh(); // Refresh server components
      
      toast.success("Marked as read!");
    } catch (error) {
      logger.error({ error }, "Failed to mark book as read");
      toast.error("Failed to mark book as read");
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
      />
    </>
  );
}
