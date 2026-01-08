"use client";

import { useEffect, useState } from "react";
import { Plus, Library } from "lucide-react";
import { useShelfManagement } from "@/hooks/useShelfManagement";
import type { ShelfWithBookCountAndCovers } from "@/lib/api";
import { ShelfItem, ShelfItemSkeleton } from "@/components/ShelfManagement/ShelfItem";
import { CreateShelfModal } from "@/components/ShelfManagement/CreateShelfModal";
import { EditShelfModal } from "@/components/ShelfManagement/EditShelfModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import BaseModal from "@/components/Modals/BaseModal";
import { NewShelfFAB } from "@/components/ShelfManagement/NewShelfFAB";

export default function ShelvesPage() {
  const {
    shelves,
    loading,
    fetchShelves,
    createShelf,
    updateShelf,
    deleteShelf,
  } = useShelfManagement();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<ShelfWithBookCountAndCovers | null>(null);
  const [deletingShelf, setDeletingShelf] = useState<ShelfWithBookCountAndCovers | null>(null);

  // Delete loading
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch shelves on mount
  useEffect(() => {
    fetchShelves();
  }, [fetchShelves]);

  const handleDeleteShelf = async () => {
    if (!deletingShelf) return;

    setDeleteLoading(true);
    try {
      await deleteShelf(deletingShelf.id);
      setDeletingShelf(null);
    } catch (error) {
      // Error handled by hook
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="My Shelves"
        subtitle="Organize your books into custom collections"
        icon={Library}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Shelf
          </button>
        }
      />

      <div>
        {/* Empty State */}
        {!loading && shelves.length === 0 && (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-16 text-center rounded-lg">
            <Library className="w-16 h-16 text-[var(--accent)]/40 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
              No shelves yet
            </h3>
            <p className="text-[var(--foreground)]/70 mb-6">
              Create your first shelf to start organizing your books
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Shelf
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShelfItemSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Shelves Grid */}
        {!loading && shelves.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shelves.map((shelf) => (
              <ShelfItem
                key={shelf.id}
                shelf={shelf}
                onEdit={setEditingShelf}
                onDelete={setDeletingShelf}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB for New Shelf */}
      <NewShelfFAB onClick={() => setIsCreateModalOpen(true)} />

      {/* Create Shelf Modal */}
      <CreateShelfModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateShelf={createShelf}
      />

      {/* Edit Shelf Modal */}
      <EditShelfModal
        isOpen={!!editingShelf}
        onClose={() => setEditingShelf(null)}
        onUpdateShelf={updateShelf}
        shelf={editingShelf}
      />

      {/* Delete Confirmation Modal */}
      <BaseModal
        isOpen={!!deletingShelf}
        onClose={() => !deleteLoading && setDeletingShelf(null)}
        title="Delete Shelf"
        subtitle={deletingShelf ? `Are you sure you want to delete "${deletingShelf.name}"?` : ""}
        size="md"
        loading={deleteLoading}
        actions={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeletingShelf(null)}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteShelf}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteLoading ? "Deleting..." : "Delete Shelf"}
            </button>
          </div>
        }
      >
        <p className="text-[var(--foreground)]">
          This will remove the shelf, but your books will not be deleted. You can always create a new shelf later.
        </p>
        {deletingShelf && deletingShelf.bookCount > 0 && (
          <p className="text-[var(--foreground)]/70 mt-3">
            This shelf contains <span className="font-semibold">{deletingShelf.bookCount}</span>{" "}
            {deletingShelf.bookCount === 1 ? "book" : "books"}.
          </p>
        )}
      </BaseModal>
    </div>
  );
}
