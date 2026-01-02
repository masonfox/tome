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
import { toast } from "@/utils/toast";
import type { TagOperationResult } from "@/types/tag-operations";

function TagsPageContent() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tagListRef = useRef<TagListRef>(null);

  // Modal states
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string>("");
  const [tagToDelete, setTagToDelete] = useState<{ name: string; bookCount: number } | null>(null);
  const [tagsToMerge, setTagsToMerge] = useState<string[]>([]);
  const [tagsToDelete, setTagsToDelete] = useState<Array<{ name: string; bookCount: number }>>([]);
  
  // Loading states for modals
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Result states for modals
  const [renameResult, setRenameResult] = useState<TagOperationResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<TagOperationResult | null>(null);
  const [mergeResult, setMergeResult] = useState<TagOperationResult | null>(null);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<TagOperationResult | null>(null);

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
    setTagToRename(tagName);
    setRenameResult(null); // Clear previous result
    setRenameModalOpen(true);
  };

  const confirmRenameTag = async (newName: string) => {
    setRenameLoading(true);
    setRenameResult(null); // Clear previous result
    try {
      const result = await renameTag(tagToRename, newName);
      
      // Handle response based on success/partial/failure
      if (result.failureCount === 0) {
        toast.success(`Successfully renamed tag to "${newName}" for ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        
        // Update selected tag if the renamed tag was selected
        if (selectedTag === tagToRename) {
          setSelectedTag(newName);
        }
        
        // Close modal on full success
        setRenameModalOpen(false);
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to rename tag";
        toast.error(errorMsg);
        // Keep modal open and show results
        setRenameResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Renamed ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Update selected tag since some succeeded
        if (selectedTag === tagToRename) {
          setSelectedTag(newName);
        }
        
        // Keep modal open to show results
        setRenameResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename tag");
      // Keep modal open so user can retry
    } finally {
      setRenameLoading(false);
    }
  };

  // Handle delete tag
  const handleDeleteTag = async (tagName: string) => {
    const tag = tags.find(t => t.name === tagName);
    if (!tag) return;
    
    setTagToDelete({ name: tagName, bookCount: tag.bookCount });
    setDeleteResult(null); // Clear previous result
    setDeleteModalOpen(true);
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;

    setDeleteLoading(true);
    setDeleteResult(null); // Clear previous result
    try {
      const result = await deleteTag(tagToDelete.name);
      
      // Handle response based on success/partial/failure
      if (result.failureCount === 0) {
        toast.success(`Successfully deleted tag "${tagToDelete.name}" from ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        
        // Clear selected tag if deleted tag was selected
        if (selectedTag === tagToDelete.name) {
          setSelectedTag(null);
        }
        
        // Close modal on full success
        setDeleteModalOpen(false);
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to delete tag";
        toast.error(errorMsg);
        // Keep modal open and show results
        setDeleteResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Deleted tag from ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Clear selected tag since some succeeded
        if (selectedTag === tagToDelete.name) {
          setSelectedTag(null);
        }
        
        // Keep modal open to show results
        setDeleteResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
      // Keep modal open so user can retry
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle merge tags
  const handleMergeTags = async (sourceTags: string[]) => {
    setTagsToMerge(sourceTags);
    setMergeResult(null); // Clear previous result
    setMergeModalOpen(true);
  };

  const confirmMergeTags = async (targetTag: string) => {
    setMergeLoading(true);
    setMergeResult(null); // Clear previous result
    try {
      // Filter out the target tag from source tags to avoid "merge into itself" error
      const sourceTagsToRemove = tagsToMerge.filter(tag => tag !== targetTag);
      
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
        if (selectedTag && tagsToMerge.includes(selectedTag)) {
          setSelectedTag(targetTag);
        }
        
        // Close modal on full success
        setMergeModalOpen(false);
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to merge tags";
        toast.error(errorMsg);
        // Keep modal open and show results
        setMergeResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Merged ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Update selected tag since some succeeded
        if (selectedTag && tagsToMerge.includes(selectedTag)) {
          setSelectedTag(targetTag);
        }
        
        // Keep modal open to show results
        setMergeResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge tags");
      // Keep modal open so user can retry
    } finally {
      setMergeLoading(false);
    }
  };

  // Handle bulk delete tags
  const handleBulkDeleteTags = async (tagNames: string[]) => {
    const tagsWithCounts = tagNames.map(name => {
      const tag = tags.find(t => t.name === name);
      return { name, bookCount: tag?.bookCount || 0 };
    });
    setTagsToDelete(tagsWithCounts);
    setBulkDeleteResult(null); // Clear previous result
    setBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteLoading(true);
    setBulkDeleteResult(null); // Clear previous result
    try {
      const tagNames = tagsToDelete.map(t => t.name);
      
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
        const deleteCount = tagsToDelete.length;
        if (deleteCount === 1) {
          toast.success(`Successfully deleted tag "${tagsToDelete[0].name}" from ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        } else {
          toast.success(`Successfully deleted ${deleteCount} tags from ${result.successCount} ${result.successCount === 1 ? 'book' : 'books'}`);
        }
        
        // Clear selected tag if deleted tag was selected
        if (selectedTag && tagsToDelete.some(t => t.name === selectedTag)) {
          setSelectedTag(null);
        }
        
        // Close modal on full success
        setBulkDeleteModalOpen(false);
      } else if (result.successCount === 0) {
        // Complete failure - show error toast
        const errorMsg = result.calibreFailures?.[0]?.error || result.tomeFailures?.[0]?.error || "Failed to delete tags";
        toast.error(errorMsg);
        // Keep modal open and show results
        setBulkDeleteResult(result);
      } else {
        // Partial success - show warning toast and results in modal
        toast.warning(`Deleted tags from ${result.successCount} of ${result.totalBooks} books. ${result.failureCount} failed - see details in modal.`);
        
        // Clear selected tag since some succeeded
        if (selectedTag && tagsToDelete.some(t => t.name === selectedTag)) {
          setSelectedTag(null);
        }
        
        // Keep modal open to show results
        setBulkDeleteResult(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tags");
      // Keep modal open so user can retry
    } finally {
      setBulkDeleteLoading(false);
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
          isOpen={renameModalOpen}
          onClose={() => {
            setRenameModalOpen(false);
            setRenameResult(null); // Clear result when closing
          }}
          tagName={tagToRename}
          onConfirm={confirmRenameTag}
          loading={renameLoading}
          result={renameResult}
        />

        <DeleteTagModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeleteResult(null); // Clear result when closing
          }}
          tagName={tagToDelete?.name || ""}
          bookCount={tagToDelete?.bookCount || 0}
          onConfirm={confirmDeleteTag}
          loading={deleteLoading}
          result={deleteResult}
        />

        <MergeTagsModal
          isOpen={mergeModalOpen}
          onClose={() => {
            setMergeModalOpen(false);
            setMergeResult(null); // Clear result when closing
          }}
          sourceTags={tagsToMerge}
          tagStats={tags}
          onConfirm={confirmMergeTags}
          loading={mergeLoading}
          result={mergeResult}
        />

        <BulkDeleteTagsModal
          isOpen={bulkDeleteModalOpen}
          onClose={() => {
            setBulkDeleteModalOpen(false);
            setBulkDeleteResult(null); // Clear result when closing
          }}
          tags={tagsToDelete}
          onConfirm={confirmBulkDelete}
          loading={bulkDeleteLoading}
          result={bulkDeleteResult}
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
