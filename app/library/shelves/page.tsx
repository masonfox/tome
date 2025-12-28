"use client";

import { useEffect, useState } from "react";
import { Plus, Library } from "lucide-react";
import { useShelfManagement, type ShelfWithBookCount } from "@/hooks/useShelfManagement";
import { ShelfItem, ShelfItemSkeleton } from "@/components/ShelfManagement/ShelfItem";
import { CreateShelfModal } from "@/components/ShelfManagement/CreateShelfModal";
import { PageHeader } from "@/components/PageHeader";
import BaseModal from "@/components/BaseModal";
import type { UpdateShelfData } from "@/hooks/useShelfManagement";

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
  const [editingShelf, setEditingShelf] = useState<ShelfWithBookCount | null>(null);
  const [deletingShelf, setDeletingShelf] = useState<ShelfWithBookCount | null>(null);
  
  // Edit shelf state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete loading
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch shelves on mount
  useEffect(() => {
    fetchShelves();
  }, [fetchShelves]);

  // Populate edit form when editing shelf changes
  useEffect(() => {
    if (editingShelf) {
      setEditName(editingShelf.name);
      setEditDescription(editingShelf.description || "");
      setEditColor(editingShelf.color || "#3b82f6");
    }
  }, [editingShelf]);

  const handleEditShelf = async () => {
    if (!editingShelf || !editName.trim()) return;

    setEditLoading(true);
    try {
      const updates: UpdateShelfData = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        color: editColor,
      };
      await updateShelf(editingShelf.id, updates);
      setEditingShelf(null);
    } catch (error) {
      // Error handled by hook
    } finally {
      setEditLoading(false);
    }
  };

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
    <div className="min-h-screen bg-[var(--background)]">
      <PageHeader
        title="My Shelves"
        subtitle="Organize your books into custom collections"
        icon={Library}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Shelf
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Empty State */}
        {!loading && shelves.length === 0 && (
          <div className="text-center py-16">
            <div className="text-[var(--foreground)]/40 mb-4">
              <svg
                className="w-24 h-24 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
              No shelves yet
            </h3>
            <p className="text-[var(--foreground)]/60 mb-6">
              Create your first shelf to start organizing your books
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Shelf
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShelfItemSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Shelves Grid */}
        {!loading && shelves.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Create Shelf Modal */}
      <CreateShelfModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateShelf={createShelf}
      />

      {/* Edit Shelf Modal */}
      <BaseModal
        isOpen={!!editingShelf}
        onClose={() => !editLoading && setEditingShelf(null)}
        title="Edit Shelf"
        subtitle="Update shelf details"
        size="md"
        loading={editLoading}
        actions={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setEditingShelf(null)}
              disabled={editLoading}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleEditShelf}
              disabled={!editName.trim() || editLoading}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--heading-text)] mb-2">
              Shelf Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              disabled={editLoading}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--heading-text)] mb-2">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              disabled={editLoading}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--heading-text)] mb-2">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                disabled={editLoading}
                className="h-10 w-20 rounded-lg cursor-pointer disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full border-2 border-[var(--border-color)]"
                  style={{ backgroundColor: editColor }}
                />
                <span className="text-sm text-[var(--foreground)]/70 font-mono">
                  {editColor}
                </span>
              </div>
            </div>
          </div>
        </div>
      </BaseModal>

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
