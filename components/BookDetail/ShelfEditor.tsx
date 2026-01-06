"use client";

import { useState, useEffect } from "react";
import { X, FolderOpen, Plus, Check, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { getLogger } from "@/lib/logger";
import { getShelfIcon } from "@/components/ShelfIconPicker";
import { BottomSheet } from "@/components/Layout/BottomSheet";

interface Shelf {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
}

interface ShelfEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shelfIds: number[]) => Promise<void>;
  bookTitle: string;
  currentShelfIds: number[];
  availableShelves: Shelf[];
  isMobile?: boolean;
}

export default function ShelfEditor({
  isOpen,
  onClose,
  onSave,
  bookTitle,
  currentShelfIds,
  availableShelves,
  isMobile = false,
}: ShelfEditorProps) {
  const [selectedShelfIds, setSelectedShelfIds] = useState<number[]>(currentShelfIds);
  const [saving, setSaving] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedShelfIds(currentShelfIds);
      setSaving(false);
      setFilterQuery("");
    }
  }, [isOpen, currentShelfIds]);

  const toggleShelf = (shelfId: number) => {
    if (selectedShelfIds.includes(shelfId)) {
      setSelectedShelfIds(selectedShelfIds.filter((id) => id !== shelfId));
    } else {
      setSelectedShelfIds([...selectedShelfIds, shelfId]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedShelfIds);
      onClose();
    } catch (error) {
      // Error is handled by the parent component with toast
      getLogger().error({ err: error }, "Failed to save shelf assignments");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setSelectedShelfIds(currentShelfIds);
      setFilterQuery("");
      onClose();
    }
  };

  // Filter shelves based on search query
  const filteredShelves = availableShelves.filter((shelf) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    return (
      shelf.name.toLowerCase().includes(query) ||
      shelf.description?.toLowerCase().includes(query)
    );
  });

  // Shared content for both mobile and desktop
  const shelfContent = (
    <>
      {/* Subtitle - only show on mobile in BottomSheet */}
      {isMobile && (
        <p className="text-sm text-[var(--foreground)]/70 font-medium mb-4">
          {bookTitle}
        </p>
      )}

      {/* Filter Input */}
      {availableShelves.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter shelves..."
            disabled={saving}
            className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
        </div>
      )}
      
      {/* Shelves List */}
      {filteredShelves.length > 0 ? (
        <div className="space-y-2 mb-6">
          {filteredShelves.map((shelf) => {
            const isSelected = selectedShelfIds.includes(shelf.id);
            const Icon = shelf.icon ? getShelfIcon(shelf.icon) : null;
            
            return (
              <button
                key={shelf.id}
                type="button"
                onClick={() => toggleShelf(shelf.id)}
                disabled={saving}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left",
                  isSelected
                    ? "bg-[var(--accent-color)]/15 shadow-sm"
                    : "border-[var(--border-color)] hover:border-[var(--accent-color)]/50 hover:bg-[var(--border-color)]",
                  saving && "opacity-50 cursor-not-allowed"
                )}
                style={isSelected ? { borderColor: shelf.color || "#3b82f6" } : undefined}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: shelf.color || "#3b82f6" }}
                >
                  {Icon && <Icon className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[var(--heading-text)] truncate">
                    {shelf.name}
                  </div>
                  {shelf.description && (
                    <div className="text-sm text-[var(--foreground)]/60 truncate">
                      {shelf.description}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : availableShelves.length > 0 ? (
        <div className="text-center py-8 mb-6">
          <Search className="w-12 h-12 mx-auto mb-3 text-[var(--foreground)]/30" />
          <p className="text-sm text-[var(--foreground)]/70">
            No shelves match &quot;{filterQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="text-center py-8 mb-6">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[var(--foreground)]/30" />
          <p className="text-sm text-[var(--foreground)]/70 mb-4">
            No shelves available. Create a shelf first.
          </p>
          <a
            href="/library/shelves"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Shelf
          </a>
        </div>
      )}

      {/* Summary */}
      {availableShelves.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-[var(--background)] rounded-lg">
          <p className="text-sm text-[var(--foreground)]/70">
            {selectedShelfIds.length === 0 ? (
              "No shelves selected"
            ) : selectedShelfIds.length === 1 ? (
              <span>
                On <span className="font-semibold text-[var(--foreground)]">1 shelf</span>
              </span>
            ) : (
              <span>
                On <span className="font-semibold text-[var(--foreground)]">{selectedShelfIds.length} shelves</span>
              </span>
            )}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {availableShelves.length > 0 && (
        <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border-color)]">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-5 py-2.5 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg transition-colors font-semibold bg-[var(--accent)] text-white hover:bg-[var(--light-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </>
  );

  // Mobile: Use BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Add to Shelves"
        icon={<FolderOpen className="w-5 h-5" />}
        size="full"
        allowBackdropClose={!saving}
      >
        {shelfContent}
      </BottomSheet>
    );
  }

  // Desktop: Use centered modal
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div 
        className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-2xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1">
              Add to Shelves
            </h2>
            <p className="text-sm text-[var(--foreground)]/70 font-medium truncate">
              {bookTitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {shelfContent}
      </div>
    </div>
  );
}
