"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { TagManagementHeader } from "@/components/TagManagement/TagManagementHeader";
import { TagList, type TagListRef } from "@/components/TagManagement/TagList";
import { TagDetailPanel } from "@/components/TagManagement/TagDetailPanel";
import { TagDetailBottomSheet } from "@/components/TagManagement/TagDetailBottomSheet";
import { RenameTagModal } from "@/components/TagManagement/RenameTagModal";
import { DeleteTagModal } from "@/components/TagManagement/DeleteTagModal";
import { MergeTagsModal } from "@/components/TagManagement/MergeTagsModal";
import { BulkDeleteTagsModal } from "@/components/TagManagement/BulkDeleteTagsModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { useTagManagement } from "@/hooks/useTagManagement";
import { useTagBooks } from "@/hooks/useTagBooks";
import { useTagModals } from "@/hooks/useTagModals";
import { toast } from "@/utils/toast";
import type { TagOperationResult } from "@/types/tag-operations";

function TagsPageContent() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tagListRef = useRef<TagListRef>(null);

  // Modal states - extracted to custom hook
  const modals = useTagModals();
  
  // Settings state - load from localStorage
  const [confirmTagRemoval, setConfirmTagRemoval] = useState(true);

  // Load confirmTagRemoval preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPreference = localStorage.getItem("confirmTagRemoval");
      if (savedPreference !== null) {
        setConfirmTagRemoval(savedPreference === "true");
      }
    }
  }, []);

  // Handle confirmTagRemoval change and save to localStorage
  const handleConfirmRemovalChange = (value: boolean) => {
    setConfirmTagRemoval(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("confirmTagRemoval", value.toString());
    }
  };

  // Tag management hook
  const { 
    tags, 
    totalBooks, 
    loading: tagsLoading, 
    error: tagsError, 
    refetch: refetchTags, 
    renameTag, 
    deleteTag, 
    mergeTags,
    setBeforeRefetch: setBeforeTagRefetch,
    setAfterRefetch: setAfterTagRefetch,
  } = useTagManagement();

  // Books for selected tag hook
  const {
    books,
    total: totalBooksInTag,
    loading: booksLoading,
    loadingMore,
    hasMore,
    error: booksError,
    refetch: refetchBooks,
    loadMore,
    removeTagFromBook,
  } = useTagBooks(selectedTag);

  // Setup scroll position preservation for tag list
  useEffect(() => {
    setBeforeTagRefetch(() => tagListRef.current?.saveScrollPosition());
    setAfterTagRefetch(() => tagListRef.current?.restoreScrollPosition());
  }, [setBeforeTagRefetch, setAfterTagRefetch]);

  // Update selected tag when tag is clicked
  const handleSelectTag = (tagName: string) => {
    setSelectedTag(tagName);
  };

  // Handle refresh
  const handleRefresh = async () => {
    await refetchTags();
    if (selectedTag) {
      await refetchBooks();
    }
  };

  // Handle rename tag
  const handleRenameTag = async (tagName: string) => {
    modals.openRenameModal(tagName);
  };

  const confirmRenameTag = async (newName: string) => {
    modals.setRenameLoading(true);
    modals.setRenameResult(null); // Clear previous result
    try {
      const result = await renameTag(modals.tagToRename, newName);
      
      // Handle response based on success/partial/failure
      if (result.failureCount === 0) {
        toast.success(`Successfully renamed tag to "${newName}" for ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        
        // Update selected tag if the renamed tag was selected
        if (selectedTag === modals.tagToRename) {
          setSelectedTag(newName);
        }
        
        // Close modal on full success
        modals.closeRenameModal();
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to rename tag";
        toast.error(errorMsg);
        // Keep modal open and show results
        modals.setRenameResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Renamed ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Update selected tag since some succeeded
        if (selectedTag === modals.tagToRename) {
          setSelectedTag(newName);
        }
        
        // Keep modal open to show results
        modals.setRenameResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename tag");
      // Keep modal open so user can retry
    } finally {
      modals.setRenameLoading(false);
    }
  };

  // Handle delete tag
  const handleDeleteTag = async (tagName: string) => {
    const tag = tags.find(t => t.name === tagName);
    if (!tag) return;
    
    modals.openDeleteModal(tagName, tag.bookCount);
  };

  const confirmDeleteTag = async () => {
    if (!modals.tagToDelete) return;

    modals.setDeleteLoading(true);
    modals.setDeleteResult(null); // Clear previous result
    try {
      const result = await deleteTag(modals.tagToDelete.name);
      
      // Handle response based on success/partial/failure
      if (result.failureCount === 0) {
        toast.success(`Successfully deleted tag "${modals.tagToDelete.name}" from ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        
        // Clear selected tag if deleted tag was selected
        if (selectedTag === modals.tagToDelete.name) {
          setSelectedTag(null);
        }
        
        // Close modal on full success
        modals.closeDeleteModal();
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to delete tag";
        toast.error(errorMsg);
        // Keep modal open and show results
        modals.setDeleteResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Deleted tag from ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Clear selected tag since some succeeded
        if (selectedTag === modals.tagToDelete.name) {
          setSelectedTag(null);
        }
        
        // Keep modal open to show results
        modals.setDeleteResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
      // Keep modal open so user can retry
    } finally {
      modals.setDeleteLoading(false);
    }
  };

  // Handle merge tags
  const handleMergeTags = async (sourceTags: string[]) => {
    modals.openMergeModal(sourceTags);
  };

  const confirmMergeTags = async (targetTag: string) => {
    modals.setMergeLoading(true);
    modals.setMergeResult(null); // Clear previous result
    try {
      // Filter out the target tag from source tags to avoid "merge into itself" error
      const sourceTagsToRemove = modals.tagsToMerge.filter(tag => tag !== targetTag);
      
      const result = await mergeTags(sourceTagsToRemove, targetTag);
      
      // Handle response based on success/partial/failure
      if (result.failureCount === 0) {
        const mergeCount = sourceTagsToRemove.length;
        if (mergeCount === 1) {
          toast.success(`Successfully merged "${sourceTagsToRemove[0]}" into "${targetTag}" for ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        } else {
          toast.success(`Successfully merged ${mergeCount} tags into "${targetTag}" for ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        }
        
        // Update selected tag if one of the source tags was selected
        if (selectedTag && modals.tagsToMerge.includes(selectedTag)) {
          setSelectedTag(targetTag);
        }
        
        // Close modal on full success
        modals.closeMergeModal();
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to merge tags";
        toast.error(errorMsg);
        // Keep modal open and show results
        modals.setMergeResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Merged ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Update selected tag since some succeeded
        if (selectedTag && modals.tagsToMerge.includes(selectedTag)) {
          setSelectedTag(targetTag);
        }
        
        // Keep modal open to show results
        modals.setMergeResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge tags");
      // Keep modal open so user can retry
    } finally {
      modals.setMergeLoading(false);
    }
  };

  // Handle bulk delete tags
  const handleBulkDeleteTags = async (tagNames: string[]) => {
    const tagsWithCounts = tagNames.map(name => {
      const tag = tags.find(t => t.name === name);
      return { name, bookCount: tag?.bookCount || 0 };
    });
    modals.openBulkDeleteModal(tagsWithCounts);
  };

  const confirmBulkDelete = async () => {
    modals.setBulkDeleteLoading(true);
    modals.setBulkDeleteResult(null); // Clear previous result
    try {
      const tagNames = modals.tagsToDelete.map(t => t.name);
      
      // Call bulk delete API
      const response = await fetch("/api/tags/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagNames }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete tags");
      }

      await refetchTags();
      
      const result: TagOperationResult = {
        success: data.success,
        partialSuccess: data.partialSuccess,
        totalBooks: data.totalBooks,
        successCount: data.successCount,
        failureCount: data.failureCount,
        calibreFailures: data.calibreFailures || [],
        tomeFailures: data.tomeFailures || [],
      };
      
      // Handle response based on success/partial/failure
      if (result.failureCount === 0) {
        const deleteCount = modals.tagsToDelete.length;
        if (deleteCount === 1) {
          toast.success(`Successfully deleted tag "${modals.tagsToDelete[0].name}" from ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        } else {
          toast.success(`Successfully deleted ${deleteCount} tags from ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        }
        
        // Clear selected tag if deleted tag was selected
        if (selectedTag && modals.tagsToDelete.some(t => t.name === selectedTag)) {
          setSelectedTag(null);
        }
        
        // Close modal on full success
        modals.closeBulkDeleteModal();
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to delete tags";
        toast.error(errorMsg);
        // Keep modal open and show results
        modals.setBulkDeleteResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Deleted tags from ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Clear selected tag since some succeeded
        if (selectedTag && modals.tagsToDelete.some(t => t.name === selectedTag)) {
          setSelectedTag(null);
        }
        
        // Keep modal open to show results
        modals.setBulkDeleteResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tags");
      // Keep modal open so user can retry
    } finally {
      modals.setBulkDeleteLoading(false);
    }
  };

  // Handle remove tag from book
  const handleRemoveTagFromBook = async (bookId: number) => {
    if (!selectedTag) return;

    try {
      await removeTagFromBook(bookId);
      toast.success("Tag removed from book");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove tag");
      throw error; // Re-throw so BookCardSimple knows to keep modal open
    }
  };

  // Handle mobile back navigation
  const handleCloseDetail = () => {
    setSelectedTag(null);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <TagManagementHeader
        totalTags={tags.length}
        totalBooks={totalBooks}
        loading={tagsLoading}
        onRefresh={handleRefresh}
        confirmRemoval={confirmTagRemoval}
        onConfirmRemovalChange={handleConfirmRemovalChange}
      />

      {/* Error states */}
      {tagsError && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
          Error loading tags: {tagsError}
        </div>
      )}
      {booksError && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
          Error loading books: {booksError}
        </div>
      )}

      {/* Main content: Master-detail layout */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-6 lg:h-[calc(100vh-280px)]">
        {/* Tag list (left panel on desktop, full width on mobile/tablet) */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 lg:overflow-hidden flex flex-col">
            <TagList
              ref={tagListRef}
              tags={tags}
              selectedTag={selectedTag}
              loading={tagsLoading}
              onSelectTag={handleSelectTag}
              onRenameTag={handleRenameTag}
              onDeleteTag={handleDeleteTag}
              onMergeTags={handleMergeTags}
              onBulkDeleteTags={handleBulkDeleteTags}
            />
          </div>

          {/* Tag detail panel (right panel on large desktop only) */}
          <div className="hidden lg:block bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6 overflow-hidden">
            <TagDetailPanel
              tagName={selectedTag}
              books={books}
              loading={booksLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              totalBooks={totalBooksInTag}
              onRemoveTag={handleRemoveTagFromBook}
              onLoadMore={loadMore}
              onClose={handleCloseDetail}
              confirmRemoval={confirmTagRemoval}
            />
          </div>
        </div>

        {/* Bottom sheet for tag detail (mobile + tablet) */}
        <div className="lg:hidden">
          <TagDetailBottomSheet
            isOpen={!!selectedTag}
            onClose={handleCloseDetail}
            tagName={selectedTag}
            books={books}
            loading={booksLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            totalBooks={totalBooksInTag}
            onRemoveTag={handleRemoveTagFromBook}
            onLoadMore={loadMore}
            confirmRemoval={confirmTagRemoval}
          />
        </div>

        {/* Modals */}
        <RenameTagModal
          isOpen={modals.renameModalOpen}
          onClose={modals.closeRenameModal}
          tagName={modals.tagToRename}
          onConfirm={confirmRenameTag}
          loading={modals.renameLoading}
          result={modals.renameResult}
        />

        <DeleteTagModal
          isOpen={modals.deleteModalOpen}
          onClose={modals.closeDeleteModal}
          tagName={modals.tagToDelete?.name || ""}
          bookCount={modals.tagToDelete?.bookCount || 0}
          onConfirm={confirmDeleteTag}
          loading={modals.deleteLoading}
          result={modals.deleteResult}
        />

        <MergeTagsModal
          isOpen={modals.mergeModalOpen}
          onClose={modals.closeMergeModal}
          sourceTags={modals.tagsToMerge}
          tagStats={tags}
          onConfirm={confirmMergeTags}
          loading={modals.mergeLoading}
          result={modals.mergeResult}
        />

        <BulkDeleteTagsModal
          isOpen={modals.bulkDeleteModalOpen}
          onClose={modals.closeBulkDeleteModal}
          tags={modals.tagsToDelete}
          onConfirm={confirmBulkDelete}
          loading={modals.bulkDeleteLoading}
          result={modals.bulkDeleteResult}
        />

        {/* Scroll to top button */}
        <ScrollToTopButton />
    </div>
  );
}

export default function TagsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading tags...</div>}>
      <TagsPageContent />
    </Suspense>
  );
}
