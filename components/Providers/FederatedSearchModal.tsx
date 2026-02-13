"use client";

import { useState, useEffect } from "react";
import { Search, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import BaseModal from "@/components/Modals/BaseModal";
import { Button } from "@/components/Utilities/Button";
import { ProviderBadge } from "@/components/Providers/ProviderBadge";
import { SearchResultCard } from "@/components/Providers/SearchResultCard";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import type { 
  FederatedSearchResponse, 
  ProviderSearchResult 
} from "@/lib/services/search.service";
import type { SearchResult, ProviderId } from "@/lib/providers/base/IMetadataProvider";
import type { ManualBookInput } from "@/lib/validation/manual-book.schema";
import type { PotentialDuplicate } from "@/lib/services/duplicate-detection.service";

const logger = getLogger().child({ component: "FederatedSearchModal" });

interface FederatedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookId: number) => void;
}

interface SelectedResult {
  result: SearchResult;
  provider: ProviderId;
}

interface ValidationError {
  path: (string | number)[];
  message: string;
}

export default function FederatedSearchModal({
  isOpen,
  onClose,
  onSuccess,
}: FederatedSearchModalProps) {
  // Search state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<FederatedSearchResponse | null>(null);
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set());

  // Selection and form state
  const [selectedResult, setSelectedResult] = useState<SelectedResult | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSearchResponse(null);
      setSelectedResult(null);
      setCollapsedProviders(new Set());
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle("");
    setAuthors("");
    setIsbn("");
    setPublisher("");
    setPubDate("");
    setTotalPages("");
    setDescription("");
    setTags("");
    setValidationErrors({});
    setDuplicates([]);
    setShowDuplicateWarning(false);
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setSearchResponse(null);
    setSelectedResult(null);

    try {
      const response = await fetch("/api/providers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Search failed");
        return;
      }

      const { data }: { data: FederatedSearchResponse } = await response.json();
      setSearchResponse(data);

      logger.info(
        {
          query,
          totalResults: data.totalResults,
          successfulProviders: data.successfulProviders,
          failedProviders: data.failedProviders,
        },
        "Search completed"
      );

      if (data.totalResults === 0) {
        toast.info("No results found. Try a different search or add manually.");
      }
    } catch (error) {
      logger.error({ error }, "Search request failed");
      toast.error("Failed to search providers. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: SearchResult, provider: ProviderId) => {
    setSelectedResult({ result, provider });
    
    // Pre-fill form with result data
    setTitle(result.title);
    setAuthors(result.authors.join(", "));
    setIsbn(result.isbn || "");
    setPublisher(result.publisher || "");
    setPubDate(result.pubDate ? new Date(result.pubDate).toISOString().split("T")[0] : "");
    setDescription("");
    setTags("");
    setTotalPages(result.totalPages?.toString() || "");

    // Check for duplicates
    checkForDuplicates(result.title, result.authors);
  };

  const checkForDuplicates = async (bookTitle: string, bookAuthors: string[]) => {
    try {
      const response = await fetch("/api/books/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle,
          authors: bookAuthors,
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
  };

  const handleBack = () => {
    if (showDuplicateWarning) {
      setShowDuplicateWarning(false);
    } else if (selectedResult) {
      setSelectedResult(null);
      resetForm();
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!selectedResult) return;

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
      // Prepare payload - books from provider search are manual books
      // with pre-populated metadata (provider is ephemeral, not stored)
      const payload: any = {
        title: title.trim(),
        authors: authorList,
      };

      // Add optional fields
      if (isbn.trim()) payload.isbn = isbn.trim();
      if (publisher.trim()) payload.publisher = publisher.trim();
      if (pubDate.trim()) payload.pubDate = new Date(pubDate);
      if (totalPages.trim()) payload.totalPages = parseInt(totalPages, 10);
      if (description.trim()) payload.description = description.trim();
      if (tags.trim()) {
        payload.tags = tags.split(",").map((t) => t.trim()).filter((t) => t);
      }
      if (selectedResult.result.coverImageUrl) {
        payload.coverImageUrl = selectedResult.result.coverImageUrl;
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
      logger.info({ bookId: result.book.id, source: payload.source }, "Book created from provider search");
      
      toast.success(`"${result.book.title}" added to your library`);
      onSuccess(result.book.id);
      onClose();
    } catch (error) {
      logger.error({ error }, "Failed to create book from search result");
      toast.error("Failed to create book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProviderCollapse = (provider: string) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const renderSearchView = () => (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by title, author, or ISBN..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={isSearching}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Search Results */}
      {searchResponse && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Found {searchResponse.totalResults} result{searchResponse.totalResults !== 1 ? "s" : ""} 
              {" "}from {searchResponse.successfulProviders} provider{searchResponse.successfulProviders !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Results by Provider */}
          {searchResponse.results.map((providerResult) => (
            <div key={providerResult.provider} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Provider Header */}
              <button
                onClick={() => toggleProviderCollapse(providerResult.provider)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {collapsedProviders.has(providerResult.provider) ? (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                  <ProviderBadge
                    source={providerResult.provider as ProviderId}
                    status={providerResult.status}
                    showStatus
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {providerResult.results.length} result{providerResult.results.length !== 1 ? "s" : ""}
                    {providerResult.duration && ` • ${providerResult.duration}ms`}
                  </span>
                </div>
              </button>

              {/* Provider Results */}
              {!collapsedProviders.has(providerResult.provider) && (
                <div className="p-4 space-y-2">
                  {providerResult.status === "success" && providerResult.results.length > 0 ? (
                    providerResult.results.map((result, index) => (
                      <SearchResultCard
                        key={`${result.externalId}-${index}`}
                        result={result}
                        provider={providerResult.provider as ProviderId}
                        onClick={() => handleSelectResult(result, providerResult.provider as ProviderId)}
                      />
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        {providerResult.status === "timeout"
                          ? "Request timed out"
                          : providerResult.error || "No results found"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* All Providers Failed */}
          {searchResponse.successfulProviders === 0 && (
            <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                All providers failed
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Unable to search any external providers. Please try again later.
              </p>
              <Button variant="secondary" onClick={onClose}>
                Add Manually Instead
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderDuplicateWarning = () => (
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
  );

  const renderEditForm = () => (
    <div className="space-y-4">
      {/* Selected Result Info */}
      {selectedResult && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <ProviderBadge source={selectedResult.provider} size="sm" />
            <span className="text-gray-600 dark:text-gray-400">
              Edit the metadata below before adding to your library
            </span>
          </div>
        </div>
      )}

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
      {duplicates.length > 0 && !showDuplicateWarning && (
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
  );

  // Determine modal title and subtitle
  let modalTitle = "Search Providers";
  let modalSubtitle = "Search Hardcover and Open Library for books";

  if (showDuplicateWarning) {
    modalTitle = "Potential Duplicates Found";
    modalSubtitle = "We found books that might be duplicates. Proceed anyway?";
  } else if (selectedResult) {
    modalTitle = "Add Book from Search";
    modalSubtitle = "Review and edit metadata before adding";
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size="xl"
      loading={isSubmitting}
      actions={
        selectedResult ? (
          <>
            <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
              {showDuplicateWarning ? "Go Back" : "Back to Results"}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {showDuplicateWarning ? "Add Anyway" : "Add Book"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {showDuplicateWarning
        ? renderDuplicateWarning()
        : selectedResult
        ? renderEditForm()
        : renderSearchView()}
    </BaseModal>
  );
}
