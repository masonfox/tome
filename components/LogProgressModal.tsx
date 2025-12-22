"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BottomSheet } from "./BottomSheet";
import BaseModal from "./BaseModal";
import BookProgress from "./BookDetail/BookProgress";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useDraftNote } from "@/hooks/useDraftNote";
import { TrendingUp } from "lucide-react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { getLogger } from "@/lib/logger";

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
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const progressModeDropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MDXEditorMethods | null>(null);

  const bookProgressHook = useBookProgress(book.id.toString(), book as any, async () => {
    // Invalidate dashboard queries to refresh data
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    await queryClient.invalidateQueries({ queryKey: ['book', book.id] });
  });

  // Draft note management
  const { draftNote, saveDraft, clearDraft } = useDraftNote(book.id);
  const [isDraftInitialized, setIsDraftInitialized] = useState(false);

  // Restore draft note on mount
  useEffect(() => {
    if (draftNote && bookProgressHook.notes === "") {
      bookProgressHook.setNotes(draftNote);
    }
    setIsDraftInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftNote]);

  // Save draft when notes change
  useEffect(() => {
    if (isDraftInitialized) {
      saveDraft(bookProgressHook.notes);
    }
  }, [bookProgressHook.notes, saveDraft, isDraftInitialized]);

  // Wrapper for log progress that clears draft and resets editor
  async function handleLogProgress(e: React.FormEvent) {
    const success = await bookProgressHook.handleLogProgress(e);
    if (success) {
      clearDraft();
      try {
        editorRef.current?.setMarkdown("");
      } catch (error) {
        logger.error({ error }, "Failed to reset editor");
      }
      // Close modal after successful submission
      onClose();
    }
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
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={book.title}
        icon={<TrendingUp className="w-5 h-5" />}
      >
        {progressForm}
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Progress - ${book.title}`}
      actions={<></>}
    >
      {progressForm}
    </BaseModal>
  );
}
