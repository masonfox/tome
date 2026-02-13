"use client";

import { useState, useEffect, useRef } from "react";
import BaseModal from "@/components/Modals/BaseModal";
import { Button } from "@/components/Utilities/Button";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { ImagePlus, X } from "lucide-react";
import type { ManualBookInput } from "@/lib/validation/manual-book.schema";
import type { PotentialDuplicate } from "@/lib/services/duplicate-detection.service";

const logger = getLogger().child({ component: "ManualBookForm" });

/** Max cover file size in bytes (5MB) */
const MAX_COVER_SIZE = 5 * 1024 * 1024;

/** Accepted cover MIME types */
const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Accept string for file input */
const ACCEPTED_COVER_INPUT = ".jpg,.jpeg,.png,.webp,.gif";

interface ManualBookFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookId: number) => void;
}

interface ValidationError {
  path: (string | number)[];
  message: string;
}

export default function ManualBookForm({
  isOpen,
  onClose,
  onSuccess,
}: ManualBookFormProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [series, setSeries] = useState("");
  const [seriesIndex, setSeriesIndex] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  // Cover upload state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setAuthors("");
      setIsbn("");
      setPublisher("");
      setPubDate("");
      setTotalPages("");
      setSeries("");
      setSeriesIndex("");
      setDescription("");
      setTags("");
      setCoverFile(null);
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
        setCoverPreviewUrl(null);
      }
      setValidationErrors({});
      setDuplicates([]);
      setShowDuplicateWarning(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time validation on blur (title and authors only)
  const validateField = async (field: "title" | "authors") => {
    if (field === "title" && !title.trim()) {
      setValidationErrors((prev) => ({ ...prev, title: "Title is required" }));
      return;
    }
    
    if (field === "authors" && !authors.trim()) {
      setValidationErrors((prev) => ({ ...prev, authors: "At least one author is required" }));
      return;
    }

    // Clear error if field is valid
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });

    // Check for duplicates if both title and authors are filled
    if (title.trim() && authors.trim()) {
      try {
        const response = await fetch("/api/books/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            authors: authors.split(",").map((a) => a.trim()).filter((a) => a),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.duplicates?.hasDuplicates) {
            setDuplicates(data.duplicates.duplicates);
          } else {
            setDuplicates([]);
          }
        }
      } catch (error) {
        logger.error({ error }, "Failed to check for duplicates");
      }
    }
  };

  /** Validate and set cover file, creating a preview URL */
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
      setValidationErrors((prev) => ({
        ...prev,
        cover: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`,
      }));
      return;
    }

    // Validate size
    if (file.size > MAX_COVER_SIZE) {
      setValidationErrors((prev) => ({
        ...prev,
        cover: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 5MB`,
      }));
      return;
    }

    // Clear any previous cover error
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated.cover;
      return updated;
    });

    // Revoke previous preview URL
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  /** Remove the selected cover file */
  const handleCoverRemove = () => {
    setCoverFile(null);
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
      setCoverPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Clear cover error if any
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated.cover;
      return updated;
    });
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setValidationErrors({});

    // Parse authors
    const authorList = authors
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);

    if (!title.trim()) {
      setValidationErrors({ title: "Title is required" });
      return;
    }

    if (authorList.length === 0) {
      setValidationErrors({ authors: "At least one author is required" });
      return;
    }

    // Show duplicate warning if duplicates exist and not already shown
    if (duplicates.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare payload
      const payload: Partial<ManualBookInput> = {
        title: title.trim(),
        authors: authorList,
      };

      // Add optional fields
      if (isbn.trim()) payload.isbn = isbn.trim();
      if (publisher.trim()) payload.publisher = publisher.trim();
      if (pubDate.trim()) payload.pubDate = new Date(pubDate);
      if (totalPages.trim()) payload.totalPages = parseInt(totalPages, 10);
      if (series.trim()) payload.series = series.trim();
      if (seriesIndex.trim()) payload.seriesIndex = parseFloat(seriesIndex);
      if (description.trim()) payload.description = description.trim();
      if (tags.trim()) {
        payload.tags = tags.split(",").map((t) => t.trim()).filter((t) => t);
      }

      // Submit to API
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        
        if (error.details) {
          // Zod validation errors
          const errors: Record<string, string> = {};
          error.details.forEach((err: ValidationError) => {
            const field = err.path[0] as string;
            errors[field] = err.message;
          });
          setValidationErrors(errors);
        } else {
          toast.error(error.error || "Failed to create book");
        }
        return;
      }

      const result = await response.json();
      logger.info({ bookId: result.book.id }, "Manual book created successfully");

      // Upload cover image if one was selected (TC13)
      if (coverFile) {
        try {
          const formData = new FormData();
          formData.append("cover", coverFile);

          const coverResponse = await fetch(`/api/books/${result.book.id}/cover`, {
            method: "POST",
            body: formData,
          });

          if (!coverResponse.ok) {
            const coverError = await coverResponse.json();
            logger.warn(
              { bookId: result.book.id, error: coverError },
              "Cover upload failed, but book was created successfully"
            );
            // Non-blocking: book is created, just warn about cover
            toast.warning(`Book added, but cover upload failed: ${coverError.error || "Unknown error"}`);
          } else {
            logger.info({ bookId: result.book.id }, "Cover uploaded successfully");
          }
        } catch (coverError) {
          logger.error({ error: coverError }, "Cover upload request failed");
          // Non-blocking: book created successfully
        }
      }
      
      toast.success(`"${result.book.title}" added to your library`);
      onSuccess(result.book.id);
      onClose();
    } catch (error) {
      logger.error({ error }, "Failed to create manual book");
      toast.error("Failed to create book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (showDuplicateWarning) {
      setShowDuplicateWarning(false);
    } else {
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={showDuplicateWarning ? "Potential Duplicates Found" : "Add Manual Book"}
      subtitle={
        showDuplicateWarning
          ? "We found books that might be duplicates. Proceed anyway?"
          : "Add a book that's not in your Calibre library"
      }
      size="xl"
      loading={isSubmitting}
      actions={
        <>
          <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            {showDuplicateWarning ? "Go Back" : "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {showDuplicateWarning ? "Add Anyway" : "Add Book"}
          </Button>
        </>
      }
    >
      {showDuplicateWarning ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The following {duplicates.length === 1 ? "book" : "books"} in your library {duplicates.length === 1 ? "appears" : "appear"} similar:
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {duplicates.map((dup) => (
              <div
                key={dup.bookId}
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {dup.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      by {dup.authors.join(", ")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Source: {dup.source} • {dup.similarity.toFixed(0)}% similar
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title - Required */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => validateField("title")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter book title"
            />
            {validationErrors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.title}</p>
            )}
          </div>

          {/* Authors - Required */}
          <div>
            <label htmlFor="authors" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Authors <span className="text-red-500">*</span>
            </label>
            <input
              id="authors"
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              onBlur={() => validateField("authors")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="e.g., Jane Doe, John Smith (comma-separated)"
            />
            {validationErrors.authors && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.authors}</p>
            )}
          </div>

          {/* Optional fields in grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* ISBN */}
            <div>
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ISBN
              </label>
              <input
                id="isbn"
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="ISBN-10 or ISBN-13"
              />
              {validationErrors.isbn && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.isbn}</p>
              )}
            </div>

            {/* Total Pages */}
            <div>
              <label htmlFor="totalPages" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total Pages
              </label>
              <input
                id="totalPages"
                type="number"
                min="1"
                max="10000"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 350"
              />
              {validationErrors.totalPages && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.totalPages}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Publisher */}
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Publisher
              </label>
              <input
                id="publisher"
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Penguin Books"
              />
            </div>

            {/* Publication Date */}
            <div>
              <label htmlFor="pubDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Publication Date
              </label>
              <input
                id="pubDate"
                type="date"
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Series */}
            <div>
              <label htmlFor="series" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Series
              </label>
              <input
                id="series"
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Harry Potter"
              />
            </div>

            {/* Series Index */}
            <div>
              <label htmlFor="seriesIndex" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Series Number
              </label>
              <input
                id="seriesIndex"
                type="number"
                step="0.1"
                value={seriesIndex}
                onChange={(e) => setSeriesIndex(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 1"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="e.g., fiction, fantasy (comma-separated)"
            />
          </div>

          {/* Cover Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cover Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_COVER_INPUT}
              onChange={handleCoverSelect}
              className="hidden"
              id="cover-upload"
            />
            {coverPreviewUrl ? (
              <div className="flex items-start gap-3">
                <div className="relative w-20 h-28 rounded overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                    {coverFile?.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {coverFile ? `${(coverFile.size / 1024).toFixed(0)} KB` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={handleCoverRemove}
                    className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mt-1"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full"
              >
                <ImagePlus className="w-4 h-4" />
                Choose cover image (JPEG, PNG, WebP, GIF — max 5MB)
              </button>
            )}
            {validationErrors.cover && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.cover}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Brief description or notes about the book"
            />
          </div>

          {/* Duplicate warning inline */}
          {duplicates.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ⚠️ Potential duplicate{duplicates.length > 1 ? "s" : ""} found
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                {duplicates.length} similar book{duplicates.length > 1 ? "s" : ""} already in your library
              </p>
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
}
