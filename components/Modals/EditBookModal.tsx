"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import BaseModal from "./BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { invalidateBookQueries } from "@/hooks/useBookStatus";
import { Button } from "@/components/Utilities/Button";
import { BookOpen } from "lucide-react";
import CoverUploadField from "@/components/Books/CoverUploadField";

interface EditBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: number;
  currentBook: {
    title: string;
    authors: string[];
    isbn?: string | null;
    publisher?: string | null;
    pubDate?: Date | string | null;
    series?: string | null;
    seriesIndex?: number | null;
    description?: string | null;
    totalPages?: number | null;
  };
}

const logger = getLogger().child({ component: "EditBookModal" });

export default function EditBookModal({
  isOpen,
  onClose,
  bookId,
  currentBook,
}: EditBookModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [series, setSeries] = useState("");
  const [seriesIndex, setSeriesIndex] = useState("");
  const [description, setDescription] = useState("");
  const [totalPages, setTotalPages] = useState("");

  // Cover upload state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverValidationError, setCoverValidationError] = useState<string | null>(null);
  const [coverChanged, setCoverChanged] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  // Reset form when modal opens with book data
  useEffect(() => {
    if (isOpen) {
      setTitle(currentBook.title || "");
      setAuthors(currentBook.authors?.join(", ") || "");
      setIsbn(currentBook.isbn || "");
      setPublisher(currentBook.publisher || "");
      setPubDate(currentBook.pubDate ? new Date(currentBook.pubDate).toISOString().split('T')[0] : "");
      setSeries(currentBook.series || "");
      setSeriesIndex(currentBook.seriesIndex?.toString() || "");
      setDescription(currentBook.description || "");
      setTotalPages(currentBook.totalPages?.toString() || "");
      
      // Reset cover state
      setCoverFile(null);
      setCoverUrl("");
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
        setCoverPreviewUrl(null);
      }
      setCoverValidationError(null);
      setCoverChanged(false);
      setIsCoverUploading(false);
    }
  }, [isOpen, currentBook]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!authors.trim()) {
      toast.error("At least one author is required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse authors (comma-separated)
      const authorsArray = authors
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0);

      if (authorsArray.length === 0) {
        toast.error("At least one author is required");
        setIsSubmitting(false);
        return;
      }

      // Build update payload (only include fields that have values)
      const updateData: any = {
        title: title.trim(),
        authors: authorsArray,
      };

      if (isbn.trim()) updateData.isbn = isbn.trim();
      if (publisher.trim()) updateData.publisher = publisher.trim();
      if (pubDate) updateData.pubDate = new Date(pubDate).toISOString();
      if (series.trim()) updateData.series = series.trim();
      if (seriesIndex.trim()) updateData.seriesIndex = parseFloat(seriesIndex);
      if (description.trim()) updateData.description = description.trim();
      if (totalPages.trim()) updateData.totalPages = parseInt(totalPages);

      // Update book
      const response = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403) {
          toast.error(error.error || "Cannot edit synced books");
          onClose();
          return;
        }
        throw new Error(error.error || "Failed to update book");
      }

      // Upload cover if changed (after successful metadata update)
      if (coverChanged && (coverFile || coverUrl.trim())) {
        setIsCoverUploading(true);
        
        try {
          const formData = new FormData();
          
          // Either append the file or the URL (server will download it)
          if (coverFile) {
            formData.append("cover", coverFile);
          } else if (coverUrl.trim()) {
            formData.append("coverUrl", coverUrl.trim());
          }

          const coverResponse = await fetch(`/api/books/${bookId}/cover`, {
            method: "POST",
            body: formData,
          });

          if (!coverResponse.ok) {
            const coverError = await coverResponse.json();
            logger.warn({ bookId, error: coverError }, "Cover upload failed");
            toast.warning(`Book updated, but cover upload failed: ${coverError.error || "Unknown error"}`);
          } else {
            logger.info({ bookId }, "Cover uploaded successfully");
          }
        } catch (coverError) {
          logger.error({ error: coverError }, "Cover upload request failed");
          toast.warning("Book updated, but cover upload request failed");
        }
        
        setIsCoverUploading(false);
      }

      // Invalidate caches to refetch book data (includes updated cover)
      await invalidateBookQueries(queryClient, bookId.toString());

      toast.success(coverChanged && (coverFile || coverUrl.trim()) ? "Book and cover updated successfully" : "Book updated successfully");
      onClose();
    } catch (error) {
      logger.error({ err: error, bookId }, "Error updating book");
      toast.error(error instanceof Error ? error.message : "Failed to update book");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form content shared between mobile and desktop
  const formContent = (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="Enter book title"
          disabled={isSubmitting}
        />
      </div>

      {/* Authors */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Authors <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="Comma-separated (e.g., Jane Doe, John Smith)"
          disabled={isSubmitting}
        />
      </div>

      {/* ISBN */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          ISBN
        </label>
        <input
          type="text"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="ISBN-10 or ISBN-13"
          disabled={isSubmitting}
        />
      </div>

      {/* Publisher and Pub Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Publisher
          </label>
          <input
            type="text"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Publisher name"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Publication Date
          </label>
          <input
            type="date"
            value={pubDate}
            onChange={(e) => setPubDate(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Series and Series Index */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Series
          </label>
          <input
            type="text"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Series name"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Series Index
          </label>
          <input
            type="number"
            step="0.1"
            value={seriesIndex}
            onChange={(e) => setSeriesIndex(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="e.g., 1, 2.5"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Total Pages */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Total Pages
        </label>
        <input
          type="number"
          value={totalPages}
          onChange={(e) => setTotalPages(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="Number of pages"
          disabled={isSubmitting}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          placeholder="Book description"
          disabled={isSubmitting}
        />
      </div>

      {/* Cover Image */}
      <CoverUploadField
        coverFile={coverFile}
        onCoverFileChange={(file) => {
          setCoverFile(file);
          setCoverChanged(true);
        }}
        coverUrl={coverUrl}
        onCoverUrlChange={(url) => {
          setCoverUrl(url);
          if (url.trim()) setCoverChanged(true);
        }}
        coverPreviewUrl={coverPreviewUrl}
        onPreviewUrlChange={setCoverPreviewUrl}
        validationError={coverValidationError || undefined}
        onValidationError={setCoverValidationError}
        disabled={isSubmitting || isCoverUploading}
      />
    </div>
  );

  // Action buttons
  const actionButtons = (
    <>
      <Button
        onClick={onClose}
        variant="secondary"
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || isCoverUploading}
      >
        {isSubmitting ? (isCoverUploading ? "Uploading cover..." : "Saving...") : "Save Changes"}
      </Button>
    </>
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Edit Book"
        icon={<BookOpen className="w-5 h-5" />}
        size="full"
        allowBackdropClose={!isSubmitting}
        actions={actionButtons}
      >
        {formContent}
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Book"
      size="xl"
      actions={actionButtons}
      allowBackdropClose={false}
    >
      {formContent}
    </BaseModal>
  );
}
