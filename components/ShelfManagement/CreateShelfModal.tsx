"use client";

import { useState, useCallback } from "react";
import BaseModal from "@/components/Modals/BaseModal";
import { ShelfIconPicker } from "@/components/ShelfIconPicker";
import type { CreateShelfRequest } from "@/lib/api";

interface CreateShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateShelf: (data: CreateShelfRequest) => Promise<unknown>;
}

export function CreateShelfModal({
  isOpen,
  onClose,
  onCreateShelf,
}: CreateShelfModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onCreateShelf({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon: icon || undefined,
      });
      // Reset form
      setName("");
      setDescription("");
      setColor("#3b82f6");
      setIcon(null);
      onClose();
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setLoading(false);
    }
  }, [name, description, color, icon, onCreateShelf, onClose]);

  const handleClose = useCallback(() => {
    if (!loading) {
      setName("");
      setDescription("");
      setColor("#3b82f6");
      setIcon(null);
      onClose();
    }
  }, [loading, onClose]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Shelf"
      subtitle="Organize your books into custom shelves"
      size="md"
      loading={loading}
      allowBackdropClose={false}
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
            {loading ? "Creating..." : "Create Shelf"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Shelf Name */}
        <div>
          <label
            htmlFor="shelf-name"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Shelf Name <span className="text-red-500">*</span>
          </label>
          <input
            id="shelf-name"
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
            htmlFor="shelf-description"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Description (Optional)
          </label>
          <textarea
            id="shelf-description"
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
            htmlFor="shelf-color"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="shelf-color"
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
