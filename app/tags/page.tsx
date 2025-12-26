"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TagManagementHeader } from "@/components/TagManagement/TagManagementHeader";
import { TagList } from "@/components/TagManagement/TagList";
import { TagDetailPanel } from "@/components/TagManagement/TagDetailPanel";
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

  // Sync selected tag with URL
  useEffect(() => {
    if (selectedTagFromURL !== selectedTag) {
      setSelectedTag(selectedTagFromURL);
    }
  }, [selectedTagFromURL]);

  // Tag management hook
  const { tags, loading: tagsLoading, error: tagsError, refetch: refetchTags, renameTag, deleteTag, mergeTags } = useTagManagement();

  // Books for selected tag hook
  const {
    books,
    total: totalBooks,
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
  const handleRenameTag = async (oldName: string) => {
    const newName = prompt(`Rename tag "${oldName}" to:`, oldName);
    if (!newName || newName === oldName) return;

    try {
      await renameTag(oldName, newName);
      toast.success(`Tag renamed to "${newName}"`);
      
      // Update selected tag if it was the renamed one
      if (selectedTag === oldName) {
        setSelectedTag(newName);
        router.push(`/tags?tag=${encodeURIComponent(newName)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename tag");
    }
  };

  // Handle delete tag
  const handleDeleteTag = async (tagName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the tag "${tagName}"? This will remove it from all books.`
      )
    ) {
      return;
    }

    try {
      await deleteTag(tagName);
      toast.success(`Tag "${tagName}" deleted`);
      
      // Clear selection if deleted tag was selected
      if (selectedTag === tagName) {
        setSelectedTag(null);
        router.push("/tags");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
    }
  };

  // Handle merge tags
  const handleMergeTags = async (sourceTags: string[]) => {
    const targetTag = prompt(
      `Merge ${sourceTags.length} tags into:`,
      sourceTags[0]
    );
    if (!targetTag) return;

    try {
      await mergeTags(sourceTags, targetTag);
      toast.success(`Merged ${sourceTags.length} tags into "${targetTag}"`);
      
      // Update selection if one of the source tags was selected
      if (selectedTag && sourceTags.includes(selectedTag)) {
        setSelectedTag(targetTag);
        router.push(`/tags?tag=${encodeURIComponent(targetTag)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge tags");
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

  // Calculate total unique books across all tags
  const totalUniqueBooks = tags.reduce((sum, tag) => sum + tag.bookCount, 0);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <TagManagementHeader
          totalTags={tags.length}
          totalBooks={totalUniqueBooks}
          loading={tagsLoading}
          onRefresh={handleRefresh}
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
        <div className="mt-8 grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 h-[calc(100vh-280px)]">
          {/* Tag list (left panel on desktop, full width on mobile) */}
          <div
            className={`${
              selectedTag ? "hidden md:block" : "block"
            } bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 overflow-hidden flex flex-col`}
          >
            <TagList
              tags={tags}
              selectedTag={selectedTag}
              onSelectTag={handleSelectTag}
              onRenameTag={handleRenameTag}
              onDeleteTag={handleDeleteTag}
              onMergeTags={handleMergeTags}
            />
          </div>

          {/* Tag detail panel (right panel on desktop, full width on mobile) */}
          <div
            className={`${
              selectedTag ? "block" : "hidden md:block"
            } bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6 overflow-hidden`}
          >
            <TagDetailPanel
              tagName={selectedTag}
              books={books}
              loading={booksLoading}
              totalBooks={totalBooks}
              onRemoveTag={handleRemoveTagFromBook}
              onClose={handleCloseDetail}
            />
          </div>
        </div>
      </div>
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
