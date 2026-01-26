"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, X, Check, Library as LibraryIcon, Layers } from "lucide-react";
import BaseModal from "@/components/Modals/BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { Spinner } from "@/components/Utilities/Spinner";
import { getShelfIcon } from "@/components/ShelfManagement/ShelfIconPicker";
import { cn } from "@/utils/cn";
import { ShelfAvatar } from "@/components/ShelfManagement/ShelfAvatar";

interface Shelf {
  id: number;
  name: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  bookCount: number;
}

interface ShelfSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShelf: (shelfId: number, keepSelected: boolean) => Promise<void>;
  currentShelfId?: number;
  title: string;
  confirmButtonText: string;
  allowKeepSelected?: boolean;
}

export function ShelfSelectionModal({
  isOpen,
  onClose,
  onSelectShelf,
  currentShelfId,
  title,
  confirmButtonText,
  allowKeepSelected = true,
}: ShelfSelectionModalProps) {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  // Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Shelves data
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection
  const [selectedShelfId, setSelectedShelfId] = useState<number | null>(null);
  const [keepSelected, setKeepSelected] = useState(false);
  
  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch shelves when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchShelves = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/shelves?withCounts=true");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        // Filter out current shelf if provided
        const filteredShelves = currentShelfId
          ? result.data.filter((shelf: Shelf) => shelf.id !== currentShelfId)
          : result.data;
        
        setShelves(filteredShelves);
      } catch (error) {
        console.error("Failed to fetch shelves:", error);
        setError("Failed to load shelves");
        setShelves([]);
      } finally {
        setLoading(false);
      }
    };

    fetchShelves();
  }, [isOpen, currentShelfId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedShelfId(null);
      setKeepSelected(false);
      setError(null);
    }
  }, [isOpen]);

  // Filter shelves by search
  const filteredShelves = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return shelves;
    }
    
    const searchLower = debouncedSearch.trim().toLowerCase();
    return shelves.filter((shelf) =>
      shelf.name.toLowerCase().includes(searchLower)
    );
  }, [shelves, debouncedSearch]);

  // Handle shelf selection
  const handleShelfClick = useCallback((shelfId: number) => {
    setSelectedShelfId(shelfId);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (selectedShelfId === null) return;

    setSubmitting(true);
    try {
      await onSelectShelf(selectedShelfId, keepSelected);
      onClose();
    } catch (error) {
      // Error handled by parent
      console.error("Failed to select shelf:", error);
    } finally {
      setSubmitting(false);
    }
  }, [selectedShelfId, keepSelected, onSelectShelf, onClose]);

  const handleClose = useCallback(() => {
    if (!submitting) {
      onClose();
    }
  }, [submitting, onClose]);

  // Shared content for both mobile and desktop
  const searchAndResults = (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
        <input
          type="text"
          placeholder="Search shelves by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={submitting}
          autoFocus
          className={`w-full pl-10 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 ${
            search ? "pr-10" : "pr-4"
          }`}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            disabled={submitting}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="border-t border-[var(--border-color)] pt-4">
        {error ? (
          <div className="text-center py-16">
            <LibraryIcon className="w-16 h-16 mx-auto text-red-500/50 mb-4" />
            <h3 className="text-lg font-semibold text-[var(--heading-text)] mb-2">
              Error Loading Shelves
            </h3>
            <p className="text-sm text-[var(--foreground)]/60 mb-4">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors"
            >
              Reload Page
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <Spinner size="md" />
            <p className="mt-4 text-sm text-[var(--foreground)]/60">Loading shelves...</p>
          </div>
        ) : filteredShelves.length === 0 ? (
          <div className="text-center py-16">
            <LibraryIcon className="w-16 h-16 mx-auto text-[var(--foreground)]/30 mb-4" />
            <h3 className="text-lg font-semibold text-[var(--heading-text)] mb-2">
              {shelves.length === 0 ? "No Other Shelves" : "No Shelves Found"}
            </h3>
            <p className="text-sm text-[var(--foreground)]/60">
              {shelves.length === 0
                ? "Create another shelf to use this feature."
                : "No shelves match your search. Try different keywords."}
            </p>
          </div>
        ) : (
          <>
            {/* Count */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--foreground)]/60">
                {filteredShelves.length} {filteredShelves.length === 1 ? "shelf" : "shelves"}
              </span>
            </div>

            {/* Shelf List */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {filteredShelves.map((shelf) => {
                const isSelected = selectedShelfId === shelf.id;

                return (
                  <button
                    key={shelf.id}
                    type="button"
                    onClick={() => handleShelfClick(shelf.id)}
                    disabled={submitting}
                    className={cn(
                      "w-full p-3 rounded-lg border-2 text-left transition-all disabled:opacity-50 shadow-sm",
                      isSelected
                        ? "border-[var(--accent)] shadow-md"
                        : "border-[var(--border-color)] bg-[var(--background)] hover:border-[var(--accent)]/50 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio button / Checkmark */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--accent)] opacity-40"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Shelf Icon */}
                      <ShelfAvatar
                        color={shelf.color || "var(--accent)"}
                        icon={shelf.icon}
                        size="md"
                        shape="rounded"
                        fallbackIcon={Layers}
                        className="opacity-90"
                      />

                      {/* Shelf Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[var(--heading-text)] mb-0.5 truncate">
                          {shelf.name} <span className="text-sm text-[var(--accent)] font-normal">({shelf.bookCount})</span>
                        </h4>
                        
                        {/* Description */}
                        {shelf.description && (
                          <p className="text-xs text-[var(--subheading-text)] truncate">
                            {shelf.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Keep Selected Checkbox */}
            {allowKeepSelected && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepSelected}
                    onChange={(e) => setKeepSelected(e.target.checked)}
                    disabled={submitting}
                    className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer disabled:opacity-50"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="text-sm text-[var(--foreground)]">
                    Keep books selected after action
                  </span>
                </label>
                <p className="text-xs text-[var(--foreground)]/60 mt-1 ml-6">
                  Allows you to perform multiple operations on the same selection
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title={title}
        icon={<LibraryIcon className="w-5 h-5" />}
        size="full"
        allowBackdropClose={false}
      >
        {/* Subtitle */}
        <div className="mb-4">
          <p className="text-sm text-[var(--foreground)]/70">
            Select a destination shelf
          </p>
        </div>

        {/* Content */}
        <div className="mb-20">
          {searchAndResults}
        </div>

        {/* Fixed bottom buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--card-bg)] border-t border-[var(--border-color)] p-4 flex gap-3 justify-end z-10">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedShelfId === null || submitting}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Processing..." : confirmButtonText}
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle="Select a destination shelf"
      size="2xl"
      loading={submitting}
      allowBackdropClose={false}
      actions={
        <div className="flex gap-3 justify-end w-full">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedShelfId === null || submitting}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Processing..." : confirmButtonText}
          </button>
        </div>
      }
    >
      {searchAndResults}
    </BaseModal>
  );
}
