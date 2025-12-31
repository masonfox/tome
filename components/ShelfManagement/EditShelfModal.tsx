"use client";

import { useState, useCallback, useEffect } from "react";
import BaseModal from "@/components/BaseModal";
import { ShelfIconPicker } from "@/components/ShelfIconPicker";
import type { UpdateShelfData, ShelfWithBookCount } from "@/hooks/useShelfManagement";

interface EditShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateShelf: (shelfId: number, data: UpdateShelfData) => Promise<void>;
  shelf: ShelfWithBookCount | null;
}

export function EditShelfModal({
  isOpen,
  onClose,
  onUpdateShelf,
  shelf,
}: EditShelfModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize form when shelf changes or modal opens
  useEffect(() => {
    if (isOpen && shelf) {
      setName(shelf.name);
      setDescription(shelf.description || "");
      setColor(shelf.color || "#3b82f6");
      setIcon(shelf.icon || null);
    }
  }, [isOpen, shelf]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !shelf) return;

    setLoading(true);
    try {
      await onUpdateShelf(shelf.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon: icon || undefined,
      });
      onClose();
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setLoading(false);
    }
  }, [name, description, color, icon, shelf, onUpdateShelf, onClose]);

  const handleClose = useCallback(() => {
    if (!loading) {
      onClose();
    }
  }, [loading, onClose]);

  if (!shelf) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Shelf"
      subtitle="Update your shelf details"
      size="md"
      loading={loading}
      actions={
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Shelf Name */}
        <div>
          <label
            htmlFor="edit-shelf-name"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Shelf Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-shelf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Favorites, To Read, Currently Reading..."
            maxLength={100}
            disabled={loading}
            className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-[var(--foreground)]/60 mt-1">
            {name.length}/100 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="edit-shelf-description"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Description (Optional)
          </label>
          <textarea
            id="edit-shelf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for this shelf..."
            rows={3}
            disabled={loading}
            className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Color Picker */}
        <div>
          <label
            htmlFor="edit-shelf-color"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="edit-shelf-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={loading}
              className="h-10 w-20 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full border-2 border-[var(--border-color)]"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-[var(--foreground)]/70 font-mono">
                {color}
              </span>
            </div>
          </div>
        </div>

        {/* Icon Picker */}
        <ShelfIconPicker
          selectedIcon={icon}
          onSelectIcon={setIcon}
          color={color}
          disabled={loading}
        />
      </div>
    </BaseModal>
  );
}
