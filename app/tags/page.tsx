"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TagManagementHeader } from "@/components/TagManagement/TagManagementHeader";
import { TagList } from "@/components/TagManagement/TagList";
import { TagDetailPanel } from "@/components/TagManagement/TagDetailPanel";
import { TagDetailBottomSheet } from "@/components/TagManagement/TagDetailBottomSheet";
import { RenameTagModal } from "@/components/TagManagement/RenameTagModal";
import { DeleteTagModal } from "@/components/TagManagement/DeleteTagModal";
import { MergeTagsModal } from "@/components/TagManagement/MergeTagsModal";
import { useTagManagement } from "@/hooks/useTagManagement";
import { useTagBooks } from "@/hooks/useTagBooks";
import { toast } from "@/utils/toast";

function TagsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedTagFromURL = searchParams?.get("tag");

  const [selectedTag, setSelectedTag] = useState<string | null>(
    selectedTagFromURL
  );

  // Modal states
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string>("");
  const [tagToDelete, setTagToDelete] = useState<{ name: string; bookCount: number } | null>(null);
  const [tagsToMerge, setTagsToMerge] = useState<string[]>([]);
  
  // Loading states for modals
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);

  // Settings state
  const [confirmTagRemoval, setConfirmTagRemoval] = useState(true);

  // Sync selected tag with URL
  useEffect(() => {
    if (selectedTagFromURL !== selectedTag) {
      setSelectedTag(selectedTagFromURL);
    }
  }, [selectedTagFromURL]);

  // Tag management hook
  const { tags, totalBooks, loading: tagsLoading, error: tagsError, refetch: refetchTags, renameTag, deleteTag, mergeTags } = useTagManagement();

  // Books for selected tag hook
  const {
    books,
    total: totalBooksInTag,
    loading: booksLoading,
    error: booksError,
    refetch: refetchBooks,
    removeTagFromBook,
  } = useTagBooks(selectedTag);

  // Update URL when tag is selected
  const handleSelectTag = (tagName: string) => {
    setSelectedTag(tagName);
    router.push(`/tags?tag=${encodeURIComponent(tagName)}`);
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
    setRenameModalOpen(true);
  };

  const confirmRenameTag = async (newName: string) => {
    setRenameLoading(true);
    try {
      await renameTag(tagToRename, newName);
      toast.success(`Tag renamed to "${newName}"`);
      
      // Update selected tag if it was the renamed one
      if (selectedTag === tagToRename) {
        setSelectedTag(newName);
        router.push(`/tags?tag=${encodeURIComponent(newName)}`);
      }
      setRenameModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename tag");
    } finally {
      setRenameLoading(false);
    }
  };

  // Handle delete tag
  const handleDeleteTag = async (tagName: string) => {
    const tag = tags.find(t => t.name === tagName);
    if (!tag) return;
    
    setTagToDelete({ name: tagName, bookCount: tag.bookCount });
    setDeleteModalOpen(true);
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteTag(tagToDelete.name);
      toast.success(`Tag "${tagToDelete.name}" deleted`);
      
      // Clear selection if deleted tag was selected
      if (selectedTag === tagToDelete.name) {
        setSelectedTag(null);
        router.push("/tags");
      }
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle merge tags
  const handleMergeTags = async (sourceTags: string[]) => {
    setTagsToMerge(sourceTags);
    setMergeModalOpen(true);
  };

  const confirmMergeTags = async (targetTag: string) => {
    setMergeLoading(true);
    try {
      // Filter out the target tag from source tags to avoid "merge into itself" error
      const sourceTagsToRemove = tagsToMerge.filter(tag => tag !== targetTag);
      
      await mergeTags(sourceTagsToRemove, targetTag);
      
      // Success message should reflect actual number of tags being merged
      const mergeCount = sourceTagsToRemove.length;
      if (mergeCount === 1) {
        toast.success(`Merged "${sourceTagsToRemove[0]}" into "${targetTag}"`);
      } else {
        toast.success(`Merged ${mergeCount} tags into "${targetTag}"`);
      }
      
      // Update selection if one of the source tags was selected
      if (selectedTag && tagsToMerge.includes(selectedTag)) {
        setSelectedTag(targetTag);
        router.push(`/tags?tag=${encodeURIComponent(targetTag)}`);
      }
      setMergeModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge tags");
    } finally {
      setMergeLoading(false);
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
    }
  };

  // Handle mobile back navigation
  const handleCloseDetail = () => {
    setSelectedTag(null);
    router.push("/tags");
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
        onConfirmRemovalChange={setConfirmTagRemoval}
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
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 h-[calc(100vh-280px)]">
        {/* Tag list (left panel on desktop, full width on mobile/tablet) */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 overflow-hidden flex flex-col">
            <TagList
              tags={tags}
              selectedTag={selectedTag}
              loading={tagsLoading}
              onSelectTag={handleSelectTag}
              onRenameTag={handleRenameTag}
              onDeleteTag={handleDeleteTag}
              onMergeTags={handleMergeTags}
            />
          </div>

          {/* Tag detail panel (right panel on large desktop only) */}
          <div className="hidden lg:block bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6 overflow-hidden">
            <TagDetailPanel
              tagName={selectedTag}
              books={books}
              loading={booksLoading}
              totalBooks={totalBooksInTag}
              onRemoveTag={handleRemoveTagFromBook}
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
            totalBooks={totalBooksInTag}
            onRemoveTag={handleRemoveTagFromBook}
            confirmRemoval={confirmTagRemoval}
          />
        </div>

        {/* Modals */}
        <RenameTagModal
          isOpen={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          tagName={tagToRename}
          onConfirm={confirmRenameTag}
          loading={renameLoading}
        />

        <DeleteTagModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          tagName={tagToDelete?.name || ""}
          bookCount={tagToDelete?.bookCount || 0}
          onConfirm={confirmDeleteTag}
          loading={deleteLoading}
        />

        <MergeTagsModal
          isOpen={mergeModalOpen}
          onClose={() => setMergeModalOpen(false)}
          sourceTags={tagsToMerge}
          tagStats={tags}
          onConfirm={confirmMergeTags}
          loading={mergeLoading}
        />
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
