"use client";

import { useState, useCallback, useEffect } from "react";
import { FolderPlus } from "lucide-react";
import BaseModal from "@/components/Modals/BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { Button } from "@/components/Utilities/Button";
import { ShelfAppearancePicker } from "@/components/ShelfManagement/ShelfAppearancePicker";
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
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Shared form content
  const formContent = (
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
          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Appearance Picker (Color + Icon) */}
      <ShelfAppearancePicker
        color={color}
        icon={icon}
        onColorChange={setColor}
        onIconChange={setIcon}
        disabled={loading}
        shelfName={name}
      />
    </div>
  );

  // Shared action buttons
  const actionButtons = (
    <div className="flex gap-3 justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        disabled={loading}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={!name.trim() || loading}
      >
        {loading ? "Creating..." : "Create Shelf"}
      </Button>
    </div>
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Create New Shelf"
        icon={<FolderPlus className="w-5 h-5" />}
        size="full"
        allowBackdropClose={false}
        actions={actionButtons}
      >
        <p className="text-sm text-[var(--subheading-text)] mb-4">
          Organize your books into custom shelves
        </p>
        {formContent}
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Shelf"
      subtitle="Organize your books into custom shelves"
      size="xl"
      loading={loading}
      allowBackdropClose={false}
      actions={actionButtons}
    >
      {formContent}
    </BaseModal>
  );
}
